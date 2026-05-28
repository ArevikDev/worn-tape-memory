import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { SpotifyModule } from './modules/spotify/spotify.module';
import { SyncModule } from './modules/sync/sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // BullMQ — parse REDIS_URL for host/port
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.getOrThrow<string>('REDIS_URL'));
        return {
          connection: {
            host: url.hostname,
            port: parseInt(url.port, 10) || 6379,
          },
        };
      },
    }),

    // Cron scheduler
    ScheduleModule.forRoot(),

    AuthModule,
    SpotifyModule,
    SyncModule,
  ],
})
export class AppModule {}
