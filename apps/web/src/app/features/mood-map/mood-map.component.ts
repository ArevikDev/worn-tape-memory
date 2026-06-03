import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NavShellComponent } from '../../shared/components/nav-shell.component';
import type { MoodMapPoint, MoodMapRange } from '@worn-tape-memory/shared';

const API_BASE = 'http://127.0.0.1:3000';

const MOOD_COLORS: Record<string, string> = {
  melancholy: '#6366f1',
  warm: '#f59e0b',
  peak: '#ef4444',
  hypnotic: '#8b5cf6',
  euphoric: '#10b981',
  contemplative: '#64748b',
  nostalgic: '#c084fc',
  dreamy: '#38bdf8',
  tense: '#f97316',
  serene: '#34d399',
  raw: '#dc2626',
  bittersweet: '#a78bfa',
  electric: '#facc15',
  tender: '#fb7185',
  brooding: '#475569',
};

interface MoodCentroid {
  mood: string;
  cx: number;
  cy: number;
  color: string;
  count: number;
}

@Component({
  selector: 'app-mood-map',
  standalone: true,
  imports: [NavShellComponent],
  templateUrl: './mood-map.component.html',
  styles: [
    `
      @keyframes ripple-out {
        0% {
          transform: scale(1);
          stroke-opacity: 0.6;
        }
        100% {
          transform: scale(4);
          stroke-opacity: 0;
        }
      }
      @keyframes breathe {
        0%,
        100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.22);
        }
      }
      .dot-ripple {
        animation: ripple-out 1.8s ease-out infinite;
        transform-origin: center;
        transform-box: fill-box;
        pointer-events: none;
      }
      .dot-ripple-lag {
        animation: ripple-out 1.8s ease-out 0.9s infinite;
        transform-origin: center;
        transform-box: fill-box;
        pointer-events: none;
      }
      .dot-hovered {
        animation: breathe 2s ease-in-out infinite;
        transform-origin: center;
        transform-box: fill-box;
      }
    `,
  ],
})
export class MoodMapComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);

  protected readonly points = signal<MoodMapPoint[]>([]);
  protected readonly loading = signal(true);
  protected readonly range = signal<MoodMapRange>('all');
  protected readonly hovered = signal<MoodMapPoint | null>(null);
  protected readonly tooltipX = signal(0);
  protected readonly tooltipY = signal(0);

  // SVG canvas dimensions
  protected readonly W = 1000;
  protected readonly H = 660;
  protected readonly PAD = 56;

  protected readonly RANGES: MoodMapRange[] = ['all', '3m', '1m'];
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly MOOD_COLORS = MOOD_COLORS;

  protected readonly presentMoods = computed(() => {
    const seen = new Set<string>();
    for (const p of this.points()) {
      if (p.moodCategory) seen.add(p.moodCategory);
    }
    return [...seen];
  });

  // Centroid of each mood cluster — used to label regions on the map
  protected readonly moodCentroids = computed((): MoodCentroid[] => {
    const groups = new Map<string, { sumX: number; sumY: number; count: number }>();
    for (const pt of this.points()) {
      if (!pt.moodCategory) continue;
      const g = groups.get(pt.moodCategory) ?? { sumX: 0, sumY: 0, count: 0 };
      g.sumX += this.cx(pt);
      g.sumY += this.cy(pt);
      g.count++;
      groups.set(pt.moodCategory, g);
    }
    return [...groups.entries()]
      .filter(([, g]) => g.count >= 3)
      .map(([mood, g]) => ({
        mood,
        cx: g.sumX / g.count,
        cy: g.sumY / g.count,
        color: MOOD_COLORS[mood] ?? '#52525b',
        count: g.count,
      }));
  });

  async ngOnInit(): Promise<void> {
    await this.loadMap();
  }

  async setRange(r: MoodMapRange): Promise<void> {
    if (r === this.range()) return;
    this.range.set(r);
    await this.loadMap();
  }

  private async loadMap(): Promise<void> {
    this.loading.set(true);
    this.hovered.set(null);
    try {
      const pts = await firstValueFrom(
        this.http.get<MoodMapPoint[]>(`${API_BASE}/mood-map?range=${this.range()}`, {
          withCredentials: true,
        }),
      );
      this.points.set(pts);
    } catch {
      this.points.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  cx(pt: MoodMapPoint): number {
    return pt.x * (this.W - 2 * this.PAD) + this.PAD;
  }

  cy(pt: MoodMapPoint): number {
    return pt.y * (this.H - 2 * this.PAD) + this.PAD;
  }

  dotRadius(playCount: number): number {
    return Math.min(18, Math.max(7, Math.sqrt(playCount) * 2.8));
  }

  moodColor(moodCategory: string | null): string {
    return MOOD_COLORS[moodCategory ?? ''] ?? '#52525b';
  }

  rangeLabel(r: MoodMapRange): string {
    if (r === 'all') return 'All time';
    if (r === '3m') return '3 months';
    return '1 month';
  }

  onMouseMove(e: MouseEvent): void {
    const tooltipW = 240;
    const tooltipH = 220;
    const margin = 14;

    let x = e.clientX + margin;
    let y = e.clientY - margin;

    if (x + tooltipW > window.innerWidth) x = e.clientX - tooltipW - margin;
    if (y + tooltipH > window.innerHeight) y = e.clientY - tooltipH - margin;
    if (y < 0) y = margin;

    this.tooltipX.set(x);
    this.tooltipY.set(y);

    // Moving over empty space — schedule a delayed clear
    this.scheduleHide(700);
  }

  onSvgLeave(): void {
    // Leaving the SVG entirely — clear a bit faster
    this.scheduleHide(300);
  }

  onDotEnter(pt: MoodMapPoint): void {
    // Entering a dot — cancel any pending hide and show immediately
    this.cancelHide();
    this.hovered.set(pt);
  }

  ngOnDestroy(): void {
    this.cancelHide();
  }

  private scheduleHide(ms: number): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.hovered.set(null);
      this.hideTimer = null;
    }, ms);
  }

  private cancelHide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  openTrack(pt: MoodMapPoint): void {
    window.open(pt.spotifyUri, '_blank');
  }
}
