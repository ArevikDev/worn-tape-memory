import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import type { DrizzleClient } from '../../db';
import { listens, tracks } from '../../db/schema';
import { DRIZZLE_CLIENT } from '../auth/auth.service';
import type { MoodMapPoint, MoodMapRange } from '@worn-tape-memory/shared';
import { normalizePoints, projectTo2d } from './pca.util';

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

    const rows = await this.db
      .select({
        spotifyTrackId: tracks.spotifyTrackId,
        trackName: tracks.name,
        artistName: tracks.artistName,
        albumImageUrl: tracks.albumImageUrl,
        moodCategory: tracks.moodCategory,
        vibeVector: tracks.vibeVector,
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
      .limit(600);

    if (rows.length === 0) return [];

    const vectors = rows.map((r) => r.vibeVector as number[]);
    const projected = projectTo2d(vectors);
    const normalized = normalizePoints(projected);

    return rows.map((r, i) => ({
      x: normalized[i][0],
      y: normalized[i][1],
      spotifyTrackId: r.spotifyTrackId,
      trackName: r.trackName,
      artistName: r.artistName,
      moodCategory: r.moodCategory,
      albumImageUrl: r.albumImageUrl ?? null,
      spotifyUri: r.spotifyUri,
      playCount: r.playCount,
    }));
  }
}
