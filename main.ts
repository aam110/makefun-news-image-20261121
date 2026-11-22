// news-image-20261121 — "The World in One Day"
// One 1024x1024 broadsheet that sums up Saturday 21 November 2026.
// Written fresh in this session from STORIES.md + the brief. Node stdlib only:
// own raster canvas, own stroke (vector) serif/sans type, own PNG encoder.
// Deterministic: no Date, no Math.random, no network. Output: $MAKEFUN_OUTPUT_DIR/entry.png
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
type RGB = [number, number, number];
const PAPER: RGB = [247, 243, 234];
const INK: RGB = [26, 26, 34];
const INK_SOFT: RGB = [74, 70, 66];
const RED: RGB = [179, 32, 44];
const RED_DARK: RGB = [138, 20, 30];
const NAVY: RGB = [30, 58, 95];
const NAVY_DARK: RGB = [16, 28, 52];
const GOLD: RGB = [200, 155, 60];
const TEAL: RGB = [42, 127, 111];
const OCHRE: RGB = [196, 120, 40];
const PURPLE: RGB = [104, 78, 140];
const SKY_NIGHT: RGB = [18, 30, 58];
const SKY_NIGHT2: RGB = [44, 62, 110];
const CREAM_LINE: RGB = [210, 198, 176];
const WHITE: RGB = [255, 255, 255];
const REGION_COLORS: Record<string, RGB> = {
  EUROPE: NAVY,
  AMERICAS: TEAL,
  "MIDDLE EAST": RED,
  WORLD: PURPLE,
  ASIA: OCHRE,
};

// ------------------------------------------------------- deterministic hash
function hash2(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 974634);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function hash1(n: number, s: number): number {
  return hash2(n, 0, s);
}

// ---------------------------------------------------------------- PNG out
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([td, data])));
  return Buffer.concat([len, td, data, crc]);
}
function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const comp = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", comp),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ canvas
class Canvas {
  data = new Uint8Array(W * H * 3);
  constructor() {
    for (let i = 0; i < W * H; i++) {
      this.data[i * 3] = PAPER[0];
      this.data[i * 3 + 1] = PAPER[1];
      this.data[i * 3 + 2] = PAPER[2];
    }
  }
  set(x: number, y: number, c: RGB): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
    const o = (iy * W + ix) * 3;
    this.data[o] = c[0];
    this.data[o + 1] = c[1];
    this.data[o + 2] = c[2];
  }
  blend(x: number, y: number, c: RGB, a: number): void {
    if (a <= 0) return;
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
    const o = (iy * W + ix) * 3;
    if (a >= 1) {
      this.data[o] = c[0];
      this.data[o + 1] = c[1];
      this.data[o + 2] = c[2];
      return;
    }
    this.data[o] = Math.round(this.data[o] * (1 - a) + c[0] * a);
    this.data[o + 1] = Math.round(this.data[o + 1] * (1 - a) + c[1] * a);
    this.data[o + 2] = Math.round(this.data[o + 2] * (1 - a) + c[2] * a);
  }
  fillRect(x: number, y: number, w: number, h: number, c: RGB, a = 1): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(W, Math.round(x + w));
    const y1 = Math.min(H, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        if (a >= 1) this.set(xx, yy, c);
        else this.blend(xx, yy, c, a);
      }
    }
  }
  vgrad(x: number, y: number, w: number, h: number, c1: RGB, c2: RGB): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(W, Math.round(x + w));
    const y1 = Math.min(H, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) {
      const t = h <= 1 ? 0 : (yy - y) / h;
      const c: RGB = [
        Math.round(c1[0] + (c2[0] - c1[0]) * t),
        Math.round(c1[1] + (c2[1] - c1[1]) * t),
        Math.round(c1[2] + (c2[2] - c1[2]) * t),
      ];
      for (let xx = x0; xx < x1; xx++) this.set(xx, yy, c);
    }
  }
  hgrad(x: number, y: number, w: number, h: number, c1: RGB, c2: RGB): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(W, Math.round(x + w));
    const y1 = Math.min(H, Math.round(y + h));
    for (let xx = x0; xx < x1; xx++) {
      const t = w <= 1 ? 0 : (xx - x) / w;
      const c: RGB = [
        Math.round(c1[0] + (c2[0] - c1[0]) * t),
        Math.round(c1[1] + (c2[1] - c1[1]) * t),
        Math.round(c1[2] + (c2[2] - c1[2]) * t),
      ];
      for (let yy = y0; yy < y1; yy++) this.set(xx, yy, c);
    }
  }
  // thick line drawn as a chain of discs — smooth at any angle
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, thick: number, a = 1): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(len * 1.4));
    const r = Math.max(0.6, thick / 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.disc(x0 + dx * t, y0 + dy * t, r, c, a);
    }
  }
  disc(cx: number, cy: number, rad: number, c: RGB, a = 1): void {
    if (rad <= 0) return;
    const r = Math.ceil(rad);
    for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) {
      for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
        const d = Math.hypot(xx - cx, yy - cy);
        if (d <= rad) {
          if (a >= 1) this.set(xx, yy, c);
          else this.blend(xx, yy, c, a * (d < rad - 0.7 ? 1 : 0.75));
        }
      }
    }
  }
  ring(cx: number, cy: number, rad: number, c: RGB, thick: number): void {
    const r = Math.ceil(rad + thick);
    for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) {
      for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
        const d = Math.hypot(xx - cx, yy - cy);
        if (Math.abs(d - rad) <= thick / 2) this.set(xx, yy, c);
      }
    }
  }
  // even-odd scanline polygon fill
  poly(pts: [number, number][], c: RGB, a = 1): void {
    if (pts.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    for (let y = Math.max(0, Math.ceil(minY)); y <= Math.min(H - 1, Math.floor(maxY)); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        if ((p1[1] <= y && p2[1] > y) || (p2[1] <= y && p1[1] > y)) {
          const t = (y - p1[1]) / (p2[1] - p1[1]);
          xs.push(p1[0] + t * (p2[0] - p1[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const x0 = Math.max(0, Math.ceil(xs[k]));
        const x1 = Math.min(W - 1, Math.floor(xs[k + 1]));
        for (let x = x0; x <= x1; x++) {
          if (a >= 1) this.set(x, y, c);
          else this.blend(x, y, c, a);
        }
      }
    }
  }
  polyLine(pts: [number, number][], c: RGB, thick: number, a = 1): void {
    for (let i = 0; i + 1 < pts.length; i++) {
      this.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, thick, a);
    }
  }
  // deterministic speckle texture inside a rect
  speckle(x: number, y: number, w: number, h: number, n: number, seed: number, c: RGB, a: number, maxR = 1.4): void {
    for (let i = 0; i < n; i++) {
      const px = x + hash2(i, 1, seed) * w;
      const py = y + hash2(i, 2, seed) * h;
      const r = 0.5 + hash2(i, 3, seed) * maxR;
      this.disc(px, py, r, c, a * (0.4 + hash2(i, 4, seed) * 0.6));
    }
  }
  // diagonal hatch lines inside a rect
  hatch(x: number, y: number, w: number, h: number, gap: number, c: RGB, a: number): void {
    for (let d = -h; d < w + h; d += gap) {
      this.line(x + d, y + h, x + d + h, y, c, 0.8, a);
    }
  }
  // paper grain over the whole sheet — the main density driver
  grain(amp: number, seed: number): void {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const n = hash2(x, y, seed) - 0.5;
        if (n === 0) continue;
        const o = (y * W + x) * 3;
        const d = Math.round(n * amp);
        this.data[o] = Math.max(0, Math.min(255, this.data[o] + d));
        this.data[o + 1] = Math.max(0, Math.min(255, this.data[o + 1] + d));
        this.data[o + 2] = Math.max(0, Math.min(255, this.data[o + 2] + d));
      }
    }
  }
}

