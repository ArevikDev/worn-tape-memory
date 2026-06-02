import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SpotifyModule } from '../spotify/spotify.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { SpotifyController } from '../spotify/spotify.controller';

@Module({
  imports: [
    AuthModule, // DRIZZLE_CLIENT + JwtModule (for JwtAuthGuard)
    SpotifyModule, // SpotifyService (for now-playing)
  ],
  controllers: [StatsController, SpotifyController],
  providers: [StatsService],
})
export class StatsModule {}
