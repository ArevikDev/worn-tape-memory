import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NavShellComponent } from '../../shared/components/nav-shell.component';
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
  imports: [NavShellComponent],
  templateUrl: './archetypes.component.html',
})
export class ArchetypesComponent implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly archetypes = signal<Archetype[]>([]);
  protected readonly loading = signal(true);
  protected readonly detecting = signal(false);
  protected readonly detectError = signal<string | null>(null);
  protected readonly exportingId = signal<string | null>(null);
  protected readonly playingId = signal<string | null>(null);

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

  async play(archetype: Archetype): Promise<void> {
    this.exportingId.set(archetype.id);
    this.detectError.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<{ playing: boolean; noDevice: boolean }>(
          `${API_BASE}/archetypes/${archetype.id}/play`,
          {},
          { withCredentials: true },
        ),
      );
      if (result.noDevice) {
        this.detectError.set('Open Spotify on any device first, then try again.');
      } else {
        // Show "Playing" badge for 4 seconds then reset
        this.playingId.set(archetype.id);
        setTimeout(() => this.playingId.set(null), 4000);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof HttpErrorResponse
          ? (err.error?.message ?? err.message)
          : 'Could not start playback. Try again.';
      this.detectError.set(msg);
    } finally {
      this.exportingId.set(null);
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