function shade(c: RGB, f: number): RGB {
  return [
    Math.max(0, Math.min(255, Math.round(c[0] * f))),
    Math.max(0, Math.min(255, Math.round(c[1] * f))),
    Math.max(0, Math.min(255, Math.round(c[2] * f))),
  ];
}
function mix(c1: RGB, c2: RGB, t: number): RGB {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

// ------------------------------------------------- vector stroke typeface
// Glyphs live on a 6-wide, 10-tall unit grid (cap top y=0, baseline y=7,
// descenders to y=9.5). Each glyph is a list of strokes; a stroke is a
// polyline "x,y x,y | x,y x,y". Strokes are drawn as thick lines, so the
// face is a clean vector sans; with serif ticks it reads as a serif face.
// No bitmap/pixel font anywhere.
type Glyph = { a: number; s: string[] };
const GLYPHS: Record<string, Glyph> = {
  A: { a: 6, s: ["0,7 2.5,0 5,7", "1.2,4.5 3.8,4.5"] },
  B: { a: 6, s: ["0,7 0,0 3.5,0 5,1.5 3.5,3 5,5.5 3.5,7 0,7", "0,3.5 3.5,3.5"] },
  C: { a: 6, s: ["5,1.5 4,0 1.5,0 0,1.5 0,5.5 1.5,7 4,7 5,5.5"] },
  D: { a: 6, s: ["0,7 0,0 3,0 5,2 5,5 3,7 0,7"] },
  E: { a: 6, s: ["5,0 0,0 0,7 5,7", "0,3.5 3.5,3.5"] },
  F: { a: 6, s: ["0,7 0,0 5,0", "0,3.5 3.5,3.5"] },
  G: { a: 6, s: ["5,1.5 4,0 1.5,0 0,1.5 0,5.5 1.5,7 4,7 5,5.5 5,3.5 3,3.5"] },
  H: { a: 6, s: ["0,0 0,7", "5,0 5,7", "0,3.5 5,3.5"] },
  I: { a: 6, s: ["2.5,0 2.5,7", "0.5,0 4.5,0", "0.5,7 4.5,7"] },
  J: { a: 6, s: ["5,0 5,5.5 3.5,7 1.5,7 0.5,5.5"] },
  K: { a: 6, s: ["0,0 0,7", "5,0 0,3.5 5,7"] },
  L: { a: 6, s: ["0,0 0,7 5,7"] },
  M: { a: 6.5, s: ["0,7 0,0 2.5,4 5,0 5,7"] },
  N: { a: 6, s: ["0,7 0,0 5,7 5,0"] },
  O: { a: 6, s: ["1.5,0 4,0 5,1.5 5,5.5 4,7 1.5,7 0,5.5 0,1.5 1.5,0"] },
  P: { a: 6, s: ["0,7 0,0 4,0 5,1 5,2.5 4,3.5 0,3.5"] },
  Q: { a: 6, s: ["1.5,0 4,0 5,1.5 5,5.5 4,7 1.5,7 0,5.5 0,1.5 1.5,0", "3.5,5 5,7"] },
  R: { a: 6, s: ["0,7 0,0 4,0 5,1 5,2.5 4,3.5 0,3.5", "3.5,3.5 5,7"] },
  S: { a: 6, s: ["5,1.5 4,0 1.5,0 0,1.5 0,3 1,4 4,4 5,5 5,6 4,7 1.5,7 0,5.5"] },
  T: { a: 6, s: ["0,0 5,0", "2.5,0 2.5,7"] },
  U: { a: 6, s: ["0,0 0,5.5 1,7 4,7 5,5.5 5,0"] },
  V: { a: 6, s: ["0,0 2.5,7 5,0"] },
  W: { a: 7, s: ["0,0 1.2,7 2.5,3.5 3.8,7 5,0"] },
  X: { a: 6, s: ["0,0 5,7", "5,0 0,7"] },
  Y: { a: 6, s: ["0,0 2.5,3.5 5,0", "2.5,3.5 2.5,7"] },
  Z: { a: 6, s: ["0,0 5,0 0,7 5,7"] },
  a: { a: 6, s: ["1,3 4,3 5,5 4,7 1,7 0,5 1,3", "5,2.5 5,7"] },
  b: { a: 6, s: ["0,0 0,7", "0,4.5 1,3 4,3 5,4.5 5,6 4,7 1,7 0,5.5"] },
  c: { a: 6, s: ["5,4 4,3 1.5,3 0.5,4.5 0.5,6 1.5,7 4,7 5,6"] },
  d: { a: 6, s: ["1,3 4,3 5,5 4,7 1,7 0,5 1,3", "5,0 5,7"] },
  e: { a: 6, s: ["5,5 4,3 2,3 0.5,4.5 0.5,5.5 1.5,7 4,7 5,5.5", "0.5,5 4.5,5"] },
  f: { a: 5, s: ["3.5,7 3.5,1 2.5,0 1.5,0 1,1", "1,3 4,3"] },
  g: { a: 6, s: ["1,3 4,3 5,5 4,7 1,7 0,5 1,3", "5,3 5,8 4,9.5 2,9.5 1,8.5"] },
  h: { a: 6, s: ["0,0 0,7", "0,4.5 1,3 3,3 4.5,4.5 4.5,7"] },
  i: { a: 3, s: ["2.5,2.5 2.5,7", "2.5,0.8 2.5,0.9"] },
  j: { a: 4, s: ["3.5,2.5 3.5,8 2.5,9.5 1,9.5", "3.5,0.8 3.5,0.9"] },
  k: { a: 6, s: ["0,0 0,7", "4.5,3 0,4.5 4.5,7"] },
  l: { a: 3, s: ["2.5,0 2.5,7"] },
  m: { a: 6, s: ["0,7 0,3 1,2.5 2,3 2,7", "2,3 3,2.5 4,3 4,7"] },
  n: { a: 6, s: ["0,7 0,3 1,2.5 3,2.5 4.5,4 4.5,7"] },
  o: { a: 6, s: ["1,3 4,3 5,5 4,7 1,7 0,5 1,3"] },
  p: { a: 6, s: ["0,3 0,9.5", "0,4.5 1,3 4,3 5,4.5 5,6 4,7 1,7 0,5.5"] },
  q: { a: 6, s: ["1,3 4,3 5,5 4,7 1,7 0,5 1,3", "5,3 5,9.5"] },
  r: { a: 5, s: ["0,3 0,7", "0,4 1,3 3,3 4,3.5"] },
  s: { a: 6, s: ["4,3.8 3,3 1.5,3 0.5,4 1,5 4,5 5,6 4,7 2,7 0.5,6"] },
  t: { a: 5, s: ["2.5,0 2.5,7", "1,4.5 4,4.5", "2.5,7 4,6.5"] },
  u: { a: 6, s: ["0,3 0,6 1,7 3.5,7 5,6 5,3"] },
  v: { a: 6, s: ["0,3 2.5,7 5,3"] },
  w: { a: 7, s: ["0,3 1,7 2.5,4.5 4,7 5,3"] },
  x: { a: 6, s: ["0,3 5,7", "5,3 0,7"] },
  y: { a: 6, s: ["0,3 2.5,7 5,3", "5,3 5,8 4,9.5 2,9.5"] },
  z: { a: 6, s: ["0,3 5,3 0,7 5,7"] },
  "0": { a: 6, s: ["1.5,0 4,0 5,1.5 5,5.5 4,7 1.5,7 0,5.5 0,1.5 1.5,0", "1.5,5.5 4,1.5"] },
  "1": { a: 6, s: ["1,1 2.5,0 2.5,7", "0.5,7 4.5,7"] },
  "2": { a: 6, s: ["0,1.5 1,0 4,0 5,1.5 5,3 0,7 5,7"] },
  "3": { a: 6, s: ["0,1 1,0 4,0 5,1 4,3 5,5 4,7 1,7 0,6"] },
  "4": { a: 6, s: ["4,0 4,7", "0,4.5 4.5,4.5", "0.5,4.5 4,0"] },
  "5": { a: 6, s: ["5,0 0,0 0,3.5 4,3.5 5,5 4,7 1,7 0,6"] },
  "6": { a: 6, s: ["5,1 4,0 1,0 0,2 0,6 1,7 4,7 5,5.5 4,4 1,4 0,5.5"] },
  "7": { a: 6, s: ["0,0 5,0 2.5,7"] },
  "8": { a: 6, s: ["1,0 4,0 5,1.5 4,3 1,3 0,1.5 1,0", "1,3 4,3 5,4.5 4,7 1,7 0,5.5 1,3"] },
  "9": { a: 6, s: ["5,7 5,1 4,0 1,0 0,1.5 0,3.5 1,4.5 4,4.5 5,3.5"] },
  " ": { a: 3, s: [] },
  ".": { a: 3, s: ["2.5,6.5 2.5,6.6"] },
  ",": { a: 3, s: ["2.5,6.5 2.5,6.6", "2.5,7 2,9"] },
  ":": { a: 3, s: ["2.5,2.5 2.5,2.6", "2.5,5.5 2.5,5.6"] },
  ";": { a: 3, s: ["2.5,2.5 2.5,2.6", "2.5,5.5 2.5,5.6", "2.5,6 2,9"] },
  "!": { a: 3, s: ["2.5,0 2.5,5", "2.5,6.5 2.5,6.6"] },
  "?": { a: 6, s: ["1,1.5 2,0 4,0 5,1 5,2.5 4,3.5 2.5,4.5 2.5,5.5", "2.5,6.5 2.5,6.6"] },
  "'": { a: 3, s: ["2.5,0 2,2"] },
  "’": { a: 3, s: ["2.5,0 2,2"] },
  '"': { a: 5, s: ["1.5,0 1,2", "3.5,0 3,2"] },
  "“": { a: 5, s: ["1.5,0 1,2", "3.5,0 3,2"] },
  "”": { a: 5, s: ["1.5,0 1,2", "3.5,0 3,2"] },
  "-": { a: 6, s: ["0.5,4 4.5,4"] },
  "–": { a: 6.5, s: ["0,4 5.5,4"] },
  "—": { a: 7, s: ["0,4 5.5,4"] },
  "(": { a: 4, s: ["4,0 2,1.5 2,5.5 4,7"] },
  ")": { a: 4, s: ["1,0 3,1.5 3,5.5 1,7"] },
  "%": { a: 6, s: ["5,0 0,7", "1,1 2.2,1 2.8,1.8 2.2,2.6 1,2.6 0.4,1.8 1,1", "3,4.4 4.2,4.4 4.8,5.2 4.2,6 3,6 2.4,5.2 3,4.4"] },
  "+": { a: 6, s: ["2.5,1 2.5,6", "0,3.5 5,3.5"] },
  "/": { a: 5, s: ["4,0 1,7"] },
  "&": { a: 6, s: ["4,1 3,0 1.5,0 0.5,1.5 1.5,3 4,3 5,4.5 4,7 2,7 0.5,5.5"] },
  "=": { a: 6, s: ["0,2.5 5,2.5", "0,5 5,5"] },
  "*": { a: 6, s: ["2.5,0 2.5,7", "0,2 5,5", "5,2 0,5"] },
  _: { a: 6, s: ["0,8.5 5,8.5"] },
  $: { a: 6, s: ["2.5,0 2.5,7", "4.5,1.5 3.5,0.5 1.5,0.5 0.5,1.5 0.5,2.5 1.5,3.5 4,4.5 4.5,5.5 3.5,6.8 1.5,6.8 0.5,6"] },
  "·": { a: 3, s: ["2.5,3.8 2.5,3.9"] },
  "•": { a: 3, s: ["2.5,3.5 2.5,3.6"] },
  "<": { a: 5, s: ["4,0 1,3.5 4,7"] },
  ">": { a: 5, s: ["1,0 4,3.5 1,7"] },
  "×": { a: 6, s: ["0,1 5,6", "5,1 0,6"] },
  "°": { a: 5, s: ["1.5,0.5 3.5,0.5 4,1.5 3.5,2.5 1.5,2.5 1,1.5 1.5,0.5"] },
};

// parsed glyph cache: char -> strokes as number point lists
const GLYPH_CACHE = new Map<string, { a: number; strokes: [number, number][][] }>();
function glyph(ch: string): { a: number; strokes: [number, number][][] } {
  const hit = GLYPH_CACHE.get(ch);
  if (hit) return hit;
  const g = GLYPHS[ch] ?? GLYPHS["?"] ?? { a: 6, s: ["0,0 5,0 5,7 0,7 0,0"] };
  const strokes: [number, number][][] = g.s.map((st) =>
    st.split(" ").map((p) => {
      const [xs, ys] = p.split(",");
      return [parseFloat(xs), parseFloat(ys)] as [number, number];
    }),
  );
  const out = { a: g.a, strokes };
  GLYPH_CACHE.set(ch, out);
  return out;
}

type TextOpts = {
  bold?: boolean;
  serif?: boolean;
  tracking?: number;
  align?: "left" | "center" | "right";
  alpha?: number;
};

function textWidth(text: string, size: number, tracking = 0): number {
  const sc = size / 7;
  let w = 0;
  for (const ch of text) w += glyph(ch).a * sc + tracking;
  return w - tracking;
}

// y = TOP of the cap height (ascenders reach y; descenders hang below baseline y+size)
function drawText(cv: Canvas, text: string, x: number, y: number, size: number, color: RGB, opts: TextOpts = {}): number {
  const sc = size / 7;
  const tracking = opts.tracking ?? 0;
  const weight = Math.max(1, size * (opts.bold ? 0.17 : 0.13));
  let cx = x;
  if (opts.align === "center") cx = x - textWidth(text, size, tracking) / 2;
  else if (opts.align === "right") cx = x - textWidth(text, size, tracking);
  for (const ch of text) {
    const g = glyph(ch);
    for (const stroke of g.strokes) {
      const pts: [number, number][] = stroke.map(([px, py]) => [cx + px * sc, y + py * sc]);
      cv.polyLine(pts, color, weight, opts.alpha ?? 1);
      if (opts.serif) {
        // serif ticks: short horizontal bars where a near-vertical stroke
        // meets the cap line (y=0) or the baseline (y=7)
        for (let i = 0; i < stroke.length; i++) {
          const [px, py] = stroke[i];
          if (py !== 0 && py !== 7) continue;
          const nb = i === 0 ? stroke[1] : stroke[i - 1];
          if (!nb) continue;
          if (Math.abs(nb[0] - px) < Math.abs(nb[1] - py) * 0.6) {
            const tx = cx + px * sc;
            const ty = y + py * sc;
            const tw = size * 0.16;
            cv.line(tx - tw / 2, ty, tx + tw / 2, ty, color, Math.max(1, weight * 0.7), opts.alpha ?? 1);
          }
        }
      }
    }
    cx += g.a * sc + tracking;
  }
  return cx;
}

function wrapText(text: string, maxW: number, size: number, tracking = 0): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur ? cur + " " + word : word;
    if (textWidth(trial, size, tracking) <= maxW || !cur) cur = trial;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// draw a wrapped paragraph; returns the y just below the last line
function drawPara(cv: Canvas, text: string, x: number, y: number, maxW: number, size: number, color: RGB, opts: TextOpts & { lh?: number } = {}): number {
  const lh = opts.lh ?? size * 1.28;
  const lines = wrapText(text, maxW, size, opts.tracking ?? 0);
  let cy = y;
  for (const ln of lines) {
    drawText(cv, ln, x, cy, size, color, opts);
    cy += lh;
  }
  return cy;
}

// shrink until the text fits maxW (never below minSize); returns size used
function fitText(cv: Canvas, text: string, x: number, y: number, maxW: number, size: number, color: RGB, opts: TextOpts = {}, minSize = 8): number {
  let s = size;
  while (s > minSize && textWidth(text, s, opts.tracking ?? 0) > maxW) s -= 0.5;
  drawText(cv, text, x, y, s, color, opts);
  return s;
}

// ------------------------------------------------------- illustration kit
// Every scene is drawn from primitives + deterministic hash texture.
// Shared helpers keep the three heroes and ten mediums visually dense.

function nightSky(cv: Canvas, x: number, y: number, w: number, h: number, seed: number): void {
  cv.vgrad(x, y, w, h, SKY_NIGHT2, NAVY_DARK);
  // stars
  const n = Math.floor((w * h) / 260);
  for (let i = 0; i < n; i++) {
    const sx = x + hash2(i, 11, seed) * w;
    const sy = y + hash2(i, 12, seed) * h * 0.62;
    const r = 0.5 + hash2(i, 13, seed) * 1.1;
    cv.disc(sx, sy, r, hash2(i, 14, seed) > 0.7 ? GOLD : WHITE, 0.5 + hash2(i, 15, seed) * 0.5);
  }
  // faint moon
  cv.disc(x + w * 0.82, y + h * 0.2, Math.min(w, h) * 0.075, [232, 226, 205], 0.95);
  cv.disc(x + w * 0.8, y + h * 0.18, Math.min(w, h) * 0.06, SKY_NIGHT2, 0.5);
}

function missileArc(cv: Canvas, x0: number, y0: number, x1: number, y1: number, bend: number, c: RGB, seed: number): void {
  // glowing arc + bright head + smoke puffs along the trail
  const pts: [number, number][] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const mx = x0 + (x1 - x0) * t;
    const my = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * bend;
    pts.push([mx, my]);
  }
  cv.polyLine(pts, c, 5, 0.25);
  cv.polyLine(pts, c, 2.6, 0.6);
  cv.polyLine(pts, [255, 240, 200], 1.2, 0.95);
  cv.disc(x1, y1, 3.4, [255, 220, 130], 0.95);
  cv.disc(x1, y1, 6.5, [255, 160, 60], 0.35);
  for (let i = 0; i < 6; i++) {
    const t = 0.15 + hash1(i, seed) * 0.6;
    const mx = x0 + (x1 - x0) * t;
    const my = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * bend;
    cv.disc(mx + (hash1(i, seed + 1) - 0.5) * 8, my + (hash1(i, seed + 2) - 0.5) * 6, 2 + hash1(i, seed + 3) * 3, [200, 200, 210], 0.28);
  }
}

