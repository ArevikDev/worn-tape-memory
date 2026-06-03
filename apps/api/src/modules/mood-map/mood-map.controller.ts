import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MoodMapService } from './mood-map.service';
import type { MoodMapRange } from '@worn-tape-memory/shared';

@UseGuards(JwtAuthGuard)
@Controller('mood-map')
export class MoodMapController {
  constructor(private readonly moodMap: MoodMapService) {}

  @Get()
  getMap(
    @Request() req: { user: { userId: string } },
    @Query('range') range = 'all',
  ): Promise<unknown> {
    const validRange: MoodMapRange = ['3m', '1m'].includes(range)
      ? (range as MoodMapRange)
      : 'all';
    return this.moodMap.getMapForUser(req.user.userId, validRange);
  }
}
