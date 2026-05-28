import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import type { AuthUser } from '@worn-tape-memory/shared';

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
          <button
            (click)="logout()"
            class="text-zinc-500 hover:text-zinc-300 text-sm underline underline-offset-2 transition-colors"
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
  private readonly router = inject(Router);
  protected readonly user = signal<AuthUser | null>(null);

  async ngOnInit(): Promise<void> {
    const result = await this.auth.loadCurrentUser();
    if (result) this.user.set(result);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/']);
  }
}