function cityBlock(cv: Canvas, x: number, baseY: number, w: number, h: number, seed: number, lit: RGB): void {
  // dark skyline with lit windows, deterministic per building
  let bx = x;
  let i = 0;
  while (bx < x + w - 8) {
    const bw = 14 + hash1(i, seed) * 26;
    const bh = h * (0.35 + hash1(i, seed + 5) * 0.6);
    const top = baseY - bh;
    cv.fillRect(bx, top, bw, bh, [12, 14, 26]);
    cv.fillRect(bx, top, bw, 2, [30, 34, 52]);
    const cols = Math.max(1, Math.floor(bw / 9));
    const rows = Math.max(1, Math.floor(bh / 11));
    for (let r = 0; r < rows; r++) {
      for (let cc = 0; cc < cols; cc++) {
        if (hash2(cc, r, seed + i * 7) > 0.55) {
          const warm = hash2(cc, r, seed + i * 13) > 0.5;
          cv.fillRect(bx + 3 + cc * 9, top + 4 + r * 11, 4.5, 6, warm ? lit : [150, 190, 220], 0.9);
        }
      }
    }
    bx += bw + 2 + hash1(i, seed + 9) * 6;
    i++;
  }
}

function flame(cv: Canvas, cx: number, cy: number, s: number, seed: number): void {
  cv.disc(cx, cy, s * 1.15, [220, 60, 30], 0.4);
  cv.disc(cx, cy - s * 0.15, s * 0.8, [245, 130, 30], 0.75);
  cv.disc(cx, cy - s * 0.3, s * 0.45, [255, 205, 80], 0.95);
  cv.disc(cx + (hash1(1, seed) - 0.5) * s, cy - s * 0.7, s * 0.3, [255, 230, 140], 0.85);
  for (let i = 0; i < 4; i++) {
    cv.disc(cx + (hash1(i, seed + 4) - 0.5) * s * 1.6, cy - s * (1 + hash1(i, seed + 5)), s * 0.35, [90, 90, 100], 0.35);
  }
}

function smoke(cv: Canvas, cx: number, cy: number, s: number, seed: number): void {
  for (let i = 0; i < 7; i++) {
    const px = cx + (hash1(i, seed) - 0.5) * s * 2.2;
    const py = cy - hash1(i, seed + 2) * s * 1.4;
    cv.disc(px, py, s * (0.35 + hash1(i, seed + 3) * 0.45), [120, 118, 128], 0.32);
  }
}

function helicopter(cv: Canvas, cx: number, cy: number, s: number, c: RGB, seed: number): void {
  // body, tail, rotor, searchlight cone
  cv.poly([[cx - s, cy], [cx + s * 0.6, cy - s * 0.55], [cx + s * 1.5, cy - s * 0.35], [cx + s * 1.5, cy + s * 0.15], [cx + s * 0.4, cy + s * 0.45], [cx - s, cy + s * 0.45]], c, 1);
  cv.line(cx - s * 0.4, cy - s * 0.5, cx + s * 2.6, cy - s * 0.75, c, s * 0.12);
  cv.line(cx - s * 1.9, cy - s * 0.85, cx + s * 1.9, cy - s * 0.85, [200, 200, 210], s * 0.1);
  cv.line(cx + s * 2.5, cy - s * 0.75, cx + s * 2.5, cy - s * 0.15, c, s * 0.1);
  cv.disc(cx + s * 0.35, cy - s * 0.1, s * 0.22, [190, 220, 235], 0.95);
  cv.poly([[cx - s * 0.2, cy + s * 0.4], [cx + s * 0.2, cy + s * 0.4], [cx + s * 0.9, cy + s * 2.6], [cx - s * 0.9, cy + s * 2.6]], [255, 240, 180], 0.16);
  cv.disc(cx, cy + s * 2.7, s * 0.55, [255, 240, 180], 0.3);
  void seed;
}

function waves(cv: Canvas, x: number, y: number, w: number, h: number, seed: number): void {
  cv.vgrad(x, y, w, h, [24, 64, 96], [10, 28, 52]);
  for (let r = 0; r < 5; r++) {
    const yy = y + 4 + r * ((h - 6) / 4);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 20; i++) {
      pts.push([x + (i / 20) * w, yy + Math.sin(i * 1.3 + r * 2 + seed) * 2.2]);
    }
    cv.polyLine(pts, [120, 180, 210], 1.1, 0.35 + r * 0.06);
  }
}

// ------------------------------------------------------------------- data
// All facts below are copied from STORIES.md (locked, verified). Display
// summaries are condensed to fit the page; numbers, labels and outlets are
// verbatim from STORIES.md.
type Hero = { region: string; field: string; head: string; sum: string; label: string; art: string };
const HEROES: Hero[] = [
  {
    region: "MIDDLE EAST",
    field: "CONFLICT",
    head: "Iran strikes at US bases in Bahrain",
    sum: "Iran's Guards say they hit US positions at two Bahrain bases, claiming two Patriot radars hit. Bahrain says a civilian facility was hit and set on fire.",
    label: "CLAIM · IRGC",
    art: "gulf",
  },
  {
    region: "EUROPE",
    field: "UKRAINE WAR",
    head: "Russian missiles hit Zelenskyy's hometown; 2 killed, 60 hurt",
    sum: "Ballistic missiles struck Kryvyi Rih in a double-tap: a 7-year-old boy and a 20-year-old woman killed, 60 wounded including 6 children.",
    label: "CONFIRMED · AP",
    art: "kryvyi",
  },
  {
    region: "AMERICAS",
    field: "CARTELS",
    head: "Mexico captures FBI most-wanted cartel boss 'El Chapo Isidro'",
    sum: "Special forces captured Fausto Isidro Meza Flores, leader of Los Mazatlecos, in Guasave, Sinaloa, with US help. 11 killed in the fighting; $5m reward.",
    label: "CONFIRMED · AP / MEXICO DEFENCE MINISTRY",
    art: "sinaloa",
  },
];

