import { Component, input } from '@angular/core';

@Component({
  selector: 'app-ambient-background',
  standalone: true,
  template: `
    <div class="fixed inset-0 overflow-hidden pointer-events-none">
      @switch (variant()) {
        @case ('archetypes') {
          <div class="absolute -top-40 -left-40 w-[34rem] h-[34rem] rounded-full
                      bg-violet-500/20 blur-[110px] animate-aurora-1"></div>
          <div class="absolute -bottom-40 -right-40 w-[34rem] h-[34rem] rounded-full
                      bg-teal-500/15 blur-[110px] animate-aurora-2"></div>
        }
        @default {
          <div class="absolute -top-40 -left-40 w-[34rem] h-[34rem] rounded-full
                      bg-indigo-500/20 blur-[110px] animate-aurora-1"></div>
          <div class="absolute -bottom-40 -right-40 w-[34rem] h-[34rem] rounded-full
                      bg-amber-500/15 blur-[110px] animate-aurora-2"></div>
        }
      }
    </div>
  `,
})
export class AmbientBackgroundComponent {
  variant = input<'default' | 'archetypes'>('default');
}
