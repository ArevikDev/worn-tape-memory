import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import type { DrizzleClient } from '../../db';
import { listens, tracks } from '../../db/schema';
import { DRIZZLE_CLIENT } from '../auth/auth.service';
import type { UserStats } from '@worn-tape-memory/shared';

@Injectable()
export class StatsService {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async getStatsForUser(userId: string): Promise<UserStats> {
    const [totalRow, uniqueTracksRow, uniqueArtistsRow, topTracks, topArtists, recentListens] =
      await Promise.all([
        // Total listen count
        this.db
          .select({ count: sql<number>`cast(count(*) as int)` })
          .from(listens)
          .where(eq(listens.userId, userId)),

        // Unique tracks played
        this.db
          .select({ count: sql<number>`cast(count(distinct ${listens.trackId}) as int)` })
          .from(listens)
          .where(eq(listens.userId, userId)),

        // Unique artists played
        this.db
          .select({ count: sql<number>`cast(count(distinct ${tracks.artistName}) as int)` })
          .from(listens)
          .innerJoin(tracks, eq(listens.trackId, tracks.id))
          .where(eq(listens.userId, userId)),

        // Top 10 tracks by play count
        this.db
          .select({
            name: tracks.name,
            artistName: tracks.artistName,
            albumImageUrl: tracks.albumImageUrl,
            spotifyUri: tracks.spotifyUri,
            playCount: sql<number>`cast(count(*) as int)`,
          })
          .from(listens)
          .innerJoin(tracks, eq(listens.trackId, tracks.id))
          .where(eq(listens.userId, userId))
          .groupBy(
            tracks.id,
            tracks.name,
            tracks.artistName,
            tracks.albumImageUrl,
            tracks.spotifyUri,
          )
          .orderBy(desc(sql`count(*)`))
          .limit(10),

        // Top 10 artists by play count
        this.db
          .select({
            artistName: tracks.artistName,
            playCount: sql<number>`cast(count(*) as int)`,
          })
          .from(listens)
          .innerJoin(tracks, eq(listens.trackId, tracks.id))
          .where(eq(listens.userId, userId))
          .groupBy(tracks.artistName)
          .orderBy(desc(sql`count(*)`))
          .limit(10),

        // 20 most recent listens
        this.db
          .select({
            name: tracks.name,
            artistName: tracks.artistName,
            albumImageUrl: tracks.albumImageUrl,
            playedAt: listens.playedAt,
          })
          .from(listens)
          .innerJoin(tracks, eq(listens.trackId, tracks.id))
          .where(eq(listens.userId, userId))
          .orderBy(desc(listens.playedAt))
          .limit(20),
      ]);

    return {
      totalListens: totalRow[0]?.count ?? 0,
      uniqueTracks: uniqueTracksRow[0]?.count ?? 0,
      uniqueArtists: uniqueArtistsRow[0]?.count ?? 0,
      topTracks,
      topArtists,
      recentListens: recentListens.map((r) => ({
        ...r,
        playedAt: r.playedAt.toISOString(),
      })),
    };
  }
}
