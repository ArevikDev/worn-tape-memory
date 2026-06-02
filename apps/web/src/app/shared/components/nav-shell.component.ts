import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Router } from '@angular/router';
import type { AuthUser } from '@worn-tape-memory/shared';

@Component({
  selector: 'app-nav-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-zinc-950 text-white">

      <header class="border-b border-zinc-800 px-6 py-4">
        <div class="max-w-5xl mx-auto flex items-center justify-between gap-6">

          <!-- Left: brand + nav -->
          <div class="flex items-center gap-6 min-w-0">
            <span class="text-zinc-400 text-sm font-medium tracking-widest uppercase flex-shrink-0">
              Worn Tape Memory
            </span>
            <nav class="flex items-center gap-0.5">
              <a routerLink="/dashboard"
                 routerLinkActive="!text-white bg-zinc-800"
                 class="px-3 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                Overview
              </a>
              <a routerLink="/archetypes"
                 routerLinkActive="!text-white bg-zinc-800"
                 class="px-3 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                Archetypes
              </a>
            </nav>
          </div>

          <!-- Right: page-specific actions + user -->
          <div class="flex items-center gap-4 flex-shrink-0">
            <ng-content select="[headerActions]"></ng-content>

            @if (user()) {
              <div class="flex items-center gap-2">
                @if (user()!.avatarUrl) {
                  <img [src]="user()!.avatarUrl" [alt]="user()!.displayName ?? ''"
                    class="w-6 h-6 rounded-full" />
                }
                <span class="text-zinc-400 text-sm hidden sm:block">{{ user()!.displayName }}</span>
              </div>
            }

            <button (click)="logout()"
              class="text-zinc-600 hover:text-zinc-400 text-sm transition-colors">
              Log out
            </button>
          </div>

        </div>
      </header>

      <!-- Page content -->
      <ng-content></ng-content>

    </div>
  `,
})
export class NavShellComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = signal<AuthUser | null>(null);

  async ngOnInit(): Promise<void> {
    const u = await this.auth.loadCurrentUser();
    if (u) this.user.set(u);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/']);
  }
}
