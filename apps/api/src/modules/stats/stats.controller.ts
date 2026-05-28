import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StatsService } from './stats.service';
import type { UserStats } from '@worn-tape-memory/shared';

interface AuthenticatedRequest extends Request {
  user: { userId: string; spotifyUserId: string };
}

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyStats(@Req() req: AuthenticatedRequest): Promise<UserStats> {
    return this.stats.getStatsForUser(req.user.userId);
  }
}