type Medium = { region: string; field: string; head: string; sum: string; label: string; art: string };
const MEDIUMS: Medium[] = [
  { region: "WORLD", field: "CLIMATE", head: "COP31 runs into overtime, no deal", sum: "Antalya talks miss Friday's deadline; draft drops fossil-fuel language.", label: "CONFIRMED · AP / REUTERS", art: "cop" },
  { region: "WORLD", field: "MARKETS", head: "Wall Street correction confirmed", sum: "S&P and Dow enter correction; Nasdaq's worst week since March 2020.", label: "CONFIRMED · WSJ / REUTERS", art: "chart" },
  { region: "AMERICAS", field: "DISASTER", head: "6.9 quake shakes Peru's Andes", sum: "Magnitude 6.9 struck north of Junin at 00:09 UTC; 39 homes damaged.", label: "CONFIRMED · USGS / AP", art: "quake" },
  { region: "AMERICAS", field: "HEALTH", head: "Mosquitoes that beat dengue", sum: "A 4-year Belo Horizonte trial finds Wolbachia mosquitoes cut dengue ~69%.", label: "CONFIRMED · AP", art: "mosquito" },
  { region: "MIDDLE EAST", field: "GAZA", head: "Strikes kill 4 amid Gaza truce", sum: "Israeli bombardments kill at least 4 in Gaza despite the ceasefire.", label: "REPORTED · AL JAZEERA", art: "gaza" },
  { region: "EUROPE", field: "DIPLOMACY", head: "Trump tells Europe to defund Ukraine", sum: "Trump told Europe to withhold Ukraine funding after his Putin summit.", label: "REPORTED · TELEGRAPH", art: "phone" },
  { region: "AMERICAS", field: "SPORT", head: "Harden's 51 passes Kobe", sum: "Harden scores 51 in Cleveland's 128-119 win - his 26th 50-point game.", label: "CONFIRMED · AP", art: "hoops" },
  { region: "EUROPE", field: "WAR", head: "Ukraine hits Druzhba pipeline hub", sum: "Ukraine strikes the Kaleykino oil station, a Druzhba hub 1,000+ km away.", label: "CONFIRMED · UKRAINE GENERAL STAFF", art: "oil" },
  { region: "WORLD", field: "TECH", head: "Anthropic gives back its debut gains", sum: "Anthropic falls ~9% to ~$89, nearly back to its $83 IPO price.", label: "CONFIRMED · WSJ / MARKETWATCH", art: "ipo" },
  { region: "EUROPE", field: "SECURITY", head: "Denmark foils assassination plot", sum: "Danish authorities say they thwarted an assassination plot.", label: "REPORTED · DANISH AUTHORITIES", art: "copenhagen" },
];

// one-liners #14-35: [number, region, text, source]
const LINERS: [number, string, string, string][] = [
  [14, "EUROPE", "Zelenskyy: Putin must learn the Crimean Bridge \"will not stay\"", "Kyiv Independent"],
  [15, "EUROPE", "EU greenlights EUR 1bn in military support for Ukraine", "Kyiv Independent"],
  [16, "EUROPE", "NATO chief Rutte visits Poland after missiles land there", "ISW"],
  [17, "EUROPE", "Sweden summons Russia's envoy over blast by its Kyiv embassy", "Swedish govt"],
  [18, "EUROPE", "EU backs Poland over Russian airspace breach", "EU Council"],
  [19, "EUROPE", "Ukraine says it struck 3 Russian ballistic missile launchers", "Zelenskyy"],
  [20, "EUROPE", "Ukraine hits Russia's elite \"Rubicon\" drone unit in Kursk", "Kyiv Independent"],
  [21, "MIDDLE EAST", "Fire at Iraqi power plant kills 4", "local reports"],
  [22, "MIDDLE EAST", "Ship hit by mystery projectile off Oman's Khasab", "UKMTO"],
  [23, "MIDDLE EAST", "Bahrain seeks UN action and compensation over Iran strikes", "Bahrain govt"],
  [24, "MIDDLE EAST", "Iran's Araqchi wants diplomacy; Trump rejects the terms", "IRNA / AP"],
  [25, "MIDDLE EAST", "Houthis: 70+ Saudi bombing runs hit 8 Yemeni areas", "Houthi statement"],
  [26, "EUROPE", "Russian cargo ship ablaze in the Baltic after drone strike", "local reports"],
  [27, "AMERICAS", "FBI crime database hacked for a second time", "FBI (investigating)"],
  [28, "AMERICAS", "FEMA has an emergency of its own: bed bugs", "NYT"],
  [29, "AMERICAS", "$22.5m haul in \"staggering\" train heist", "police reports"],
  [30, "AMERICAS", "Canada retail sales strongest since 2022", "Statistics Canada"],
  [31, "AMERICAS", "Trump: US flight systems \"old-fashioned\" but \"secure\" after ground stop", "Trump"],
  [32, "ASIA", "EU-Indonesia deal agreed after ten years of talks", "EU / Indonesia"],
  [33, "AMERICAS", "Mexico's cell networks suffer major outages", "carriers"],
  [34, "EUROPE", "Only 6% of Russians blame the Kremlin for Ukraine's destruction", "poll"],
  [35, "AMERICAS", "US presses Ukraine to settle before Democrats take Congress", "report"],
];

const STATS: [string, string][] = [
  ["2", "US bases Iran says it struck in Bahrain"],
  ["60", "wounded in the Kryvyi Rih double-tap"],
  ["11", "killed in the Sinaloa capture raid"],
  ["6.9", "magnitude of the Peru quake"],
  ["-10%", "Nasdaq's week, worst since Mar 2020"],
  ["69%", "dengue cut by Wolbachia mosquitoes"],
];

const TIMELINE: [string, string][] = [
  ["OVERNIGHT", "Missiles hit Kryvyi Rih"],
  ["00:09 UTC", "6.9 quake strikes Peru"],
  ["01:00 UTC", "\"El Chapo Isidro\" captured"],
  ["MORNING", "COP31 talks resume, no deal"],
  ["14:00 UTC", "Wolbachia results reported"],
  ["EVENING", "Iran strikes US bases"],
];

const REGION_STRIP: [string, number][] = [
  ["EUROPE", 13],
  ["AMERICAS", 11],
  ["MIDDLE EAST", 7],
  ["WORLD", 3],
  ["ASIA", 1],
];
const FIELD_STRIP: [string, number][] = [
  ["CONFLICT", 8], ["WAR", 4], ["DIPLOMACY", 4], ["MARKETS", 3], ["SECURITY", 3],
  ["CRIME", 2], ["ENERGY", 2], ["POLITICS", 2], ["DISASTER", 1], ["HEALTH", 1],
  ["CLIMATE", 1], ["SPORT", 1], ["TECH", 1], ["JUSTICE", 1], ["TRANSPORT", 1],
];

// map pins: [n, label, true-x, true-y, pin-x, pin-y]
// pin-x/pin-y is the drawn position; a leader line joins it to the true spot,
// so the crowded Gulf / Europe pins do not pile on top of each other.
const PINS: [number, string, number, number, number, number][] = [
  [1, "Bahrain — Iran strikes US bases", 0.62, 0.56, 0.70, 0.64],
  [2, "Kryvyi Rih — double-tap strike", 0.52, 0.27, 0.52, 0.27],
  [3, "Guasave, Sinaloa — cartel boss captured", 0.13, 0.46, 0.13, 0.46],
  [4, "Antalya — COP31 overtime", 0.53, 0.36, 0.53, 0.36],
  [5, "Junin, Peru — 6.9 quake", 0.24, 0.72, 0.24, 0.72],
  [6, "Belo Horizonte — dengue mosquitoes", 0.31, 0.76, 0.31, 0.76],
  [7, "Gaza — strikes amid truce", 0.56, 0.44, 0.49, 0.50],
  [8, "Copenhagen — plot foiled", 0.48, 0.18, 0.48, 0.18],
  [9, "Kaleykino — Druzhba hub hit", 0.65, 0.20, 0.65, 0.20],
  [10, "Khasab, Oman — ship hit", 0.66, 0.58, 0.74, 0.56],
  [11, "Iraq — power plant fire kills 4", 0.63, 0.47, 0.69, 0.40],
  [12, "Baltic Sea — cargo ship ablaze", 0.49, 0.14, 0.42, 0.09],
];

// ------------------------------------------------------- hero illustrations
function artGulf(cv: Canvas, x: number, y: number, w: number, h: number, seed: number): void {
  nightSky(cv, x, y, w, h * 0.72, seed);
  // Manama skyline + Fifth Fleet base silhouette
  const baseY = y + h * 0.72;
  cityBlock(cv, x, baseY, w, h * 0.3, seed + 1, [255, 200, 110]);
  // sea at the bottom
  waves(cv, x, baseY, w, h * 0.28, seed + 2);
  // missile trails crossing the night sky
  missileArc(cv, x + w * 0.08, y + h * 0.1, x + w * 0.62, y + h * 0.5, h * 0.16, [255, 170, 80], seed + 3);
  missileArc(cv, x + w * 0.95, y + h * 0.05, x + w * 0.45, y + h * 0.42, h * 0.12, [255, 200, 120], seed + 4);
  missileArc(cv, x + w * 0.3, y + h * 0.02, x + w * 0.85, y + h * 0.55, h * 0.1, [255, 140, 90], seed + 5);
  // Patriot radar dish on the skyline
  const rx = x + w * 0.72;
  const ry = baseY - h * 0.1;
  cv.line(rx, ry, rx, ry + h * 0.1, [180, 190, 205], 2.5);
  cv.poly([[rx - 14, ry - 2], [rx + 2, ry - 16], [rx + 14, ry - 2]], [200, 205, 215], 0.95);
  cv.line(rx, ry - 2, rx + 16, ry - 18, [255, 220, 140], 1.4);
  // industrial fire glow on the shore
  flame(cv, x + w * 0.18, baseY - 4, 9, seed + 6);
  smoke(cv, x + w * 0.18, baseY - 14, 9, seed + 7);
  // ship silhouette on the water
  cv.poly([[x + w * 0.55, baseY + h * 0.12], [x + w * 0.78, baseY + h * 0.12], [x + w * 0.74, baseY + h * 0.2], [x + w * 0.58, baseY + h * 0.2]], [8, 12, 24], 1);
  cv.line(x + w * 0.62, baseY + h * 0.12, x + w * 0.62, baseY + h * 0.05, [8, 12, 24], 2);
  cv.speckle(x, y, w, h, 260, seed + 8, [255, 220, 160], 0.25);
}

