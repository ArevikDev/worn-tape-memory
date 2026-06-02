import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { SpotifyModule } from '../spotify/spotify.module';
import { ArchetypesController } from './archetypes.controller';
import { ArchetypesService } from './archetypes.service';

@Module({
  imports: [AuthModule, AiModule, SpotifyModule],
  controllers: [ArchetypesController],
  providers: [ArchetypesService],
  exports: [ArchetypesService],
})
export class ArchetypesModule {}
