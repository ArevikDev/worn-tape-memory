import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import type { JwtPayload } from '@worn-tape-memory/shared';

// Extract JWT from the httpOnly cookie named 'token'
function extractJwtFromCookie(req: Request): string | null {
  const cookies = req?.cookies as Record<string, string | undefined> | undefined;
  return cookies?.token ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractJwtFromCookie]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // passport calls this after verifying the JWT signature
  validate(payload: JwtPayload): { userId: string; spotifyUserId: string } {
    return { userId: payload.sub, spotifyUserId: payload.spotifyUserId };
  }
}