function artKryvyi(cv: Canvas, x: number, y: number, w: number, h: number, seed: number): void {
  nightSky(cv, x, y, w, h * 0.7, seed);
  const baseY = y + h * 0.7;
  // damaged apartment block, centre-left
  const bx = x + w * 0.3;
  const bw = w * 0.36;
  const bh = h * 0.52;
  cv.fillRect(bx, baseY - bh, bw, bh, [22, 22, 34]);
  cv.fillRect(bx, baseY - bh, bw, 3, [40, 40, 56]);
  // broken corner: dark rubble wedge + smoke
  cv.poly([[bx + bw * 0.55, baseY - bh], [bx + bw, baseY - bh], [bx + bw, baseY - bh * 0.45], [bx + bw * 0.7, baseY - bh * 0.62]], [8, 8, 14], 1);
  smoke(cv, bx + bw * 0.8, baseY - bh * 0.5, 12, seed + 1);
  for (let r = 0; r < 6; r++) {
    for (let cc = 0; cc < 5; cc++) {
      const wx = bx + 6 + cc * ((bw - 12) / 5);
      const wy = baseY - bh + 8 + r * ((bh - 14) / 6);
      const broken = cc >= 3 && r <= 1;
      if (!broken && hash2(cc, r, seed + 2) > 0.45) {
        cv.fillRect(wx, wy, (bw - 12) / 5 - 4, (bh - 14) / 6 - 4, hash2(cc, r, seed + 3) > 0.6 ? [255, 190, 100] : [160, 200, 230], 0.9);
      }
    }
  }
  cityBlock(cv, x, baseY, w * 0.26, h * 0.3, seed + 4, [255, 190, 100]);
  // right-hand skyline, partly lit
  const rx = x + w * 0.72;
  cv.fillRect(rx, baseY - h * 0.34, w * 0.26, h * 0.34, [14, 16, 30]);
  for (let r = 0; r < 4; r++) {
    for (let cc = 0; cc < 4; cc++) {
      if (hash2(cc, r, seed + 5) > 0.5) cv.fillRect(rx + 5 + cc * 16, baseY - h * 0.34 + 6 + r * 12, 6, 7, [255, 200, 120], 0.9);
    }
  }
  // second missile incoming, top right
  missileArc(cv, x + w * 0.98, y + h * 0.04, x + w * 0.6, y + h * 0.42, h * 0.1, [255, 170, 80], seed + 6);
  // rescue lights at street level
  cv.fillRect(x, baseY, w, h * 0.3, [16, 16, 22]);
  for (let i = 0; i < 5; i++) {
    const lx = x + w * (0.1 + i * 0.18);
    cv.disc(lx, baseY + h * 0.12, 3, i % 2 ? [255, 60, 60] : [80, 140, 255], 0.9);
    cv.line(lx, baseY + h * 0.12, lx, baseY + h * 0.26, [120, 120, 140], 1.2);
  }
  // fire glow at the damaged block base
  flame(cv, bx + bw * 0.75, baseY - 2, 8, seed + 7);
  cv.speckle(x, y, w, h, 240, seed + 8, [255, 210, 150], 0.22);
}

function artSinaloa(cv: Canvas, x: number, y: number, w: number, h: number, seed: number): void {
  nightSky(cv, x, y, w, h * 0.66, seed);
  const baseY = y + h * 0.66;
  // desert mountains
  cv.poly([[x, baseY], [x + w * 0.22, baseY - h * 0.22], [x + w * 0.4, baseY], [x + w * 0.62, baseY - h * 0.28], [x + w * 0.85, baseY], [x + w, baseY - h * 0.16], [x + w, baseY]], [32, 26, 48], 1);
  cv.poly([[x + w * 0.62, baseY - h * 0.28], [x + w * 0.58, baseY - h * 0.2], [x + w * 0.66, baseY - h * 0.2]], [220, 215, 205], 0.8);
  // ground
  cv.vgrad(x, baseY, w, h * 0.34, [52, 40, 30], [26, 20, 16]);
  // road with burning roadblocks
  cv.poly([[x + w * 0.1, baseY + h * 0.3], [x + w * 0.9, baseY + h * 0.3], [x + w * 0.98, baseY + h * 0.34], [x, baseY + h * 0.34]], [40, 36, 34], 1);
  cv.line(x + w * 0.12, baseY + h * 0.32, x + w * 0.88, baseY + h * 0.32, [200, 180, 120], 1);
  flame(cv, x + w * 0.22, baseY + h * 0.24, 7, seed + 1);
  flame(cv, x + w * 0.78, baseY + h * 0.22, 6, seed + 2);
  smoke(cv, x + w * 0.22, baseY + h * 0.12, 8, seed + 3);
  // helicopters with searchlights
  helicopter(cv, x + w * 0.3, y + h * 0.22, 13, [24, 28, 40], seed + 4);
  helicopter(cv, x + w * 0.72, y + h * 0.14, 10, [30, 34, 48], seed + 5);
  // soldiers: small figures with torches at street level
  for (let i = 0; i < 4; i++) {
    const sx = x + w * (0.38 + i * 0.09);
    const sy = baseY + h * 0.2;
    cv.fillRect(sx - 2, sy - 12, 4, 12, [18, 22, 16]);
    cv.disc(sx, sy - 15, 3, [18, 22, 16]);
    cv.line(sx + 2, sy - 8, sx + 9, sy - 4, [255, 240, 180], 1.2);
    cv.disc(sx + 10, sy - 3, 2.5, [255, 240, 180], 0.8);
  }
  cv.speckle(x, y, w, h, 240, seed + 8, [255, 210, 140], 0.22);
}

function drawHeroArt(cv: Canvas, art: string, x: number, y: number, w: number, h: number, seed: number): void {
  if (art === "gulf") artGulf(cv, x, y, w, h, seed);
  else if (art === "kryvyi") artKryvyi(cv, x, y, w, h, seed);
  else artSinaloa(cv, x, y, w, h, seed);
  cv.fillRect(x, y, w, 1.5, INK, 0.55);
  cv.fillRect(x, y + h - 1.5, w, 1.5, INK, 0.55);
}

// ----------------------------------------------------- medium illustrations
function artCop(cv: Canvas, x: number, y: number, w: number, h: number, seed: number): void {
  cv.vgrad(x, y, w, h, [58, 88, 120], [24, 44, 70]);
  // big screen with crossed-out fossil text
  cv.fillRect(x + w * 0.1, y + 5, w * 0.8, h * 0.42, [240, 238, 228]);
  cv.fillRect(x + w * 0.16, y + 9, w * 0.5, 3, [40, 60, 90]);
  cv.fillRect(x + w * 0.16, y + 15, w * 0.62, 2.5, [120, 120, 120]);
  cv.line(x + w * 0.14, y + h * 0.3, x + w * 0.86, y + h * 0.18, RED, 2.2);
  cv.line(x + w * 0.14, y + h * 0.18, x + w * 0.86, y + h * 0.3, RED, 2.2);
  // conference table + empty chairs
  cv.fillRect(x + w * 0.08, y + h * 0.62, w * 0.84, h * 0.1, [90, 60, 40]);
  for (let i = 0; i < 4; i++) {
    const cx = x + w * (0.16 + i * 0.22);
    cv.fillRect(cx, y + h * 0.72, w * 0.12, h * 0.22, [150, 120, 80]);
    cv.fillRect(cx, y + h * 0.66, w * 0.12, h * 0.08, [120, 95, 60]);
  }
  cv.speckle(x, y, w, h, 90, seed, WHITE, 0.18);
}

function artChart(cv: Canvas, x: number, y: number, w: number, h: number, seed: number): void {
  cv.vgrad(x, y, w, h, [248, 240, 226], [232, 214, 190]);
  // grid
  for (let i = 1; i < 4; i++) cv.line(x, y + (h / 4) * i, x + w, y + (h / 4) * i, [200, 185, 160], 0.8);
  // plunging line with red arrows
  const pts: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const px = x + 6 + (i / 8) * (w - 12);
    const py = y + 6 + Math.pow(i / 8, 1.6) * (h - 14) + (hash1(i, seed) - 0.5) * 5;
    pts.push([px, py]);
  }
  cv.polyLine(pts, RED, 2.6, 0.95);
  cv.polyLine(pts, [255, 120, 110], 1.2, 0.7);
  for (let i = 2; i <= 8; i += 3) {
    cv.poly([[pts[i][0], pts[i][1] - 7], [pts[i][0] + 6, pts[i][1] + 1], [pts[i][0] - 6, pts[i][1] + 1]], RED, 0.95);
  }
  // candlesticks
  for (let i = 0; i < 6; i++) {
    const cx = x + 10 + i * ((w - 20) / 6);
    const top = y + 6 + i * ((h - 18) / 7);
    cv.fillRect(cx, top, 5, h - top - 6, i % 2 ? [200, 50, 50] : [60, 140, 90], 0.85);
  }
  cv.speckle(x, y, w, h, 70, seed, RED, 0.15);
}

function artQuake(cv: Canvas, x: number, y: number, w: number, h: number, seed: number): void {
  cv.vgrad(x, y, w, h, [150, 180, 205], [90, 120, 150]);
  // Andes peaks
  cv.poly([[x, y + h], [x + w * 0.25, y + h * 0.25], [x + w * 0.45, y + h], [x + w * 0.6, y + h * 0.4], [x + w * 0.8, y + h], [x + w, y + h * 0.55], [x + w, y + h]], [70, 90, 110], 1);
  cv.poly([[x + w * 0.25, y + h * 0.25], [x + w * 0.19, y + h * 0.42], [x + w * 0.31, y + h * 0.42]], WHITE, 0.9);
  cv.poly([[x + w * 0.6, y + h * 0.4], [x + w * 0.55, y + h * 0.55], [x + w * 0.65, y + h * 0.55]], WHITE, 0.9);
  // shaking houses
  for (let i = 0; i < 3; i++) {
    const hx = x + w * (0.08 + i * 0.3);
    const tilt = (hash1(i, seed) - 0.5) * 6;
    cv.poly([[hx + tilt, y + h * 0.72], [hx + 14 + tilt, y + h * 0.72], [hx + 14 + tilt, y + h * 0.9], [hx + tilt, y + h * 0.9]], [200, 170, 130], 1);
    cv.poly([[hx - 2 + tilt, y + h * 0.72], [hx + 7 + tilt, y + h * 0.6], [hx + 16 + tilt, y + h * 0.72]], [160, 60, 50], 1);
  }
  // seismograph zigzag
  const sp: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const px = x + 4 + (i / 24) * (w - 8);
    const amp = i > 10 && i < 18 ? 9 : 2;
    sp.push([px, y + h * 0.52 + (hash1(i, seed + 1) - 0.5) * 2 * amp]);
  }
  cv.polyLine(sp, [20, 20, 30], 1.4, 0.9);
  cv.speckle(x, y, w, h, 80, seed, WHITE, 0.2);
}

