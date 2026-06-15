import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NavShellComponent } from '../../shared/components/nav-shell.component';
import { AmbientBackgroundComponent } from '../../shared/components/ambient-background.component';
import type { UserStats, NowPlaying } from '@worn-tape-memory/shared';

const API_BASE = 'http://127.0.0.1:3000';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NavShellComponent, AmbientBackgroundComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly stats = signal<UserStats | null>(null);
  protected readonly nowPlaying = signal<NowPlaying | null>(null);
  protected readonly syncing = signal(false);
  protected readonly syncResult = signal<number | null>(null);

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadStats(), this.loadNowPlaying()]);
    const interval = setInterval(() => this.loadNowPlaying(), 10_000);
    this.destroyRef.onDestroy(() => clearInterval(interval));
  }

  private async loadStats(): Promise<void> {
    try {
      const s = await firstValueFrom(
        this.http.get<UserStats>(`${API_BASE}/stats/me`, { withCredentials: true }),
      );
      this.stats.set(s);
    } catch { /* stay on skeleton */ }
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
      await this.loadStats();
      setTimeout(() => this.syncResult.set(null), 3_000);
    } finally {
      this.syncing.set(false);
    }
  }

  rowDelay(i: number): string {
    return `${Math.min(i * 40, 400)}ms`;
  }

  timeAgo(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const m = Math.floor(diff / 60_000);
    const h = Math.floor(diff / 3_600_000);
    const d = Math.floor(diff / 86_400_000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (d === 1) return 'yesterday';
    return `${d}d ago`;
  }
}
