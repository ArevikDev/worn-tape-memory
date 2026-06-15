import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NavShellComponent } from '../../shared/components/nav-shell.component';
import { AmbientBackgroundComponent } from '../../shared/components/ambient-background.component';
import type { Archetype } from '@worn-tape-memory/shared';

const API_BASE = 'http://127.0.0.1:3000';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ICON_EMOJI: Record<string, string> = {
  moon: '🌙',
  coffee: '☕',
  bolt: '⚡',
  vinyl: '💿',
  headphones: '🎧',
  music: '🎵',
  flame: '🔥',
  'wave-sine': '〰️',
  cloud: '☁️',
  star: '⭐',
  sun: '☀️',
  heart: '❤️',
  ghost: '👻',
  brain: '🧠',
  telescope: '🔭',
  snowflake: '❄️',
  leaf: '🍃',
  moon2: '🌕',
  zap: '⚡',
  feather: '🪶',
  wind: '🌬️',
};

@Component({
  selector: 'app-archetypes',
  standalone: true,
  imports: [NavShellComponent, AmbientBackgroundComponent],
  templateUrl: './archetypes.component.html',
})
export class ArchetypesComponent implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly archetypes = signal<Archetype[]>([]);
  protected readonly loading = signal(true);
  protected readonly detecting = signal(false);
  protected readonly detectError = signal<string | null>(null);

  // Single action per card: export playlist → open in Spotify app
  protected readonly openingId = signal<string | null>(null);

  // Artist playback (clicking artist name chips)
  protected readonly loadingArtist = signal<string | null>(null);
  protected readonly playingArtist = signal<string | null>(null);

  protected readonly DAYS = DAYS;

  async ngOnInit(): Promise<void> {
    await this.loadArchetypes();
  }

  private async loadArchetypes(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await firstValueFrom(
        this.http.get<Archetype[]>(`${API_BASE}/archetypes`, { withCredentials: true }),
      );
      this.archetypes.set(list);
    } catch {
      this.archetypes.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async detect(): Promise<void> {
    this.detecting.set(true);
    this.detectError.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<{ detected: number; listenCount: number }>(
          `${API_BASE}/archetypes/detect`,
          {},
          { withCredentials: true },
        ),
      );
      if (result.detected === 0) {
        const count = result.listenCount ?? 0;
        this.detectError.set(
          count === 0
            ? 'No listens found — sync your Spotify history first.'
            : `Only ${count} listen${count === 1 ? '' : 's'} found. Sync more history and try again.`,
        );
      }
      await this.loadArchetypes();
    } catch (err: unknown) {
      const msg =
        err instanceof HttpErrorResponse
          ? (err.error?.message ?? err.message)
          : 'Something went wrong. Try again in a moment.';
      this.detectError.set(msg);
    } finally {
      this.detecting.set(false);
    }
  }

  async redetect(): Promise<void> {
    this.detecting.set(true);
    this.detectError.set(null);
    try {
      await firstValueFrom(
        this.http.post<{ detected: number }>(
          `${API_BASE}/archetypes/redetect`,
          {},
          { withCredentials: true },
        ),
      );
      await this.loadArchetypes();
    } catch (err: unknown) {
      const msg =
        err instanceof HttpErrorResponse
          ? (err.error?.message ?? err.message)
          : 'Refresh failed. Try again in a moment.';
      this.detectError.set(msg);
    } finally {
      this.detecting.set(false);
    }
  }

  /** Export archetype as a Spotify playlist and open it on open.spotify.com. */
  async openInSpotify(archetype: Archetype): Promise<void> {
    this.openingId.set(archetype.id);
    this.detectError.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<{ playlistId: string; playlistUrl: string; trackCount: number }>(
          `${API_BASE}/playlists/export/${archetype.id}`,
          {},
          { withCredentials: true },
        ),
      );
      // Open the playlist on open.spotify.com — already in the user's library
      // since it's owned by them; from here they can save/share it themselves.
      window.open(result.playlistUrl, '_blank');
    } catch (err: unknown) {
      const msg =
        err instanceof HttpErrorResponse
          ? (err.error?.message ?? err.message)
          : 'Could not open in Spotify. Try again.';
      this.detectError.set(msg);
    } finally {
      this.openingId.set(null);
    }
  }

  async playArtist(name: string): Promise<void> {
    this.loadingArtist.set(name);
    this.detectError.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<{
          playing: boolean;
          noDevice: boolean;
          spotifyUri: string;
          artistUrl: string;
        }>(`${API_BASE}/archetypes/play-artist`, { artistName: name }, { withCredentials: true }),
      );
      if (result.noDevice) {
        const target = result.spotifyUri || result.artistUrl;
        if (target) window.open(target, '_blank');
        this.detectError.set('No active device — opened Spotify. Come back and try again.');
      } else if (!result.playing && result.spotifyUri) {
        window.open(result.spotifyUri, '_blank');
      } else {
        this.playingArtist.set(name);
        setTimeout(() => this.playingArtist.set(null), 3000);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof HttpErrorResponse
          ? (err.error?.message ?? err.message)
          : 'Could not play artist. Try again.';
      this.detectError.set(msg);
    } finally {
      this.loadingArtist.set(null);
    }
  }

  iconEmoji(icon: string): string {
    return ICON_EMOJI[icon] ?? '🎵';
  }

  peakHourLabel(hour: number): string {
    if (hour === 0) return '12am';
    if (hour < 12) return `${hour}am`;
    if (hour === 12) return '12pm';
    return `${hour - 12}pm`;
  }
}
