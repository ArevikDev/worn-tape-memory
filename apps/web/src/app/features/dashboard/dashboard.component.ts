import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import type { AuthUser, UserStats, NowPlaying } from '@worn-tape-memory/shared';

const API_BASE = 'http://127.0.0.1:3000';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="min-h-screen bg-zinc-950 text-white">

      <!-- Header -->
      <header class="border-b border-zinc-800 px-6 py-4">
        <div class="max-w-5xl mx-auto flex items-center justify-between">
          <span class="text-zinc-400 text-sm font-medium tracking-widest uppercase">
            Worn Tape Memory
          </span>
          <div class="flex items-center gap-4">
            @if (user()) {
              @if (user()!.avatarUrl) {
                <img
                  [src]="user()!.avatarUrl"
                  [alt]="user()!.displayName ?? ''"
                  class="w-7 h-7 rounded-full"
                />
              }
              <span class="text-zinc-300 text-sm">{{ user()!.displayName }}</span>
            }
            <button
              (click)="sync()"
              [disabled]="syncing()"
              title="Sync listens"
              class="text-zinc-500 hover:text-zinc-200 disabled:opacity-40 transition-colors text-lg leading-none"
            >↻</button>
            <button
              (click)="logout()"
              class="text-zinc-600 hover:text-zinc-400 text-sm transition-colors"
            >Log out</button>
          </div>
        </div>
      </header>

      <main class="max-w-5xl mx-auto px-6 py-8 space-y-8">

        <!-- Now Playing -->
        @if (nowPlaying()) {
          <div class="flex items-center gap-4 bg-zinc-900 rounded-xl px-5 py-4 border border-zinc-800">
            @if (nowPlaying()!.albumImageUrl) {
              <img
                [src]="nowPlaying()!.albumImageUrl"
                alt="Album art"
                class="w-12 h-12 rounded-md flex-shrink-0"
              />
            }
            <div class="min-w-0 flex-1">
              <p class="text-white font-medium truncate">{{ nowPlaying()!.trackName }}</p>
              <p class="text-zinc-400 text-sm truncate">{{ nowPlaying()!.artistName }}</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              <span class="text-zinc-500 text-xs">Now playing</span>
            </div>
          </div>
        }

        <!-- Stats strip -->
        @if (stats()) {
          <div class="grid grid-cols-3 gap-4">
            <div class="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
              <p class="text-3xl font-bold text-white">{{ stats()!.totalListens }}</p>
              <p class="text-zinc-500 text-sm mt-1">listens</p>
            </div>
            <div class="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
              <p class="text-3xl font-bold text-white">{{ stats()!.uniqueTracks }}</p>
              <p class="text-zinc-500 text-sm mt-1">tracks</p>
            </div>
            <div class="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
              <p class="text-3xl font-bold text-white">{{ stats()!.uniqueArtists }}</p>
              <p class="text-zinc-500 text-sm mt-1">artists</p>
            </div>
          </div>

          <!-- Top tracks + artists -->
          <div class="grid grid-cols-2 gap-6">

            <!-- Top tracks -->
            <div class="bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-1">
              <h2 class="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-4">
                Top tracks
              </h2>
              @for (track of stats()!.topTracks; track track.spotifyUri; let i = $index) {
                <div class="flex items-center gap-3 py-1.5">
                  @if (track.albumImageUrl) {
                    <img [src]="track.albumImageUrl" alt="" class="w-8 h-8 rounded flex-shrink-0" />
                  } @else {
                    <div class="w-8 h-8 rounded bg-zinc-800 flex-shrink-0"></div>
                  }
                  <div class="min-w-0 flex-1">
                    <p class="text-white text-sm truncate">{{ track.name }}</p>
                    <p class="text-zinc-500 text-xs truncate">{{ track.artistName }}</p>
                  </div>
                  <span class="text-zinc-600 text-xs flex-shrink-0">{{ track.playCount }}×</span>
                </div>
              }
            </div>

            <!-- Top artists -->
            <div class="bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-1">
              <h2 class="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-4">
                Top artists
              </h2>
              @for (artist of stats()!.topArtists; track artist.artistName; let i = $index) {
                <div class="flex items-center justify-between py-1.5">
                  <div class="flex items-center gap-3">
                    <span class="text-zinc-700 text-xs w-4 text-right">{{ i + 1 }}</span>
                    <p class="text-white text-sm">{{ artist.artistName }}</p>
                  </div>
                  <span class="text-zinc-600 text-xs">{{ artist.playCount }}×</span>
                </div>
              }
            </div>
          </div>

          <!-- Recent listens -->
          <div class="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
            <h2 class="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-4">
              Recent listens
            </h2>
            <div class="space-y-1">
              @for (listen of stats()!.recentListens; track listen.playedAt) {
                <div class="flex items-center gap-3 py-1.5">
                  @if (listen.albumImageUrl) {
                    <img [src]="listen.albumImageUrl" alt="" class="w-8 h-8 rounded flex-shrink-0" />
                  } @else {
                    <div class="w-8 h-8 rounded bg-zinc-800 flex-shrink-0"></div>
                  }
                  <div class="min-w-0 flex-1">
                    <p class="text-white text-sm truncate">{{ listen.name }}</p>
                    <p class="text-zinc-500 text-xs truncate">{{ listen.artistName }}</p>
                  </div>
                  <span class="text-zinc-600 text-xs flex-shrink-0 tabular-nums">
                    {{ listen.playedAt | date:'MMM d, h:mm a' }}
                  </span>
                </div>
              }
            </div>
          </div>

        } @else {
          <!-- Loading -->
          <div class="flex items-center justify-center py-24">
            <div class="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        }

        <!-- Sync feedback -->
        @if (syncResult() !== null) {
          <p class="text-center text-zinc-500 text-xs">
            {{ syncResult() === 0 ? 'Already up to date' : syncResult() + ' new listens added' }}
          </p>
        }

      </main>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly user = signal<AuthUser | null>(null);
  protected readonly stats = signal<UserStats | null>(null);
  protected readonly nowPlaying = signal<NowPlaying | null>(null);
  protected readonly syncing = signal(false);
  protected readonly syncResult = signal<number | null>(null);

  async ngOnInit(): Promise<void> {
    const result = await this.auth.loadCurrentUser();
    if (result) this.user.set(result);

    await Promise.all([this.loadStats(), this.loadNowPlaying()]);

    // Poll now-playing every 10s while on this page
    const interval = setInterval(() => this.loadNowPlaying(), 10_000);
    this.destroyRef.onDestroy(() => clearInterval(interval));
  }

  private async loadStats(): Promise<void> {
    try {
      const s = await firstValueFrom(
        this.http.get<UserStats>(`${API_BASE}/stats/me`, { withCredentials: true }),
      );
      this.stats.set(s);
    } catch {
      // stats will stay null — loading spinner remains
    }
  }

  private async loadNowPlaying(): Promise<void> {
    try {
      const np = await firstValueFrom(
        this.http.get<NowPlaying | null>(`${API_BASE}/spotify/now-playing`, {
          withCredentials: true,
        }),
      );
      this.nowPlaying.set(np);
    } catch {
      this.nowPlaying.set(null);
    }
  }

  async sync(): Promise<void> {
    this.syncing.set(true);
    this.syncResult.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<{ inserted: number }>(`${API_BASE}/sync/me`, {}, { withCredentials: true }),
      );
      this.syncResult.set(result.inserted);
      await this.loadStats(); // refresh numbers after sync
    } finally {
      this.syncing.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/']);
  }
}
