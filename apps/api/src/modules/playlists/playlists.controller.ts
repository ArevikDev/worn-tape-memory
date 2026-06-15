import { Controller, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlaylistsService, PlaylistExportResult } from './playlists.service';

@UseGuards(JwtAuthGuard)
@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlists: PlaylistsService) {}

  @Post('export/:archetypeId')
  exportArchetype(
    @Param('archetypeId') archetypeId: string,
    @Request() req: { user: { userId: string } },
  ): Promise<PlaylistExportResult> {
    return this.playlists.exportArchetypeAsPlaylist(req.user.userId, archetypeId);
  }
}
