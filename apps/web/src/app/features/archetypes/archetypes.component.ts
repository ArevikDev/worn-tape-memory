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
  template: `
    <app-nav-shell>

      <main class="max-w-5xl mx-auto px-6 py-8">

        <!-- Header row -->
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-white text-xl font-semibold">Your archetypes</h1>
            <p class="text-zinc-500 text-sm mt-1">
              Listening personas detected from your history
            </p>
          </div>

          @if (archetypes().length > 0 && !detecting()) {
            <button (click)="redetect()"
              class="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400
                     text-sm transition-colors">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0
                         0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Refresh
            </button>
          }
        </div>

        <!-- Loading state -->
        @if (loading()) {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (i of [1, 2, 3]; track i) {
              <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-full bg-zinc-800 animate-pulse flex-shrink-0"></div>
                  <div class="flex-1 space-y-2">
                    <div class="h-4 bg-zinc-800 rounded animate-pulse w-3/4"></div>
                    <div class="h-3 bg-zinc-800 rounded animate-pulse w-1/3"></div>
                  </div>
                </div>
                <div class="space-y-1.5">
                  <div class="h-3 bg-zinc-800 rounded animate-pulse w-full"></div>
                  <div class="h-3 bg-zinc-800 rounded animate-pulse w-4/5"></div>
                </div>
                <div class="h-3 bg-zinc-800 rounded animate-pulse w-2/3"></div>
              </div>
            }
          </div>

        <!-- Detecting state -->
        } @else if (detecting()) {
          <div class="flex flex-col items-center justify-center py-24 gap-5 text-center">
            <div class="relative">
              <div class="w-14 h-14 rounded-full border-2 border-zinc-700 border-t-zinc-300
                          animate-spin"></div>
              <span class="absolute inset-0 flex items-center justify-center text-2xl">🧠</span>
            </div>
            <div>
              <p class="text-white font-medium">Analyzing your listening patterns</p>
              <p class="text-zinc-500 text-sm mt-1">This takes about 10–15 seconds…</p>
            </div>
          </div>

        <!-- Empty state — no archetypes yet -->
        } @else if (archetypes().length === 0) {
          <div class="flex flex-col items-center justify-center py-24 gap-6 text-center">
            <div class="text-5xl">🎭</div>
            <div class="max-w-sm">
              <p class="text-white text-lg font-medium">Who have you been?</p>
              <p class="text-zinc-500 text-sm mt-2 leading-relaxed">
                Worn Tape Memory will cluster your listening history into personas —
                the late-night archivist, the midweek energy boost, the Sunday morning unwind.
              </p>
            </div>
            @if (detectError()) {
              <p class="text-red-400 text-sm">{{ detectError() }}</p>
            }
            <button (click)="detect()"
              class="px-5 py-2.5 bg-white text-zinc-950 rounded-lg text-sm font-medium
                     hover:bg-zinc-100 transition-colors">
              Discover my archetypes
            </button>
          </div>

        <!-- Archetype cards -->
        } @else {
          @if (detectError()) {
            <p class="text-red-400 text-sm mb-4">{{ detectError() }}</p>
          }
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (a of archetypes(); track a.id) {
              <div class="border border-zinc-800 rounded-xl p-5 flex flex-col gap-4
                          hover:border-zinc-700 transition-colors"
                   style="border-left-width: 3px"
                   [style.border-left-color]="a.color"
                   [style.background-color]="a.color + '14'">

                <!-- Icon + name + mood badge -->
                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center
                              text-xl flex-shrink-0"
                       [style.background-color]="a.color + '33'">
                    {{ iconEmoji(a.icon) }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3 class="text-white font-semibold text-sm leading-snug">{{ a.name }}</h3>
                    <span class="inline-block mt-1.5 text-xs px-2.5 py-0.5 rounded-full
                                 font-semibold tracking-wide text-white"
                          [style.background-color]="a.color + '99'">
                      {{ a.primaryMood }}
                    </span>
                  </div>
                </div>

                <!-- Description -->
                <p class="text-zinc-400 text-sm leading-relaxed flex-1">{{ a.description }}</p>

                <!-- Top artists -->
                @if (a.topArtists && a.topArtists.length > 0) {
                  <div class="flex flex-wrap gap-x-3 gap-y-1">
                    @for (artist of a.topArtists; track artist) {
                      <span class="text-xs text-zinc-300 font-medium">{{ artist }}</span>
                    }
                  </div>
                }

                <!-- Style hashtags -->
                @if (a.styleTags && a.styleTags.length > 0) {
                  <div class="flex flex-wrap gap-1.5">
                    @for (tag of a.styleTags; track tag) {
                      <span class="text-xs text-zinc-500">#{{ tag }}</span>
                    }
                  </div>
                }

                <!-- Meta row -->
                <div class="flex items-center gap-2 text-zinc-600 text-xs pt-3
                            border-t border-zinc-800 flex-wrap">
                  <span>peaks {{ peakHourLabel(a.peakHour) }}</span>
                  <span class="text-zinc-800">·</span>
                  <span>{{ DAYS[a.peakDayOfWeek] }}s</span>
                  <span class="text-zinc-800">·</span>
                  <span>{{ a.playCount }} plays</span>
                </div>
              </div>
            }
          </div>
        }

      </main>
    </app-nav-shell>
  `,
})
export class ArchetypesComponent implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly archetypes = signal<Archetype[]>([]);
  protected readonly loading = signal(true);
  protected readonly detecting = signal(false);
  protected readonly detectError = signal<string | null>(null);

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