function artMosquito(cv: Canvas, x: number, y: number, w: number, h: number, seed: number): void {
  cv.vgrad(x, y, w, h, [120, 190, 170], [40, 120, 100]);
  // Brazilian street: coloured houses
  const cols: RGB[] = [[230, 180, 60], [200, 90, 70], [90, 150, 200], [240, 220, 180]];
  for (let i = 0; i < 4; i++) {
    const hx = x + i * (w / 4);
    cv.fillRect(hx + 2, y + h * 0.55, w / 4 - 4, h * 0.45, cols[i]);
    cv.fillRect(hx + w / 4 / 2 - 4, y + h * 0.68, 8, 10, [60, 40, 30]);
    cv.fillRect(hx + 6, y + h * 0.6, 8, 7, [240, 240, 220]);
  }
  // mosquito, large
  const cx = x + w * 0.62;
  const cy = y + h * 0.32;
  cv.disc(cx, cy, 3.5, [30, 30, 30]);
  cv.poly([[cx, cy], [cx + 16, cy + 3], [cx + 2, cy + 5]], [40, 40, 40], 1);
  cv.line(cx - 2, cy, cx - 12, cy + 4, [30, 30, 30], 1.4);
  for (let i = 0; i < 3; i++) {
    cv.line(cx + 2 + i * 4, cy + 3, cx - 2 + i * 5, cy + 14, [30, 30, 30], 1);
  }
  cv.poly([[cx - 2, cy - 2], [cx - 16, cy - 12], [cx - 4, cy - 1]], [255, 255, 255], 0.45);
  cv.poly([[cx + 2, cy - 2], [cx + 14, cy - 12], [cx + 5, cy - 1]], [255, 255, 255], 0.45);
  // 69% badge
  cv.disc(x + w * 0.16, y + h * 0.26, 11, RED, 0.95);
  cv.ring(x + w * 0.16, y + h * 0.26, 11, WHITE, 1.5);
  drawText(cv, "69%", x + w * 0.16, y + h * 0.26 - 5, 10, WHITE, { bold: true, align: "center" });
  cv.speckle(x, y, w, h, 70, seed, WHITE, 0.2);
}

function artGaza(cv: Canvas, x: number, y: number, w: number, h: number, seed: number): void {
  cv.vgrad(x, y, w, h, [210, 170, 130], [120, 90, 70]);
  // skyline + rubble
  for (let i = 0; i < 5; i++) {
    const bx = x + i * (w / 5);
    const bh = h * (0.3 + hash1(i, seed) * 0.3);
    cv.fillRect(bx + 2, y + h * 0.62 - bh, w / 5 - 4, bh + h * 0.38, [90, 80, 75]);
    cv.fillRect(bx + 2, y + h * 0.62 - bh, w / 5 - 4, 3, [60, 52, 48]);
  }
  cv.poly([[x + w * 0.1, y + h], [x + w * 0.3, y + h * 0.72], [x + w * 0.5, y + h], [x + w * 0.7, y + h * 0.78], [x + w * 0.9, y + h]], [70, 62, 58], 1);
  smoke(cv, x + w * 0.3, y + h * 0.7, 10, seed + 1);
  smoke(cv, x + w * 0.72, y + h * 0.76, 8, seed + 2);
  // rescue workers: two figures with a stretcher
  for (let i = 0; i < 2; i++) {
    const fx = x + w * (0.3 + i * 0.3);
    cv.fillRect(fx - 2, y + h * 0.86, 4, 10, [40, 80, 140]);
    cv.disc(fx, y + h * 0.83, 3, [40, 80, 140]);
  }
  cv.line(x + w * 0.32, y + h * 0.9, x + w * 0.58, y + h * 0.9, [240, 240, 230], 2);
  cv.speckle(x, y, w, h, 110, seed, [60, 50, 45], 0.3);
}

function artPhone(cv: Canvas, x: number, y: number, w: number, h: number, seed: number): void {
  cv.vgrad(x, y, w, h, [40, 60, 100], [20, 32, 60]);
  // flags row
  const flags: RGB[][] = [[[180, 40, 40], WHITE, [40, 60, 140]], [[40, 90, 160], [200, 170, 60], [40, 90, 160]], [[255, 255, 255], [40, 80, 160], [200, 40, 40]]];
  for (let i = 0; i < 3; i++) {
    const fx = x + w * (0.08 + i * 0.3);
    for (let s = 0; s < 3; s++) cv.fillRect(fx, y + 6 + s * 5, w * 0.2, 5, flags[i][s]);
  }
  // handset + sound waves
  cv.poly([[x + w * 0.42, y + h * 0.5], [x + w * 0.5, y + h * 0.42], [x + w * 0.62, y + h * 0.55], [x + w * 0.55, y + h * 0.68], [x + w * 0.42, y + h * 0.5]], [30, 30, 38], 1);
  cv.disc(x + w * 0.45, y + h * 0.48, 3, [220, 220, 220]);
  for (let r = 1; r <= 3; r++) {
    cv.ring(x + w * 0.52, y + h * 0.55, r * 7, [255, 220, 120], 1.2);
  }
  // summit table
  cv.fillRect(x + w * 0.06, y + h * 0.78, w * 0.88, h * 0.08, [120, 90, 60]);
  cv.fillRect(x + w * 0.14, y + h * 0.7, w * 0.1, h * 0.08, [200, 200, 190]);
  cv.fillRect(x + w * 0.76, y + h * 0.7, w * 0.1, h * 0.08, [200, 200, 190]);
  cv.speckle(x, y, w, h, 70, seed, WHITE, 0.15);
}

function artHoops(cv: Canvas, x: number, y: number, w: number, h: number, seed: number): void {
  cv.vgrad(x, y, w, h, [190, 120, 60], [120, 70, 30]);
  // court floor + lines
  cv.fillRect(x, y + h * 0.62, w, h * 0.38, [160, 100, 55]);
  cv.line(x, y + h * 0.62, x + w, y + h * 0.62, WHITE, 1.2);
  cv.line(x + w * 0.5, y + h * 0.62, x + w * 0.5, y + h, WHITE, 1);
  cv.ring(x + w * 0.5, y + h * 0.8, 12, WHITE, 1.2);
  // hoop + backboard
  cv.fillRect(x + w * 0.72, y + h * 0.1, 3, h * 0.4, [220, 220, 210]);
  cv.fillRect(x + w * 0.62, y + h * 0.08, w * 0.2, h * 0.22, WHITE, 0.9);
  cv.fillRect(x + w * 0.66, y + h * 0.12, w * 0.12, h * 0.14, RED, 0.85);
  cv.ring(x + w * 0.72, y + h * 0.34, 7, [230, 90, 40], 2);
  // ball mid-flight
  cv.disc(x + w * 0.42, y + h * 0.3, 9, [230, 110, 40], 0.95);
  cv.ring(x + w * 0.42, y + h * 0.3, 9, [120, 50, 20], 1);
  cv.line(x + w * 0.42 - 9, y + h * 0.3, x + w * 0.42 + 9, y + h * 0.3, [120, 50, 20], 1);
  // shooter silhouette
  cv.disc(x + w * 0.3, y + h * 0.52, 4, [25, 25, 35]);
  cv.line(x + w * 0.3, y + h * 0.56, x + w * 0.3, y + h * 0.78, [25, 25, 35], 3);
  cv.line(x + w * 0.3, y + h * 0.6, x + w * 0.4, y + h * 0.42, [25, 25, 35], 2.4);
  cv.line(x + w * 0.3, y + h * 0.78, x + w * 0.22, y + h * 0.96, [25, 25, 35], 2.4);
  cv.line(x + w * 0.3, y + h * 0.78, x + w * 0.38, y + h * 0.96, [25, 25, 35], 2.4);
  // scoreboard chip
  cv.fillRect(x + w * 0.06, y + 5, w * 0.34, 13, [20, 20, 28], 0.95);
  drawText(cv, "128-119", x + w * 0.08, y + 6, 9, [255, 220, 120], { bold: true });
  cv.speckle(x, y, w, h, 60, seed, WHITE, 0.15);
}

function artOil(cv: Canvas, x: number, y: number, w: number, h: number, seed: number): void {
  cv.vgrad(x, y, w, h, [60, 60, 70], [25, 25, 32]);
  // pumping station tanks
  for (let i = 0; i < 3; i++) {
    const tx = x + w * (0.08 + i * 0.26);
    cv.fillRect(tx, y + h * 0.55, w * 0.2, h * 0.4, [150, 150, 155]);
    cv.fillRect(tx, y + h * 0.55, w * 0.2, 3, [200, 200, 205]);
    cv.fillRect(tx + 4, y + h * 0.66, 6, 8, [60, 60, 66]);
  }
  // derrick
  cv.line(x + w * 0.78, y + h * 0.95, x + w * 0.86, y + h * 0.15, [200, 200, 205], 2);
  cv.line(x + w * 0.94, y + h * 0.95, x + w * 0.86, y + h * 0.15, [200, 200, 205], 2);
  cv.line(x + w * 0.8, y + h * 0.7, x + w * 0.92, y + h * 0.7, [200, 200, 205], 1.4);
  cv.line(x + w * 0.82, y + h * 0.45, x + w * 0.9, y + h * 0.45, [200, 200, 205], 1.4);
  // fire + pipeline
  flame(cv, x + w * 0.4, y + h * 0.55, 8, seed + 1);
  smoke(cv, x + w * 0.4, y + h * 0.42, 9, seed + 2);
  cv.line(x, y + h * 0.92, x + w, y + h * 0.92, [180, 120, 50], 3);
  cv.line(x, y + h * 0.86, x + w, y + h * 0.86, [120, 80, 30], 1.2);
  cv.speckle(x, y, w, h, 80, seed, [255, 180, 90], 0.2);
}

