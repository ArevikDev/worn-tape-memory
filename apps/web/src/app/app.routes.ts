import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth-callback/auth-callback.component').then(
        (m) => m.AuthCallbackComponent,
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'archetypes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/archetypes/archetypes.component').then((m) => m.ArchetypesComponent),
  },
  {
    path: 'mood-map',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/mood-map/mood-map.component').then((m) => m.MoodMapComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
