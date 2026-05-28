import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DRIZZLE_CLIENT } from '../auth/auth.service';
import { SpotifyService } from './spotify.service';
import type { DrizzleClient } from '../../db';
import type { NowPlaying } from '@worn-tape-memory/shared';

interface AuthenticatedRequest extends Request {
  user: { userId: string; spotifyUserId: string };
}

@Controller('spotify')
export class SpotifyController {
  constructor(
    private readonly spotify: SpotifyService,
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
  ) {}

  @Get('now-playing')
  @UseGuards(JwtAuthGuard)
  async getNowPlaying(@Req() req: AuthenticatedRequest): Promise<NowPlaying | null> {
    const accessToken = await this.spotify.getValidAccessToken(this.db, req.user.userId);
    const data = await this.spotify.getCurrentlyPlaying(accessToken);

    if (!data || !data.item || !data.is_playing) return null;

    return {
      trackName: data.item.name,
      artistName: data.item.artists.map((a) => a.name).join(', '),
      albumName: data.item.album.name,
      albumImageUrl: data.item.album.images[0]?.url ?? null,
      spotifyUri: data.item.uri,
      progressMs: data.progress_ms,
      durationMs: data.item.duration_ms,
    };
  }
}