function artIpo(cv: Canvas, x: number, y: number, w: number, h: number, seed: number): void {
  cv.vgrad(x, y, w, h, [248, 242, 230], [228, 210, 185]);
  for (let i = 1; i < 4; i++) cv.line(x, y + (h / 4) * i, x + w, y + (h / 4) * i, [200, 185, 160], 0.8);
  // IPO line at $83, debut spike, fall back to ~$89
  const ipoY = y + h * 0.62;
  cv.line(x + 4, ipoY, x + w - 4, ipoY, [60, 120, 90], 1.4);
  drawText(cv, "IPO $83", x + w - 42, ipoY - 11, 8, [60, 120, 90], { bold: true });
  const pts: [number, number][] = [
    [x + 4, ipoY], [x + w * 0.25, y + h * 0.55], [x + w * 0.45, y + h * 0.12],
    [x + w * 0.62, y + h * 0.3], [x + w * 0.8, y + h * 0.5], [x + w - 4, y + h * 0.56],
  ];
  cv.polyLine(pts, RED, 2.6, 0.95);
  cv.disc(x + w * 0.45, y + h * 0.12, 4, RED, 0.95);
  cv.disc(x + w - 4, y + h * 0.56, 3.5, RED, 0.95);
  drawText(cv, "~$89", x + w - 30, y + h * 0.56 - 12, 8, RED, { bold: true });
  cv.speckle(x, y, w, h, 60, seed, RED, 0.12);
}

function artCopenhagen(cv: Canvas, x: number, y: number, w: number, h: number, seed: number): void {
  cv.vgrad(x, y, w, h, [170, 200, 225], [110, 150, 185]);
  // colourful Nyhavn-style row houses
  const cols: RGB[] = [[200, 90, 70], [230, 180, 60], [90, 150, 200], [200, 120, 90], [120, 170, 130]];
  for (let i = 0; i < 5; i++) {
    const hx = x + i * (w / 5);
    const hw = w / 5 - 3;
    const hh = h * (0.42 + hash1(i, seed) * 0.2);
    cv.fillRect(hx + 1, y + h * 0.85 - hh, hw, hh, cols[i]);
    cv.poly([[hx + 1, y + h * 0.85 - hh], [hx + 1 + hw / 2, y + h * 0.85 - hh - 8], [hx + 1 + hw, y + h * 0.85 - hh]], [60, 50, 45], 1);
    cv.fillRect(hx + hw / 2 - 3, y + h * 0.85 - hh + 8, 6, 8, [240, 240, 220]);
    cv.fillRect(hx + 4, y + h * 0.85 - hh + 8, 5, 6, [240, 240, 220]);
  }
  // street + police cordon
  cv.fillRect(x, y + h * 0.85, w, h * 0.15, [70, 70, 78]);
  cv.line(x, y + h * 0.9, x + w, y + h * 0.9, [240, 220, 90], 2);
  for (let i = 0; i < 4; i++) {
    const px = x + w * (0.1 + i * 0.24);
    cv.line(px, y + h * 0.82, px, y + h * 0.98, [40, 60, 140], 2.4);
    cv.disc(px, y + h * 0.79, 3, [40, 60, 140]);
  }
  cv.speckle(x, y, w, h, 70, seed, WHITE, 0.18);
}

function drawMediumArt(cv: Canvas, art: string, x: number, y: number, w: number, h: number, seed: number): void {
  if (art === "cop") artCop(cv, x, y, w, h, seed);
  else if (art === "chart") artChart(cv, x, y, w, h, seed);
  else if (art === "quake") artQuake(cv, x, y, w, h, seed);
  else if (art === "mosquito") artMosquito(cv, x, y, w, h, seed);
  else if (art === "gaza") artGaza(cv, x, y, w, h, seed);
  else if (art === "phone") artPhone(cv, x, y, w, h, seed);
  else if (art === "hoops") artHoops(cv, x, y, w, h, seed);
  else if (art === "oil") artOil(cv, x, y, w, h, seed);
  else if (art === "ipo") artIpo(cv, x, y, w, h, seed);
  else artCopenhagen(cv, x, y, w, h, seed);
  cv.fillRect(x, y, w, 1, INK, 0.4);
  cv.fillRect(x, y + h - 1, w, 1, INK, 0.4);
}

// ------------------------------------------------------------- page layout
const MX = 16; // page margin
const CW = W - MX * 2; // 992 content width

function sectionKicker(cv: Canvas, x: number, y: number, w: number, text: string, color: RGB): void {
  drawText(cv, text, x, y, 10, color, { bold: true, tracking: 1.2 });
  cv.fillRect(x, y + 13, w, 1, color, 0.85);
}

function drawMasthead(cv: Canvas): number {
  let y = 10;
  // top kicker row
  drawText(cv, "THE WORLD IN ONE DAY", MX, y, 11, RED, { bold: true, tracking: 1.6 });
  const right = "SATURDAY EDITION  ·  No. 21  ·  2026";
  drawText(cv, right, MX + CW - textWidth(right, 10, 1), y + 1, 10, INK_SOFT, { tracking: 1 });
  y += 14;
  cv.fillRect(MX, y, CW, 2.5, INK);
  cv.fillRect(MX, y + 4, CW, 1, INK);
  y += 7;
  // big serif date masthead (30px so the counts fit beside it)
  drawText(cv, "Saturday, 21 November 2026", MX, y, 30, INK, { bold: true, serif: true });
  const counts = "35 STORIES  ·  5 REGIONS";
  drawText(cv, counts, MX + CW - textWidth(counts, 14, 0.6), y + 14, 14, RED, { bold: true, tracking: 0.6 });
  y += 42;
  cv.fillRect(MX, y, CW, 1, CREAM_LINE);
  y += 6;
  // region-count strip
  let rx = MX;
  for (const [name, n] of REGION_STRIP) {
    const col = REGION_COLORS[name];
    cv.disc(rx + 4, y + 5, 3.5, col, 1);
    const t = `${name} ${n}`;
    drawText(cv, t, rx + 11, y, 10.5, INK, { bold: true });
    rx += 11 + textWidth(t, 10.5) + 18;
  }
  drawText(cv, "35 STORIES", MX + CW - textWidth("35 STORIES", 10.5), y, 10.5, RED, { bold: true });
  y += 14;
  // field-count strip: the eight biggest fields, then the seven singletons grouped
  let fx = MX;
  const fieldParts = FIELD_STRIP.slice(0, 8).map(([name, n]) => `${name} ${n}`);
  fieldParts.push("7 MORE FIELDS x1");
  for (const t of fieldParts) {
    drawText(cv, t, fx, y, 9, INK_SOFT, {});
    fx += textWidth(t, 9) + 8;
    if (fx < MX + CW - 4) drawText(cv, "·", fx - 5, y, 9, GOLD, { bold: true });
  }
  y += 12;
  return y;
}

function drawStats(cv: Canvas, y: number): number {
  const gap = 6;
  const bw = (CW - gap * 5) / 6;
  for (let i = 0; i < STATS.length; i++) {
    const [num, label] = STATS[i];
    const x = MX + i * (bw + gap);
    cv.fillRect(x, y, bw, 52, i % 2 ? [238, 230, 214] : [232, 224, 206]);
    cv.fillRect(x, y, bw, 2.5, i % 2 ? NAVY : RED);
    cv.fillRect(x, y, 1, 52, CREAM_LINE);
    cv.fillRect(x + bw - 1, y, 1, 52, CREAM_LINE);
    drawText(cv, num, x + 8, y + 3, 22, i % 2 ? NAVY : RED, { bold: true, serif: true });
    drawPara(cv, label, x + 8, y + 26, bw - 14, 8.8, INK_SOFT, { lh: 12 });
  }
  return y + 52;
}

function drawHeroes(cv: Canvas, y: number): number {
  const gap = 8;
  const bw = (CW - gap * 2) / 3;
  const artH = 68;
  const headY = y + artH + 8;
  let maxBottom = y;
  for (let i = 0; i < 3; i++) {
    const h = HEROES[i];
    const x = MX + i * (bw + gap);
    const col = REGION_COLORS[h.region];
    // region tab
    cv.fillRect(x, y - 1, bw, 3, col);
    drawHeroArt(cv, h.art, x, y, bw, artH, 100 + i * 17);
    // number badge + region/field
    cv.disc(x + 12, y + 12, 10, RED, 0.95);
    drawText(cv, String(i + 1), x + 12, y + 12 - 6, 12, WHITE, { bold: true, align: "center" });
    drawText(cv, `${h.region}  ·  ${h.field}`, x, headY, 9.5, col, { bold: true, tracking: 0.6 });
    const hy = drawPara(cv, h.head, x, headY + 13, bw, 14.5, INK, { bold: true, serif: true, lh: 20 });
    const sy = drawPara(cv, h.sum, x, hy + 3, bw, 10, INK_SOFT, { lh: 13.6 });
    drawText(cv, h.label, x, sy + 3, 9, RED, { bold: true, tracking: 0.4 });
    // second label for H1 (Bahrain account confirmed by Reuters)
    if (i === 0) drawText(cv, "CONFIRMED · REUTERS", x + textWidth(h.label, 9) + 12, sy + 3, 9, NAVY, { bold: true, tracking: 0.4 });
    maxBottom = Math.max(maxBottom, sy + 16);
    // vertical divider
    if (i < 2) cv.fillRect(x + bw + 4, y, 1, maxBottom - y, CREAM_LINE);
  }
  return maxBottom;
}

function drawTimeline(cv: Canvas, y: number): number {
  cv.fillRect(MX, y, CW, 1, INK);
  drawText(cv, "THE DAY IN UTC", MX, y + 4, 9.5, RED, { bold: true, tracking: 1 });
  const slotW = CW / 6;
  for (let i = 0; i < TIMELINE.length; i++) {
    const [t, txt] = TIMELINE[i];
    const x = MX + i * slotW;
    const yy = y + 16;
    cv.disc(x + 5, yy + 4, 3, RED, 1);
    if (i < 5) {
      // connector runs in the clear space after the time label, never through text
      const lx0 = x + 12 + textWidth(t, 9.5) + 8;
      cv.line(lx0, yy + 4, x + slotW - 6, yy + 4, CREAM_LINE, 1.4);
    }
    drawText(cv, t, x + 12, yy - 1, 9.5, NAVY, { bold: true });
    drawPara(cv, txt, x + 12, yy + 11, slotW - 16, 9, INK_SOFT, { lh: 12.2 });
  }
  return y + 52;
}

