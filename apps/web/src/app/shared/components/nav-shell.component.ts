import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Router } from '@angular/router';
import type { AuthUser } from '@worn-tape-memory/shared';

@Component({
  selector: 'app-nav-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav-shell.component.html',
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
