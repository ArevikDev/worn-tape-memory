import { Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncService } from './sync.service';

interface AuthenticatedRequest extends Request {
  user: { userId: string; spotifyUserId: string };
}

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  // Manual trigger — runs sync inline and returns the count immediately.
  // Production syncs go through the queue via scheduledSync().
  @Post('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  syncMe(@Req() req: AuthenticatedRequest): Promise<{ inserted: number }> {
    return this.sync.syncListensForUser(req.user.userId);
  }
}
