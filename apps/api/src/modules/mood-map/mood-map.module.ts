import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MoodMapController } from './mood-map.controller';
import { MoodMapService } from './mood-map.service';

@Module({
  imports: [AuthModule],
  controllers: [MoodMapController],
  providers: [MoodMapService],
})
export class MoodMapModule {}
