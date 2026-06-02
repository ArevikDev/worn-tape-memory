import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { kmeans } from 'ml-kmeans';
import { and, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../../db';
import { listens, tracks, archetypes } from '../../db/schema';
import { DRIZZLE_CLIENT } from '../auth/auth.service';
import { AiService } from '../ai/ai.service';
import { SpotifyService } from '../spotify/spotify.service';

// Feature vector: [hour/23, dayOfWeek/6, energy/10, ...vibeVector(8)]
const MOOD_CATEGORIES = [
  'melancholy',
  'warm',
  'peak',
  'hypnotic',
  'euphoric',
  'contemplative',
] as const;

@Injectable()
export class ArchetypesService {
  private readonly logger = new Logger(ArchetypesService.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly ai: AiService,
    private readonly spotify: SpotifyService,
  ) {}

  // ── Core detection ───────────────────────────────────────────────────────

  async detectArchetypesForUser(
    userId: string,
  ): Promise<{ detected: number; listenCount: number }> {
    // 1. Fetch all listens with their enriched track data
    const rawRows = await this.db
      .select({
        playedAt: listens.playedAt,
        spotifyTrackId: listens.spotifyTrackId,
        trackName: tracks.name,
        artistName: tracks.artistName,
        albumImageUrl: tracks.albumImageUrl,
        energy: tracks.energy,
        moodCategory: tracks.moodCategory,
        vibeVector: tracks.vibeVector,
      })
      .from(listens)
      .leftJoin(tracks, eq(listens.trackId, tracks.id))
      .where(eq(listens.userId, userId));

    // leftJoin can produce nulls when the track row is missing — filter those out
    const rows = rawRows.filter(
      (r): r is typeof r & { trackName: string; artistName: string } =>
        r.trackName != null && r.artistName != null,
    );

    // Need at least 3 listens (one per cluster minimum)
    if (rows.length < 3) {
      this.logger.log(
        `Not enough listens to detect archetypes for user ${userId} (${rows.length} listens)`,
      );
      return { detected: 0, listenCount: rows.length };
    }

    // 2. Build feature vectors
    const features: number[][] = rows.map((r) => {
      const d = new Date(r.playedAt);
      const hour = d.getHours() / 23;
      const dow = d.getDay() / 6;
      const energy = r.energy != null ? r.energy / 10 : 0.5;
      const vibe =
        r.vibeVector && r.vibeVector.length === 8
          ? r.vibeVector
          : (new Array(8).fill(0) as number[]);
      return [hour, dow, energy, ...vibe];
    });

    // 3. Determine k — more personas = more interesting
    const k = rows.length >= 100 ? 6 : rows.length >= 60 ? 5 : rows.length >= 40 ? 4 : 3;

    const result = kmeans(features, k, { maxIterations: 100 });

    // 4. Group rows by cluster assignment
    const clusters = new Map<number, typeof rows>();
    result.clusters.forEach((clusterIdx, i) => {
      if (!clusters.has(clusterIdx)) clusters.set(clusterIdx, []);
      clusters.get(clusterIdx)!.push(rows[i]);
    });

    // 5. For each cluster — compute stats, call Gemini, upsert
    let detected = 0;
    let lastError: unknown;

    const clusterEntries = [...clusters.entries()];
    for (let i = 0; i < clusterEntries.length; i++) {
      const [clusterIdx, clusterRows] = clusterEntries[i];
      // Small pause between AI calls to stay under per-minute rate limits
      if (i > 0) await new Promise((r) => setTimeout(r, 1_000));
      try {
        const archetype = await this.buildAndSaveArchetype(
          userId,
          clusterIdx,
          clusterRows,
          result.centroids[clusterIdx],
        );
        if (archetype) detected++;
      } catch (err) {
        lastError = err;
        this.logger.error(
          `Failed to build archetype for cluster ${clusterIdx}: ${String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    }

    if (detected === 0 && lastError !== undefined) {
      const msg = lastError instanceof Error ? lastError.message : String(lastError);
      throw new InternalServerErrorException(`Archetype detection failed: ${msg}`);
    }

    this.logger.log(`Detected ${detected} archetypes for user ${userId}`);
    return { detected, listenCount: rows.length };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async buildAndSaveArchetype(
    userId: string,
    _clusterIdx: number,
    rows: Array<{
      playedAt: Date;
      spotifyTrackId: string;
      trackName: string;
      artistName: string;
      albumImageUrl: string | null | undefined;
      energy: number | null;
      moodCategory: string | null;
      vibeVector: number[] | null;
    }>,
    centroid: number[],
  ) {
    // Peak hour
    const hourCounts = new Array(24).fill(0) as number[];
    rows.forEach((r) => hourCounts[new Date(r.playedAt).getHours()]++);
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

    // Peak day of week
    const dayCounts = new Array(7).fill(0) as number[];
    rows.forEach((r) => dayCounts[new Date(r.playedAt).getDay()]++);
    const peakDayOfWeek = dayCounts.indexOf(Math.max(...dayCounts));

    // Dominant moods
    const moodCounts = new Map<string, number>();
    rows.forEach((r) => {
      if (r.moodCategory) {
        moodCounts.set(r.moodCategory, (moodCounts.get(r.moodCategory) ?? 0) + 1);
      }
    });
    const sortedMoods = [...moodCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([m]) => m);
    const primaryMood =
      sortedMoods[0] ??
      (MOOD_CATEGORIES[Math.floor(Math.random() * MOOD_CATEGORIES.length)] as string);

    // Top tracks (by frequency) — also capture album image URL per track
    const trackFreq = new Map<
      string,
      { count: number; label: string; imageUrl: string | null }
    >();
    rows.forEach((r) => {
      const key = r.spotifyTrackId;
      const existing = trackFreq.get(key);
      if (existing) {
        existing.count++;
      } else {
        trackFreq.set(key, {
          count: 1,
          label: `${r.trackName} by ${r.artistName}`,
          imageUrl: r.albumImageUrl ?? null,
        });
      }
    });
    const topByFreq = [...trackFreq.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
    const topTrackIds = topByFreq.map(([id]) => id);
    const topTrackLabels = topByFreq.map(([, v]) => v.label);

    // Deduplicated album image URLs for the top tracks (up to 3)
    const topTrackImageUrls: string[] = [];
    for (const [, v] of topByFreq) {
      if (v.imageUrl && !topTrackImageUrls.includes(v.imageUrl)) {
        topTrackImageUrls.push(v.imageUrl);
        if (topTrackImageUrls.length === 3) break;
      }
    }

    // Top artists (by play count in this cluster)
    const artistCounts = new Map<string, number>();
    rows.forEach((r) => {
      artistCounts.set(r.artistName, (artistCounts.get(r.artistName) ?? 0) + 1);
    });
    const topArtists = [...artistCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name);

    // Last appeared
    const lastAppearedAt = new Date(
      Math.max(...rows.map((r) => new Date(r.playedAt).getTime())),
    );

    // Call AI for name/description/color/icon/style_tags/similar_artists
    const naming = await this.ai.nameArchetype({
      peakHour,
      peakDayOfWeek,
      dominantMoods: sortedMoods.slice(0, 3),
      topTracks: topTrackLabels,
      playCount: rows.length,
    });

    const [saved] = await this.db
      .insert(archetypes)
      .values({
        userId,
        name: naming.name,
        description: naming.description,
        color: naming.color,
        icon: naming.icon,
        peakHour,
        peakDayOfWeek,
        primaryMood,
        trackIds: topTrackIds,
        playCount: rows.length,
        lastAppearedAt,
        styleTags: naming.style_tags ?? [],
        topArtists,
        topTrackImageUrls,
        similarArtists: naming.similar_artists ?? [],
        centroid,
      })
      .returning({ id: archetypes.id });

    return saved;
  }

  // ── Public getters ───────────────────────────────────────────────────────

  async getArchetypesForUser(userId: string) {
    return this.db
      .select()
      .from(archetypes)
      .where(eq(archetypes.userId, userId))
      .orderBy(archetypes.detectedAt);
  }

  // Full replacement re-run: wipe old archetypes then detect fresh
  async redetectForUser(userId: string): Promise<{ detected: number }> {
    await this.db.delete(archetypes).where(eq(archetypes.userId, userId));
    return this.detectArchetypesForUser(userId);
  }

  // ── Spotify playback ─────────────────────────────────────────────────────

  async playArchetype(
    userId: string,
    archetypeId: string,
  ): Promise<{ playing: boolean; noDevice: boolean }> {
    const [archetype] = await this.db
      .select()
      .from(archetypes)
      .where(and(eq(archetypes.id, archetypeId), eq(archetypes.userId, userId)));

    if (!archetype) throw new NotFoundException('Archetype not found');

    const accessToken = await this.spotify.getValidAccessToken(this.db, userId);

    const trackUris = archetype.trackIds.map((id) => `spotify:track:${id}`);
    if (trackUris.length === 0) {
      throw new InternalServerErrorException('No tracks in this archetype');
    }

    try {
      const playing = await this.spotify.playTracks(accessToken, trackUris);
      return { playing, noDevice: !playing };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`playArchetype failed for ${userId}/${archetypeId}: ${msg}`);
      throw new InternalServerErrorException(msg);
    }
  }
}
