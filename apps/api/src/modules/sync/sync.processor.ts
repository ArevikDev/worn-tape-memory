import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SYNC_LISTENS_QUEUE, SyncListensJobData } from './sync.constants';
import { SyncService } from './sync.service';

@Processor(SYNC_LISTENS_QUEUE)
export class SyncListensProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncListensProcessor.name);

  constructor(private readonly sync: SyncService) {
    super();
  }

  async process(job: Job<SyncListensJobData>): Promise<void> {
    const { userId } = job.data;
    this.logger.log(`Processing sync job ${job.id} for user ${userId}`);
    const { inserted } = await this.sync.syncListensForUser(userId);
    this.logger.log(`Job ${job.id} done — ${inserted} listens inserted`);
  }
}
