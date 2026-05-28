import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `
    <main class="min-h-screen bg-zinc-950 flex items-center justify-center">
      @if (error()) {
        <div class="text-center space-y-4">
          <p class="text-red-400 text-lg">{{ error() }}</p>
          <a href="/" class="text-zinc-400 hover:text-white underline text-sm">Try again</a>
        </div>
      } @else {
        <div class="text-center space-y-3">
          <div class="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p class="text-zinc-400">Connecting your Spotify…</p>
        </div>
      }
    </main>
  `,
})
export class AuthCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const code = this.route.snapshot.queryParamMap.get('code');
    const errorParam = this.route.snapshot.queryParamMap.get('error');

    if (errorParam) {
      this.error.set('Spotify authorization was denied. Please try again.');
      return;
    }

    if (!code) {
      this.error.set('No authorization code received from Spotify.');
      return;
    }

    const verifier = sessionStorage.getItem('pkce_verifier');
    if (!verifier) {
      this.error.set('Session expired. Please try connecting again.');
      return;
    }

    try {
      await this.auth.exchangeCode(code, verifier);
      sessionStorage.removeItem('pkce_verifier');
      await this.router.navigate(['/dashboard']);
    } catch {
      this.error.set('Failed to connect to Spotify. Please try again.');
    }
  }
}
