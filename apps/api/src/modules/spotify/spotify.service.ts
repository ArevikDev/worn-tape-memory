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

interface SpotifyArtistResult {
  id: string;
  name: string;
  external_urls: { spotify: string };
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
  private readonly redirectUri: string;

  constructor(
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
  ) {
    this.clientId = this.config.getOrThrow('SPOTIFY_CLIENT_ID');
    this.redirectUri = this.config.getOrThrow('SPOTIFY_REDIRECT_URI');
  }

  // Exchange authorization code for tokens (PKCE flow)
  async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<SpotifyTokenResponse> {
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
  async refreshAccessToken(encryptedRefreshToken: string): Promise<SpotifyTokenResponse> {
    const refreshToken = this.crypto.decrypt(encryptedRefreshToken);

    // PKCE refresh must not include client_secret — only client_id
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
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
  async getCurrentlyPlaying(accessToken: string): Promise<SpotifyCurrentlyPlaying | null> {
    const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 204) return null; // nothing playing
    if (!response.ok) return null; // treat errors as "nothing playing"

    return response.json() as Promise<SpotifyCurrentlyPlaying>;
  }

  // Search for an artist by name, fetch their top tracks, and start playback.
  // Returns spotifyUri (app deep link) and artistUrl (web fallback) for the caller.
  async playArtist(
    accessToken: string,
    artistName: string,
  ): Promise<{ playing: boolean; noDevice: boolean; spotifyUri: string; artistUrl: string }> {
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!searchRes.ok) {
      const err = await searchRes.text();
      throw new Error(`Spotify artist search ${searchRes.status}: ${err.slice(0, 200)}`);
    }

    const searchData = (await searchRes.json()) as { artists: { items: SpotifyArtistResult[] } };
    const artist = searchData.artists?.items?.[0];
    if (!artist) return { playing: false, noDevice: false, spotifyUri: '', artistUrl: '' };

    const spotifyUri = `spotify:artist:${artist.id}`;
    const artistUrl =
      artist.external_urls?.spotify ??
      `https://open.spotify.com/search/${encodeURIComponent(artistName)}`;

    const topRes = await fetch(
      `https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=from_token`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!topRes.ok) return { playing: false, noDevice: false, spotifyUri, artistUrl };

    const topData = (await topRes.json()) as { tracks: { uri: string }[] };
    const trackUris = topData.tracks.map((t) => t.uri).slice(0, 10);
    if (trackUris.length === 0) return { playing: false, noDevice: false, spotifyUri, artistUrl };

    const playing = await this.playTracks(accessToken, trackUris);
    return { playing, noDevice: !playing, spotifyUri, artistUrl };
  }

  // ── Playlist management ──────────────────────────────────────────────────

  /** Create a private playlist and return its Spotify ID + URL. */
  async createPlaylist(
    accessToken: string,
    name: string,
    description: string,
  ): Promise<{ id: string; url: string }> {
    // Use /me/playlists — avoids 403s from user-id mismatches on the /users/{id} endpoint
    const response = await fetch(`https://api.spotify.com/v1/me/playlists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      // Create playlists as private by default to reduce required scopes.
      body: JSON.stringify({ name, description, public: false }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Spotify createPlaylist ${response.status}: ${err.slice(0, 200)}`);
    }

    const data = (await response.json()) as { id: string; external_urls?: { spotify: string } };
    return { id: data.id, url: data.external_urls?.spotify ?? '' };
  }

  /**
   * Replace a playlist's tracks with the given URIs.
   * Handles batching: PUT for the first 100 (replaces), POST for each subsequent batch (300ms gap, appends).
   */
  async setPlaylistTracks(accessToken: string, playlistId: string, uris: string[]): Promise<void> {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const batches: string[][] = [];
    for (let i = 0; i < uris.length; i += 100) batches.push(uris.slice(i, i + 100));
    if (batches.length === 0) batches.push([]);

    for (let i = 0; i < batches.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 300));
      const method = i === 0 ? 'PUT' : 'POST';
      // /tracks was retired in Spotify's Feb 2026 API migration — use /items
      const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items`, {
        method,
        headers,
        body: JSON.stringify({ uris: batches[i] }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Spotify setPlaylistTracks ${method} ${res.status}: ${err.slice(0, 200)}`);
      }
    }
  }

  async uploadPlaylistCover(
    accessToken: string,
    playlistId: string,
    jpegBuffer: Buffer,
  ): Promise<void> {
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/images`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'image/jpeg',
      },
      body: jpegBuffer.toString('base64'),
    });
    if (response.status === 202) return;
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Spotify uploadPlaylistCover ${response.status}: ${err.slice(0, 200)}`);
    }
  }

  // ── Playback ─────────────────────────────────────────────────────────────

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
    throw new Error(`Spotify playTracks ${response.status}: ${err.slice(0, 200)}`);
  }

  // Refreshes proactively if the token expires within 60 seconds.
  async getValidAccessToken(db: DrizzleClient, userId: string): Promise<string> {
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