function drawMediums(cv: Canvas, y: number): number {
  sectionKicker(cv, MX, y, CW, "MORE OF THE DAY — TEN STORIES THAT SHAPED IT", NAVY);
  const top = y + 18;
  const gapX = 7;
  const gapY = 8;
  const bw = (CW - gapX * 4) / 5;
  const bh = 116;
  const artH = 26;
  for (let i = 0; i < 10; i++) {
    const m = MEDIUMS[i];
    const col = i % 5;
    const row = Math.floor(i / 5);
    const x = MX + col * (bw + gapX);
    const cy = top + row * (bh + gapY);
    const rc = REGION_COLORS[m.region];
    cv.fillRect(x, cy, bw, bh, [250, 246, 238]);
    cv.fillRect(x, cy, bw, 2, rc);
    drawMediumArt(cv, m.art, x, cy + 2, bw, artH, 200 + i * 13);
    // story number chip
    cv.disc(x + 11, cy + artH + 12, 8, rc, 0.95);
    drawText(cv, String(i + 4), x + 11, cy + artH + 12 - 5, 10, WHITE, { bold: true, align: "center" });
    drawText(cv, `${m.region} · ${m.field}`, x + 22, cy + artH + 8, 8, rc, { bold: true, tracking: 0.3 });
    const hy = drawPara(cv, m.head, x + 4, cy + artH + 20, bw - 8, 10, INK, { bold: true, serif: true, lh: 13.6 });
    const sy = drawPara(cv, m.sum, x + 4, hy + 1, bw - 8, 8.5, INK_SOFT, { lh: 11.6 });
    // source label right under the summary, shrunk to fit the cell width
    fitText(cv, m.label, x + 4, sy + 2, bw - 8, 8, RED, { bold: true, tracking: 0.2 }, 6.5);
  }
  return top + 2 * bh + gapY;
}

function drawLiners(cv: Canvas, y: number): number {
  sectionKicker(cv, MX, y, CW, "THE REST OF THE DAY — 22 MORE STORIES", NAVY);
  const top = y + 18;
  const colW = (CW - 24) / 2;
  const rowH = 13;
  for (let i = 0; i < LINERS.length; i++) {
    const [n, region, text, src] = LINERS[i];
    const col = Math.floor(i / 11);
    const row = i % 11;
    const x = MX + col * (colW + 24);
    const cy = top + row * rowH;
    const rc = REGION_COLORS[region];
    drawText(cv, String(n), x, cy, 9, rc, { bold: true });
    const tx = x + 20;
    drawText(cv, region, tx, cy + 1, 8, rc, { bold: true, tracking: 0.4 });
    const rx = tx + textWidth(region, 8) + 6;
    let full = `${text} — ${src}`;
    // truncate with an ellipsis so long lines never bleed into the next column
    let s = 9;
    while (s > 8 && textWidth(full, s) > colW - (rx - x)) s -= 0.5;
    while (textWidth(full, s) > colW - (rx - x) && full.length > 4) {
      full = full.slice(0, -4) + "...";
    }
    drawText(cv, full, rx, cy, s, INK, {});
    if (row % 2 === 0) cv.fillRect(x, cy + 11, colW, 0.8, [232, 224, 208]);
  }
  return top + 11 * rowH + 4;
}

// ------------------------------------------------------------ world map
function drawMap(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, [214, 228, 236]);
  cv.fillRect(x, y, w, 2, NAVY);
  drawText(cv, "WHERE IT HAPPENED", x + 8, y + 6, 10, NAVY, { bold: true, tracking: 1 });
  const mx = x + 6;
  const my = y + 22;
  const mw = w * 0.56;
  const mh = h - 30;
  // ocean texture
  cv.speckle(mx, my, mw, mh, 160, 77, [160, 190, 210], 0.35);
  // rough continents (stylised, labelled by pins not borders)
  const land: RGB = [222, 205, 165];
  const land2: RGB = [205, 190, 150];
  // North America
  cv.poly([[mx + mw * 0.02, my + mh * 0.3], [mx + mw * 0.1, my + mh * 0.12], [mx + mw * 0.24, my + mh * 0.1], [mx + mw * 0.3, my + mh * 0.26], [mx + mw * 0.26, my + mh * 0.42], [mx + mw * 0.16, my + mh * 0.5], [mx + mw * 0.05, my + mh * 0.44]], land, 1);
  // South America
  cv.poly([[mx + mw * 0.26, my + mh * 0.55], [mx + mw * 0.34, my + mh * 0.52], [mx + mw * 0.36, my + mh * 0.72], [mx + mw * 0.3, my + mh * 0.92], [mx + mw * 0.24, my + mh * 0.78]], land2, 1);
  // Europe
  cv.poly([[mx + mw * 0.46, my + mh * 0.18], [mx + mw * 0.55, my + mh * 0.1], [mx + mw * 0.62, my + mh * 0.16], [mx + mw * 0.58, my + mh * 0.3], [mx + mw * 0.48, my + mh * 0.3]], land, 1);
  // Africa
  cv.poly([[mx + mw * 0.48, my + mh * 0.36], [mx + mw * 0.6, my + mh * 0.34], [mx + mw * 0.66, my + mh * 0.48], [mx + mw * 0.6, my + mh * 0.7], [mx + mw * 0.52, my + mh * 0.62]], land2, 1);
  // Asia
  cv.poly([[mx + mw * 0.62, my + mh * 0.1], [mx + mw * 0.82, my + mh * 0.06], [mx + mw * 0.95, my + mh * 0.16], [mx + mw * 0.92, my + mh * 0.34], [mx + mw * 0.8, my + mh * 0.42], [mx + mw * 0.66, my + mh * 0.32]], land, 1);
  // Australia
  cv.poly([[mx + mw * 0.82, my + mh * 0.68], [mx + mw * 0.92, my + mh * 0.66], [mx + mw * 0.94, my + mh * 0.78], [mx + mw * 0.84, my + mh * 0.8]], land2, 1);
  // graticule
  for (let i = 1; i < 4; i++) cv.line(mx, my + (mh / 4) * i, mx + mw, my + (mh / 4) * i, [180, 200, 214], 0.7);
  for (let i = 1; i < 5; i++) cv.line(mx + (mw / 5) * i, my, mx + (mw / 5) * i, my + mh, [180, 200, 214], 0.7);
  // numbered pins, with leader lines where the pin is offset from its true spot
  for (const [n, , px, py, dx, dy] of PINS) {
    const tx = mx + px * mw;
    const ty = my + py * mh;
    const cx = mx + dx * mw;
    const cy = my + dy * mh;
    if (Math.abs(dx - px) > 0.01 || Math.abs(dy - py) > 0.01) {
      cv.line(tx, ty, cx, cy, RED, 1.1);
      cv.disc(tx, ty, 1.8, RED, 1);
    }
    cv.disc(cx, cy, 6.5, RED, 0.95);
    cv.ring(cx, cy, 6.5, WHITE, 1.2);
    drawText(cv, String(n), cx, cy - 4.5, 9, WHITE, { bold: true, align: "center" });
  }
  // legend in two columns, place names only, right of the map
  const lx = x + w * 0.6;
  drawText(cv, "PIN KEY", lx, y + 6, 9.5, NAVY, { bold: true, tracking: 1 });
  const legendPlaces = ["Bahrain", "Kryvyi Rih", "Guasave", "Antalya", "Junin, Peru", "B. Horizonte", "Gaza", "Copenhagen", "Kaleykino", "Khasab", "Iraq", "Baltic Sea"];
  for (let k = 0; k < 12; k++) {
    const col = Math.floor(k / 6);
    const row = k % 6;
    const ex = lx + col * 130;
    const ey = y + 22 + row * 11;
    cv.disc(ex + 5, ey + 4, 5.5, RED, 0.95);
    drawText(cv, String(k + 1), ex + 5, ey - 1, 8, WHITE, { bold: true, align: "center" });
    drawText(cv, legendPlaces[k], ex + 14, ey, 8, INK, {});
  }
}

// ---------------------------------------------------------- date check box
function drawDateCheck(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, [253, 240, 236]);
  cv.fillRect(x, y, w, 2.5, RED);
  cv.fillRect(x, y + h - 2.5, w, 2.5, RED);
  cv.fillRect(x, y, 2.5, h, RED);
  cv.fillRect(x + w - 2.5, y, 2.5, h, RED);
  let cy = y + 4;
  drawText(cv, "DATE CHECK", x + 10, cy, 12, RED, { bold: true, serif: true, tracking: 0.8 });
  cy += 16;
  drawText(cv, "LEFT OUT — WRONG DAY OR NOT YET:", x + 10, cy, 9, RED_DARK, { bold: true });
  cy += 12;
  const leftOut = [
    "Thu 19 Nov: Myanmar genocide ruling; Anthropic $2tn IPO; Trump-Putin-Xi summit.",
    "Fri 20 Nov: 500-weapon barrage hits Kyiv bridges; Cyclone Akvan in Odisha; S&P -3.7%.",
    "Not yet: COP31 final deal (Sun 22 Nov); Nepal PM Bhandari's India visit (22-23 Nov).",
  ];
  for (const t of leftOut) {
    cy = drawPara(cv, "·  " + t, x + 10, cy, w - 20, 8.5, INK, { lh: 11.6 });
  }
  cy += 2;
  drawPara(cv, "Every story here happened or was first reported on Saturday 21 November 2026.", x + 10, cy, w - 20, 8.5, INK, { bold: true, lh: 11.2 });
}

// -------------------------------------------------------------------- main
function build(): Canvas {
  const cv = new Canvas();
  // page frame + corner ornaments
  cv.fillRect(0, 0, W, 4, NAVY);
  cv.fillRect(0, H - 4, W, 4, NAVY);
  cv.fillRect(0, 0, 4, H, NAVY);
  cv.fillRect(W - 4, 0, 4, H, NAVY);
  cv.fillRect(8, 8, W - 16, 1, CREAM_LINE);
  cv.fillRect(8, H - 9, W - 16, 1, CREAM_LINE);

  let y = drawMasthead(cv);
  y = drawStats(cv, y + 4);
  y = drawHeroes(cv, y + 5);
  y = drawTimeline(cv, y + 4);
  y = drawMediums(cv, y + 4);
  y = drawLiners(cv, y + 3);

  // bottom band: map + date check
  const bandY = y + 3;
  const bandH = 124;
  const mapW = Math.floor(CW * 0.58);
  drawMap(cv, MX, bandY, mapW, bandH);
  drawDateCheck(cv, MX + mapW + 10, bandY, CW - mapW - 10, bandH);

  // sources footer, one line — band lifted 10px (tighter section gaps above)
  // so the full line clears the cream rule at H-9 and the frame at H-4
  const fy = bandY + bandH;
  cv.fillRect(MX, fy, CW, 1, INK);
  drawText(
    cv,
    "Sources: AP · Reuters · AFP · Al Jazeera · NYT · WSJ · CNN · Kyiv Independent · Xinhua · NPR · Le Monde · UKMTO · USGS",
    MX,
    fy + 1,
    7.5,
    INK_SOFT,
    {},
  );

  // paper grain last, over everything, for density + print feel
  cv.grain(1.2, 4242);
  return cv;
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR;
  if (!outDir) throw new Error("MAKEFUN_OUTPUT_DIR is not set");
  fs.mkdirSync(outDir, { recursive: true });
  const cv = build();
  const png = encodePNG(W, H, cv.data);
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}

main();
