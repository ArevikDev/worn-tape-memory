import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DrizzleClient } from '../../db';
import { archetypes } from '../../db/schema';
import { DRIZZLE_CLIENT } from '../auth/auth.service';
import { SpotifyService } from '../spotify/spotify.service';
import { CoverArtService } from './cover-art.service';

export interface PlaylistExportResult {
  playlistId: string;
  playlistUrl: string;
  trackCount: number;
}

@Injectable()
export class PlaylistsService {
  private readonly logger = new Logger(PlaylistsService.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly spotify: SpotifyService,
    private readonly coverArt: CoverArtService,
  ) {}

  async exportArchetypeAsPlaylist(
    userId: string,
    archetypeId: string,
  ): Promise<PlaylistExportResult> {
    const [archetype] = await this.db
      .select()
      .from(archetypes)
      .where(eq(archetypes.id, archetypeId));

    if (!archetype || archetype.userId !== userId) {
      throw new NotFoundException('Archetype not found');
    }

    const accessToken = await this.spotify.getValidAccessToken(this.db, userId);

    // trackIds stores bare Spotify track IDs — construct full URIs directly
    const uris = archetype.trackIds.map((id) => `spotify:track:${id}`);

    try {
      let playlistId = archetype.spotifyPlaylistId;
      let playlistUrl = '';

      if (playlistId) {
        try {
          await this.spotify.setPlaylistTracks(accessToken, playlistId, uris);
          playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
          this.logger.log(`Updated playlist ${playlistId} for archetype "${archetype.name}"`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes('403')) throw err;
          // Stale playlist ID — we don't own it anymore, create a fresh one
          this.logger.warn(`Playlist ${playlistId} returned 403; creating a new one`);
          await this.db
            .update(archetypes)
            .set({ spotifyPlaylistId: null })
            .where(eq(archetypes.id, archetypeId));
          playlistId = null;
        }
      }

      if (!playlistId) {
        const created = await this.spotify.createPlaylist(
          accessToken,
          archetype.name,
          archetype.description,
        );
        playlistId = created.id;
        playlistUrl = created.url;

        await this.db
          .update(archetypes)
          .set({ spotifyPlaylistId: playlistId })
          .where(eq(archetypes.id, archetypeId));

        await this.spotify.setPlaylistTracks(accessToken, playlistId, uris);
        this.logger.log(
          `Created playlist ${playlistId} for archetype "${archetype.name}" (${uris.length} tracks)`,
        );
      }

      // Cover art upload is non-fatal — a failure here doesn't break the export
      try {
        const jpeg = await this.coverArt.generateJpeg(archetype.color);
        await this.spotify.uploadPlaylistCover(accessToken, playlistId, jpeg);
      } catch (err) {
        this.logger.warn(`Cover art upload skipped: ${String(err).slice(0, 120)}`);
      }

      return { playlistId, playlistUrl, trackCount: uris.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Playlist export failed for ${userId}/${archetypeId}: ${msg}`);
      throw new InternalServerErrorException(msg);
    }
  }
}
