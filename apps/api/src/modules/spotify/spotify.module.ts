import { Module } from '@nestjs/common';
import { SpotifyService } from './spotify.service';
import { CryptoService } from '../../common/crypto.service';

@Module({
  providers: [SpotifyService, CryptoService],
  exports: [SpotifyService],
})
export class SpotifyModule {}
