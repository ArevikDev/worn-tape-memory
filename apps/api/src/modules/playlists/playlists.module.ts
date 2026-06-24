import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SpotifyModule } from '../spotify/spotify.module';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';
import { CoverArtService } from './cover-art.service';

@Module({
  imports: [AuthModule, SpotifyModule],
  controllers: [PlaylistsController],
  providers: [PlaylistsService, CoverArtService],
})
export class PlaylistsModule {}
