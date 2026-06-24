import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

const SIZE = 640;

@Injectable()
export class CoverArtService {
  async generateJpeg(color: string): Promise<Buffer> {
    const { r: cr, g: cg, b: cb } = hexToRgb(color);

    // deep shadow base — dark tint of the archetype color
    const dr = Math.round(cr * 0.07 + 4);
    const dg = Math.round(cg * 0.07 + 4);
    const db = Math.round(cb * 0.10 + 8); // slight cool bias in shadows

    // midtone band — softer, sits between the two blocks
    const mr = Math.round(cr * 0.48 + 18);
    const mg = Math.round(cg * 0.44 + 14);
    const mb = Math.round(cb * 0.36 + 10);

    const pixels = Buffer.alloc(SIZE * SIZE * 3);

    for (let y = 0; y < SIZE; y++) {
      const t = y / (SIZE - 1); // 0.0 top → 1.0 bottom

      // top color block fades out between t=0.28 and t=0.66
      const topBlend = 1.0 - smoothstep(0.28, 0.66, t);

      // mid accent band, bell curve centered at t=0.60
      const midBlend = bell(0.60, 0.13, t) * 0.55;

      for (let x = 0; x < SIZE; x++) {
        let r = dr + (cr - dr) * topBlend + (mr - dr) * midBlend;
        let g = dg + (cg - dg) * topBlend + (mg - dg) * midBlend;
        let b = db + (cb - db) * topBlend + (mb - db) * midBlend;

        // deterministic film grain — consistent per pixel position
        const grain = (hash(x, y) - 0.5) * 20;
        r = clamp(r + grain);
        g = clamp(g + grain);
        b = clamp(b + grain);

        const idx = (y * SIZE + x) * 3;
        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
      }
    }

    return sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 3 } })
      .jpeg({ quality: 88 })
      .toBuffer();
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function bell(center: number, width: number, t: number): number {
  const d = (t - center) / width;
  return Math.exp(-d * d * 2.5);
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

// Cheap sine-based hash for deterministic per-pixel grain
function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
