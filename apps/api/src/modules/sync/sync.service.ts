import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import type { DrizzleClient } from '../../db';
import { users, tracks, listens } from '../../db/schema';
import { SpotifyService } from '../spotify/spotify.service';
import { DRIZZLE_CLIENT } from '../auth/auth.service';
import { SYNC_LISTENS_QUEUE, SyncListensJobData } from './sync.constants';

// ---------- Spotify API types ----------
interface SpotifyArtist {
  id: string;
  name: string;
}

interface SpotifyAlbumImage {
  url: string;
  width: number;
  height: number;
}

interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  preview_url: string | null;
  artists: SpotifyArtist[];
  album: {
    name: string;
    images: SpotifyAlbumImage[];
    release_date: string; // "YYYY", "YYYY-MM", or "YYYY-MM-DD"
  };
}

interface SpotifyRecentlyPlayedResponse {
  items: { track: SpotifyTrack; played_at: string }[];
  cursors?: { after: string; before: string };
  next: string | null;
}
// ---------------------------------------

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly spotify: SpotifyService,
    @InjectQueue(SYNC_LISTENS_QUEUE) private readonly syncQueue: Queue<SyncListensJobData>,
  ) {}

  // ── Core sync logic ──────────────────────────────────────────────────────

  async syncListensForUser(userId: string): Promise<{ inserted: number }> {
    const accessToken = await this.spotify.getValidAccessToken(this.db, userId);

    // Use lastSyncedAt as the cursor — only fetch plays since the last run
    const [user] = await this.db
      .select({ lastSyncedAt: users.lastSyncedAt })
      .from(users)
      .where(eq(users.id, userId));

    const after = user.lastSyncedAt
      ? user.lastSyncedAt.getTime()
      : Date.now() - 7 * 24 * 60 * 60 * 1000; // first run: last 7 days

    const url = `https://api.spotify.com/v1/me/player/recently-played?limit=50&after=${after}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Spotify recently-played failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as SpotifyRecentlyPlayedResponse;

    if (!data.items.length) {
      this.logger.log(`No new listens for user ${userId}`);
      return { inserted: 0 };
    }

    let inserted = 0;

    for (const item of data.items) {
      const t = item.track;

      // 1. Upsert the track — one row per unique Spotify track, shared across all users
      await this.db
        .insert(tracks)
        .values({
          spotifyTrackId: t.id,
          name: t.name,
          artistName: t.artists[0]?.name ?? 'Unknown',
          artistNames: t.artists.map((a) => a.name),
          albumName: t.album.name,
          albumImageUrl: t.album.images[0]?.url ?? null,
          durationMs: t.duration_ms,
          previewUrl: t.preview_url ?? null,
          spotifyUri: t.uri,
          releaseYear: t.album.release_date
            ? parseInt(t.album.release_date.substring(0, 4), 10)
            : null,
        })
        .onConflictDoNothing(); // already exists → skip, we'll fetch it below

      // 2. Get the track's internal ID (works whether just inserted or already existed)
      const [track] = await this.db
        .select({ id: tracks.id })
        .from(tracks)
        .where(eq(tracks.spotifyTrackId, t.id));

      // 3. Insert the listen — skip silently if this exact play was already recorded
      const result = await this.db
        .insert(listens)
        .values({
          userId,
          trackId: track.id,
          spotifyTrackId: t.id,
          playedAt: new Date(item.played_at),
        })
        .onConflictDoNothing()
        .returning({ id: listens.id });

      if (result.length > 0) inserted++;
    }

    // Advance cursor to the most recent play so next run only fetches new ones
    const mostRecentPlayedAt = new Date(data.items[0].played_at);
    await this.db
      .update(users)
      .set({ lastSyncedAt: mostRecentPlayedAt })
      .where(eq(users.id, userId));

    this.logger.log(`Synced ${inserted} new listens for user ${userId}`);
    return { inserted };
  }

  // ── Queue ────────────────────────────────────────────────────────────────

  async enqueueSyncForUser(userId: string): Promise<void> {
    await this.syncQueue.add('sync-listens', { userId });
  }

  // ── Cron ─────────────────────────────────────────────────────────────────

  // Runs every 30 minutes — enqueues a job for every known user
  @Cron('0 */30 * * * *')
  async scheduledSync(): Promise<void> {
    this.logger.log('Scheduled sync: enqueuing jobs for all users');
    const allUsers = await this.db.select({ id: users.id }).from(users);
    for (const user of allUsers) {
      await this.enqueueSyncForUser(user.id);
    }
  }
}
