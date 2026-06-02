import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from '../../common/crypto.service';
import { DrizzleClient } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';

export interface SpotifyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface SpotifyProfile {
  id: string;
  display_name: string;
  email: string;
  images: { url: string }[];
}

export interface SpotifyCurrentlyPlaying {
  is_playing: boolean;
  progress_ms: number;
  item: {
    id: string;
    name: string;
    uri: string;
    duration_ms: number;
    artists: { name: string }[];
    album: { name: string; images: { url: string }[] };
  } | null;
}

@Injectable()
export class SpotifyService {
  private readonly logger = new Logger(SpotifyService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
  ) {
    this.clientId = this.config.getOrThrow('SPOTIFY_CLIENT_ID');
    this.clientSecret = this.config.getOrThrow('SPOTIFY_CLIENT_SECRET');
    this.redirectUri = this.config.getOrThrow('SPOTIFY_REDIRECT_URI');
  }

  // Exchange authorization code for tokens (PKCE flow)
  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
  ): Promise<SpotifyTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      code_verifier: codeVerifier,
    });

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Spotify token exchange failed: ${error}`);
      throw new UnauthorizedException('Spotify token exchange failed');
    }

    return response.json() as Promise<SpotifyTokenResponse>;
  }

  // Refresh access token proactively — call when expires_at < now + 60s
  async refreshAccessToken(
    encryptedRefreshToken: string,
  ): Promise<SpotifyTokenResponse> {
    const refreshToken = this.crypto.decrypt(encryptedRefreshToken);

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Spotify token refresh failed: ${error}`);
      throw new UnauthorizedException('Spotify token refresh failed');
    }

    return response.json() as Promise<SpotifyTokenResponse>;
  }

  // Get profile for the authenticated user
  async getProfile(accessToken: string): Promise<SpotifyProfile> {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to fetch Spotify profile');
    }

    return response.json() as Promise<SpotifyProfile>;
  }

  // Returns null if nothing is currently playing (Spotify returns 204)
  async getCurrentlyPlaying(
    accessToken: string,
  ): Promise<SpotifyCurrentlyPlaying | null> {
    const response = await fetch(
      'https://api.spotify.com/v1/me/player/currently-playing',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (response.status === 204) return null; // nothing playing
    if (!response.ok) return null; // treat errors as "nothing playing"

    return response.json() as Promise<SpotifyCurrentlyPlaying>;
  }

  // Start immediate playback of track URIs on the user's active Spotify device.
  // Returns false when no active device exists (user needs to open Spotify first).
  async playTracks(accessToken: string, uris: string[]): Promise<boolean> {
    const response = await fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris }),
    });

    if (response.status === 204 || response.status === 202) return true;
    if (response.status === 404) return false; // no active device

    const err = await response.text();
    throw new Error(
      `Spotify playTracks ${response.status}: ${err.slice(0, 200)}`,
    );
  }

  // Refreshes proactively if the token expires within 60 seconds.
  async getValidAccessToken(
    db: DrizzleClient,
    userId: string,
  ): Promise<string> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new UnauthorizedException('User not found');

    const expiresAt = user.spotifyTokenExpiresAt.getTime();
    const nowPlusSixtySeconds = Date.now() + 60_000;

    if (expiresAt > nowPlusSixtySeconds) {
      return this.crypto.decrypt(user.spotifyAccessToken);
    }

    // Token is about to expire — refresh it
    this.logger.log(`Proactive token refresh for user ${userId}`);
    const tokens = await this.refreshAccessToken(user.spotifyRefreshToken);

    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await db
      .update(users)
      .set({
        spotifyAccessToken: this.crypto.encrypt(tokens.access_token),
        // Spotify may or may not return a new refresh token
        ...(tokens.refresh_token
          ? { spotifyRefreshToken: this.crypto.encrypt(tokens.refresh_token) }
          : {}),
        spotifyTokenExpiresAt: newExpiresAt,
      })
      .where(eq(users.id, userId));

    return tokens.access_token;
  }
}
