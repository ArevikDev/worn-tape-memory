import { Controller, Get, Param, Post, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ArchetypesService } from './archetypes.service';

@Controller('archetypes')
@UseGuards(JwtAuthGuard)
export class ArchetypesController {
  constructor(private readonly archetypes: ArchetypesService) {}

  // GET /archetypes — return the current user's archetypes
  @Get()
  getMyArchetypes(@Request() req: { user: { userId: string } }) {
    return this.archetypes.getArchetypesForUser(req.user.userId);
  }

  // POST /archetypes/detect — run detection (additive, keeps existing)
  @Post('detect')
  detectMyArchetypes(@Request() req: { user: { userId: string } }) {
    return this.archetypes.detectArchetypesForUser(req.user.userId);
  }

  // POST /archetypes/redetect — wipe and re-run fresh
  @Post('redetect')
  redetectMyArchetypes(@Request() req: { user: { userId: string } }) {
    return this.archetypes.redetectForUser(req.user.userId);
  }

  // POST /archetypes/:id/play — start immediate Spotify playback for this archetype
  @Post(':id/play')
  playArchetype(
    @Request() req: { user: { userId: string } },
    @Param('id') archetypeId: string,
  ) {
    return this.archetypes.playArchetype(req.user.userId, archetypeId);
  }
}
