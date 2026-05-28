import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import type { AuthUser } from '@worn-tape-memory/shared';

const API_BASE = 'http://127.0.0.1:3000';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <main class="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      @if (user()) {
        <div class="text-center space-y-4">
          @if (user()!.avatarUrl) {
            <img
              [src]="user()!.avatarUrl"
              [alt]="user()!.displayName ?? 'Your avatar'"
              class="w-16 h-16 rounded-full mx-auto"
            />
          }
          <h1 class="text-2xl font-semibold text-white">
            Hello, {{ user()!.displayName ?? user()!.spotifyUserId }}
          </h1>
          <p class="text-zinc-500 text-sm">You're connected. Dashboard coming soon.</p>

          <!-- Sync button -->
          <button
            (click)="sync()"
            [disabled]="syncing()"
            class="flex items-center gap-2 mx-auto bg-zinc-800 hover:bg-zinc-700
                   disabled:opacity-50 disabled:cursor-not-allowed
                   text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            @if (syncing()) {
              <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Syncing…</span>
            } @else {
              <span>↻</span>
              <span>Sync listens</span>
            }
          </button>

          @if (syncResult() !== null) {
            <p class="text-zinc-400 text-xs">
              {{ syncResult() === 0 ? 'Already up to date' : syncResult() + ' new listens added' }}
            </p>
          }

          <button
            (click)="logout()"
            class="block mx-auto text-zinc-600 hover:text-zinc-400 text-sm underline underline-offset-2 transition-colors"
          >
            Log out
          </button>
        </div>
      } @else {
        <div class="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      }
    </main>
  `,
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  protected readonly user = signal<AuthUser | null>(null);
  protected readonly syncing = signal(false);
  protected readonly syncResult = signal<number | null>(null);

  async ngOnInit(): Promise<void> {
    const result = await this.auth.loadCurrentUser();
    if (result) this.user.set(result);
  }

  async sync(): Promise<void> {
    this.syncing.set(true);
    this.syncResult.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<{ inserted: number }>(
          `${API_BASE}/sync/me`,
          {},
          { withCredentials: true },
        ),
      );
      this.syncResult.set(result.inserted);
    } finally {
      this.syncing.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/']);
  }
}
