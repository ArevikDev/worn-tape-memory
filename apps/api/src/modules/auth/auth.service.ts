import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SpotifyService } from '../spotify/spotify.service';
import { CryptoService } from '../../common/crypto.service';
import type { DrizzleClient } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { AuthUser, JwtPayload } from '@worn-tape-memory/shared';

export const DRIZZLE_CLIENT = 'DRIZZLE_CLIENT';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly spotify: SpotifyService,
    private readonly crypto: CryptoService,
    private readonly jwt: JwtService,
  ) {}

  async exchangeSpotifyCode(code: string, codeVerifier: string): Promise<string> {
    // 1. Exchange code for Spotify tokens
    const tokens = await this.spotify.exchangeCodeForTokens(code, codeVerifier);

    // 2. Fetch Spotify profile
    const profile = await this.spotify.getProfile(tokens.access_token);

    // 3. Encrypt tokens before storage
    const encryptedAccess = this.crypto.encrypt(tokens.access_token);
    const encryptedRefresh = this.crypto.encrypt(tokens.refresh_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // 4. Upsert user — insert or update on spotify_user_id conflict
    const [user] = await this.db
      .insert(users)
      .values({
        spotifyUserId: profile.id,
        email: profile.email ?? null,
        displayName: profile.display_name ?? null,
        avatarUrl: profile.images?.[0]?.url ?? null,
        spotifyAccessToken: encryptedAccess,
        spotifyRefreshToken: encryptedRefresh,
        spotifyTokenExpiresAt: expiresAt,
        lastActiveAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.spotifyUserId,
        set: {
          email: profile.email ?? null,
          displayName: profile.display_name ?? null,
          avatarUrl: profile.images?.[0]?.url ?? null,
          spotifyAccessToken: encryptedAccess,
          spotifyRefreshToken: encryptedRefresh,
          spotifyTokenExpiresAt: expiresAt,
          lastActiveAt: new Date(),
        },
      })
      .returning();

    this.logger.log(`Upserted user ${user.id} (spotify: ${profile.id})`);

    // 5. Sign and return a JWT — cookie is set by the controller
    const payload: JwtPayload = { sub: user.id, spotifyUserId: profile.id };
    return this.jwt.sign(payload);
  }

  async getMe(userId: string): Promise<AuthUser> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    return {
      id: user.id,
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      avatarUrl: user.avatarUrl ?? null,
      spotifyUserId: user.spotifyUserId,
    };
  }
}
