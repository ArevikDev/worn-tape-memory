import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService, DRIZZLE_CLIENT } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { SpotifyModule } from '../spotify/spotify.module';
import { CryptoService } from '../../common/crypto.service';
import { createDrizzleClient } from '../../db';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
    SpotifyModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    CryptoService,
    {
      provide: DRIZZLE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createDrizzleClient(config.getOrThrow('DATABASE_URL')),
    },
  ],
  exports: [DRIZZLE_CLIENT, JwtModule],
})
export class AuthModule {}
