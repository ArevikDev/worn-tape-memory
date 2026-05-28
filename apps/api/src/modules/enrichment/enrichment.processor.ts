import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ENRICH_TRACK_QUEUE, EnrichTrackJobData } from './enrichment.constants';
import { EnrichmentService } from './enrichment.service';

@Processor(ENRICH_TRACK_QUEUE, { concurrency: 2 })
export class EnrichTrackProcessor extends WorkerHost {
  private readonly logger = new Logger(EnrichTrackProcessor.name);

  constructor(private readonly enrichment: EnrichmentService) {
    super();
  }

  async process(job: Job<EnrichTrackJobData>): Promise<void> {
    this.logger.debug(`Processing enrichment job for track ${job.data.spotifyTrackId}`);
    await this.enrichment.enrichTrack(job.data.spotifyTrackId);
  }
}
