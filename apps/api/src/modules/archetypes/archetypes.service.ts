import { Inject, Injectable, Logger } from '@nestjs/common';
import { kmeans } from 'ml-kmeans';
import { eq, isNotNull } from 'drizzle-orm';
import type { DrizzleClient } from '../../db';
import { listens, tracks, archetypes } from '../../db/schema';
import { DRIZZLE_CLIENT } from '../auth/auth.service';
import { AiService } from '../ai/ai.service';

// Feature vector dimensions:
// [0] hour / 23          (0–1)
// [1] dayOfWeek / 6      (0–1)
// [2] energy / 10        (0–1, 0 if not enriched)
// [3..10] vibe_vector    (8 dims, –1 to 1)
const FEATURE_DIM = 11;
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
  ) {}

  // ── Core detection ───────────────────────────────────────────────────────

  async detectArchetypesForUser(userId: string): Promise<{ detected: number }> {
    // 1. Fetch all listens with their enriched track data
    const rawRows = await this.db
      .select({
        playedAt: listens.playedAt,
        spotifyTrackId: listens.spotifyTrackId,
        trackName: tracks.name,
        artistName: tracks.artistName,
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

    // Need at least 9 listens to cluster into 3 groups
    if (rows.length < 9) {
      this.logger.log(
        `Not enough listens to detect archetypes for user ${userId} (${rows.length} listens)`,
      );
      return { detected: 0 };
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
          : new Array(8).fill(0) as number[];
      return [hour, dow, energy, ...vibe];
    });

    // 3. Determine k (3–5 clusters depending on data volume)
    const k = rows.length >= 200 ? 5 : rows.length >= 80 ? 4 : 3;

    const result = kmeans(features, k, { maxIterations: 100 });

    // 4. Group rows by cluster assignment
    const clusters = new Map<number, typeof rows>();
    result.clusters.forEach((clusterIdx, i) => {
      if (!clusters.has(clusterIdx)) clusters.set(clusterIdx, []);
      clusters.get(clusterIdx)!.push(rows[i]);
    });

    // 5. For each cluster — compute stats, call Gemini, upsert
    let detected = 0;

    for (const [clusterIdx, clusterRows] of clusters) {
      try {
        const archetype = await this.buildAndSaveArchetype(
          userId,
          clusterIdx,
          clusterRows,
          result.centroids[clusterIdx],
        );
        if (archetype) detected++;
      } catch (err) {
        this.logger.error(`Failed to build archetype for cluster ${clusterIdx}: ${String(err)}`);
      }
    }

    this.logger.log(`Detected ${detected} archetypes for user ${userId}`);
    return { detected };
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

    // Top tracks (by frequency)
    const trackFreq = new Map<string, { count: number; label: string }>();
    rows.forEach((r) => {
      const key = r.spotifyTrackId;
      const existing = trackFreq.get(key);
      if (existing) {
        existing.count++;
      } else {
        trackFreq.set(key, { count: 1, label: `${r.trackName} by ${r.artistName}` });
      }
    });
    const topByFreq = [...trackFreq.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
    const topTrackIds = topByFreq.map(([id]) => id);
    const topTrackLabels = topByFreq.map(([, v]) => v.label);

    // Last appeared
    const lastAppearedAt = new Date(
      Math.max(...rows.map((r) => new Date(r.playedAt).getTime())),
    );

    // Call Gemini for name/description/color/icon
    const naming = await this.ai.nameArchetype({
      peakHour,
      peakDayOfWeek,
      dominantMoods: sortedMoods.slice(0, 3),
      topTracks: topTrackLabels,
      playCount: rows.length,
    });

    // Upsert — match on userId + primaryMood + peakHour (same "slot" = same archetype)
    // Simple strategy: delete old ones for this user, re-insert all fresh each run
    // (We do a full replace per detection run — called infrequently)
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
}
