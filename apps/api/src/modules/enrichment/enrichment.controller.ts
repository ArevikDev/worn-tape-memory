import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EnrichmentService } from './enrichment.service';

@Controller('admin')
export class EnrichmentController {
  constructor(private readonly enrichment: EnrichmentService) {}

  // Queues all un-enriched tracks for AI processing.
  // Call once after syncing to kick off the pipeline.
  @Post('enrich/backfill')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  backfill(): Promise<{ queued: number }> {
    return this.enrichment.backfillEnrichment();
  }
}
