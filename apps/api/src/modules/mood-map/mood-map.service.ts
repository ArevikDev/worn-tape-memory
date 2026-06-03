import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import type { DrizzleClient } from '../../db';
import { archetypes, listens, tracks } from '../../db/schema';
import { DRIZZLE_CLIENT } from '../auth/auth.service';
import type { MoodMapPoint, MoodMapRange } from '@worn-tape-memory/shared';
import { normalizePoints, projectTo2d } from './pca.util';

interface ArchInfo {
  id: string;
  name: string;
  color: string;
  // vibe subvector: last 8 dims of the stored 11-dim centroid [hour, dow, energy, v0..v7]
  vibeCentroid: number[] | null;
}

function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

@Injectable()
export class MoodMapService {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async getMapForUser(userId: string, range: MoodMapRange): Promise<MoodMapPoint[]> {
    const cutoff =
      range === '3m'
        ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        : range === '1m'
          ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          : null;

    const [rows, userArchetypes] = await Promise.all([
      this.db
        .select({
          spotifyTrackId: tracks.spotifyTrackId,
          trackName: tracks.name,
          artistName: tracks.artistName,
          albumImageUrl: tracks.albumImageUrl,
          moodCategory: tracks.moodCategory,
          vibeVector: tracks.vibeVector,
          genreTags: tracks.genreTags,
          spotifyUri: tracks.spotifyUri,
          playCount: sql<number>`count(${listens.id})::int`,
        })
        .from(listens)
        .innerJoin(tracks, eq(listens.trackId, tracks.id))
        .where(
          and(
            eq(listens.userId, userId),
            isNotNull(tracks.vibeVector),
            ...(cutoff ? [gte(listens.playedAt, cutoff)] : []),
          ),
        )
        .groupBy(tracks.id)
        .orderBy(sql`count(${listens.id}) desc`)
        .limit(600),

      this.db
        .select({
          id: archetypes.id,
          name: archetypes.name,
          color: archetypes.color,
          trackIds: archetypes.trackIds,
          centroid: archetypes.centroid,
        })
        .from(archetypes)
        .where(eq(archetypes.userId, userId)),
    ]);

    if (rows.length === 0) return [];

    // Build ArchInfo list — only archetypes that have a stored centroid
    const archInfoList: ArchInfo[] = userArchetypes
      .map((a) => ({
        id: a.id,
        name: a.name,
        color: a.color,
        // centroid layout: [hour/23, dow/6, energy/10, v0..v7] — vibe starts at index 3
        vibeCentroid: a.centroid && a.centroid.length >= 11 ? a.centroid.slice(3) : null,
      }))
      .filter((a) => a.vibeCentroid !== null);

    // Exact match: tracks that are explicitly listed in an archetype's trackIds
    const exactMatch = new Map<string, ArchInfo>();
    for (const ua of userArchetypes) {
      const info = archInfoList.find((a) => a.id === ua.id);
      if (!info) continue;
      for (const trackId of ua.trackIds) {
        if (!exactMatch.has(trackId)) exactMatch.set(trackId, info);
      }
    }

    // Nearest-centroid fallback for tracks not in any archetype's trackIds
    const nearestByVibe = (vibe: number[]): ArchInfo | null => {
      let best: ArchInfo | null = null;
      let bestDist = Infinity;
      for (const arch of archInfoList) {
        if (!arch.vibeCentroid) continue;
        const d = euclidean(vibe, arch.vibeCentroid);
        if (d < bestDist) {
          bestDist = d;
          best = arch;
        }
      }
      return best;
    };

    const vectors = rows.map((r) => r.vibeVector as number[]);
    const projected = projectTo2d(vectors);
    const normalized = normalizePoints(projected);

    return rows.map((r, i) => {
      const vibe = r.vibeVector as number[];
      const arch = exactMatch.get(r.spotifyTrackId) ?? nearestByVibe(vibe);
      return {
        x: normalized[i][0],
        y: normalized[i][1],
        spotifyTrackId: r.spotifyTrackId,
        trackName: r.trackName,
        artistName: r.artistName,
        moodCategory: r.moodCategory,
        albumImageUrl: r.albumImageUrl ?? null,
        spotifyUri: r.spotifyUri,
        playCount: r.playCount,
        archetypeId: arch?.id ?? null,
        archetypeColor: arch?.color ?? null,
        archetypeName: arch?.name ?? null,
        primaryStyle: r.genreTags?.[0] ?? null,
      };
    });
  }
}
