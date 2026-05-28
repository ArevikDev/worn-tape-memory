import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, isNull } from 'drizzle-orm';
import type { DrizzleClient } from '../../db';
import { tracks } from '../../db/schema';
import { DRIZZLE_CLIENT } from '../auth/auth.service';
import { AiService } from '../ai/ai.service';
import { ENRICH_TRACK_QUEUE, EnrichTrackJobData } from './enrichment.constants';

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly ai: AiService,
    @InjectQueue(ENRICH_TRACK_QUEUE) private readonly enrichQueue: Queue<EnrichTrackJobData>,
  ) {}

  // ── Core enrichment logic ────────────────────────────────────────────────

  async enrichTrack(spotifyTrackId: string): Promise<void> {
    const [track] = await this.db
      .select()
      .from(tracks)
      .where(eq(tracks.spotifyTrackId, spotifyTrackId));

    if (!track) {
      this.logger.warn(`Track not found: ${spotifyTrackId}`);
      return;
    }

    if (track.enrichedAt) {
      this.logger.debug(`Already enriched: "${track.name}", skipping`);
      return;
    }

    const enrichment = await this.ai.enrichTrack({
      name: track.name,
      artist: track.artistName,
      album: track.albumName,
      year: track.releaseYear ?? undefined,
    });

    await this.db
      .update(tracks)
      .set({
        moodTags: enrichment.mood_tags,
        moodCategory: enrichment.mood_category,
        energy: enrichment.energy,
        vibeVector: enrichment.vibe_vector,
        enrichedAt: new Date(),
      })
      .where(eq(tracks.spotifyTrackId, spotifyTrackId));

    this.logger.log(
      `Enriched "${track.name}" → ${enrichment.mood_category} [${enrichment.mood_tags.join(', ')}]`,
    );
  }

  // ── Queue helpers ────────────────────────────────────────────────────────

  async enqueueEnrichTrack(spotifyTrackId: string): Promise<void> {
    await this.enrichQueue.add(
      'enrich-track',
      { spotifyTrackId },
      {
        // Using spotifyTrackId as jobId deduplicates — won't queue the same track twice
        jobId: `enrich-${spotifyTrackId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
      },
    );
  }


  async backfillEnrichment(): Promise<{ queued: number }> {
    const unenriched = await this.db
      .select({ spotifyTrackId: tracks.spotifyTrackId })
      .from(tracks)
      .where(isNull(tracks.enrichedAt));

    for (const track of unenriched) {
      await this.enqueueEnrichTrack(track.spotifyTrackId);
    }

    this.logger.log(`Backfill: queued ${unenriched.length} tracks for enrichment`);
    return { queued: unenriched.length };
  }
}
