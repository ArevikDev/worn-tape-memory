import { Controller, HttpCode, Post } from '@nestjs/common';
import { EnrichmentService } from './enrichment.service';

// Admin-only maintenance endpoints — no auth guard (localhost-only in dev;
// protect via firewall / internal network in production).
@Controller('admin')
export class EnrichmentController {
  constructor(private readonly enrichment: EnrichmentService) {}

  // Queues all un-enriched tracks for AI processing.
  @Post('enrich/backfill')
  @HttpCode(200)
  backfill(): Promise<{ queued: number }> {
    return this.enrichment.backfillEnrichment();
  }

  // Re-enriches tracks that are missing genre_tags (added after initial enrichment).
  @Post('enrich/backfill-genre')
  @HttpCode(200)
  backfillGenre(): Promise<{ queued: number }> {
    return this.enrichment.backfillGenreTags();
  }

  // Clears failed jobs so they can be re-queued after fixing the AI provider.
  @Post('enrich/clear-failed')
  @HttpCode(200)
  clearFailed(): Promise<{ cleared: number }> {
    return this.enrichment.clearFailedJobs();
  }
}
