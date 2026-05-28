import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { SpotifyModule } from '../spotify/spotify.module';
import { EnrichmentModule } from '../enrichment/enrichment.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncListensProcessor } from './sync.processor';
import { SYNC_LISTENS_QUEUE } from './sync.constants';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    SpotifyModule,
    EnrichmentModule,
    BullModule.registerQueue({ name: SYNC_LISTENS_QUEUE }),
  ],
  controllers: [SyncController],
  providers: [SyncService, SyncListensProcessor],
  exports: [SyncService],
})
export class SyncModule {}
