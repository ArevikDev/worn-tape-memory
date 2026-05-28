import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { EnrichmentController } from './enrichment.controller';
import { EnrichmentService } from './enrichment.service';
import { EnrichTrackProcessor } from './enrichment.processor';
import { ENRICH_TRACK_QUEUE } from './enrichment.constants';

@Module({
  imports: [
    AuthModule,
    AiModule,
    BullModule.registerQueue({ name: ENRICH_TRACK_QUEUE }),
  ],
  controllers: [EnrichmentController],
  providers: [EnrichmentService, EnrichTrackProcessor],
  exports: [EnrichmentService],
})
export class EnrichmentModule {}
