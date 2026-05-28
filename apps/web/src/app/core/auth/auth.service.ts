import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { generateCodeChallenge, generateCodeVerifier } from './pkce.util';
import type { AuthUser } from '@worn-tape-memory/shared';

const SPOTIFY_SCOPES = [
  'user-read-recently-played',
  'user-top-read',
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-modify-private',
  'playlist-modify-public',
  'playlist-read-private',
  'ugc-image-upload',
].join(' ');

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const CLIENT_ID = '80e2a4b2df924997992891983413233f';
const REDIRECT_URI = 'http://127.0.0.1:4200/auth/callback';
const API_BASE = 'http://127.0.0.1:3000';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  // Null = unknown (not yet checked), false = not logged in, AuthUser = logged in
  readonly currentUser = signal<AuthUser | null | false>(null);

  async initiateSpotifyLogin(): Promise<void> {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);

    // Store verifier — callback route reads it back after redirect
    sessionStorage.setItem('pkce_verifier', verifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: SPOTIFY_SCOPES,
      redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });

    window.location.href = `${SPOTIFY_AUTH_URL}?${params}`;
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${API_BASE}/auth/spotify/exchange`,
        { code, code_verifier: codeVerifier },
        { withCredentials: true },
      ),
    );
  }

  async logout(): Promise<void> {
    await firstValueFrom(
      this.http.post(`${API_BASE}/auth/logout`, {}, { withCredentials: true }),
    );
    this.currentUser.set(false);
  }

  async loadCurrentUser(): Promise<AuthUser | false> {
    try {
      const user = await firstValueFrom(
        this.http.get<AuthUser>(`${API_BASE}/auth/me`, { withCredentials: true }),
      );
      this.currentUser.set(user);
      return user;
    } catch {
      this.currentUser.set(false);
      return false;
    }
  }
}
