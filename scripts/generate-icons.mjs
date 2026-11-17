// Piirtää sovellusikonit (männynvihreä tausta, valkoinen puhekupla, kaksi viivaa ja nuoli).
// Ei riippuvuuksia: PNG kirjoitetaan käsin zlibillä. Käyttö: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GREEN = [0x1d, 0x6b, 0x58];
const WHITE = [255, 255, 255];

// --- Muodot 1024x1024-koordinaatistossa ---------------------------------

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function inTriangle(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function inCapsule(px, py, ax, ay, bx, by, r) {
  const vx = bx - ax, vy = by - ay;
  const len2 = vx * vx + vy * vy;
  let t = len2 === 0 ? 0 : ((px - ax) * vx + (py - ay) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (ax + t * vx), dy = py - (ay + t * vy);
  return dx * dx + dy * dy <= r * r;
}

// Palauttaa värin pisteessä (x, y) (1024-koordinaatit); s skaalaa kuvion keskeltä.
function shade(x, y, s) {
  // Käänteinen skaalaus keskipisteen (512, 512) ympäri.
  const u = 512 + (x - 512) / s;
  const v = 512 + (y - 512) / s;

  // Kuvion visuaalinen keskipiste siirretään hieman ylös, koska häntä painaa alas.
  const yy = v + 10;

  // Puhekupla: pyöristetty suorakulmio + häntä vasemmassa alakulmassa.
  const bubble =
    inRoundRect(u, yy, 212, 262, 812, 702, 120) ||
    inTriangle(u, yy, [300, 660], [300, 800], [450, 690]);
  if (!bubble) return GREEN;

  // Kaksi vaakaviivaa vasemmalla.
  if (inCapsule(u, yy, 300, 410, 540, 410, 28)) return GREEN;
  if (inCapsule(u, yy, 300, 530, 480, 530, 28)) return GREEN;

  // Nuoli ylös-oikealle (lähetetty): varsi + kärki.
  if (inCapsule(u, yy, 630, 540, 722, 448, 26)) return GREEN;
  if (inCapsule(u, yy, 654, 448, 722, 448, 26)) return GREEN;
  if (inCapsule(u, yy, 722, 448, 722, 516, 26)) return GREEN;

  return WHITE;
}

// --- Renderöinti ja PNG -------------------------------------------------

function render(size, scale) {
  const SS = size >= 512 ? 4 : 6; // alinäytteitys per akseli (antialiasointi)
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const k = 1024 / size;
  for (let py = 0; py < size; py++) {
    const rowStart = py * (size * 3 + 1);
    raw[rowStart] = 0; // suodin: none
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) * k;
          const y = (py + (sy + 0.5) / SS) * k;
          const c = shade(x, y, scale);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = SS * SS;
      const o = rowStart + 1 + px * 3;
      raw[o] = Math.round(r / n);
      raw[o + 1] = Math.round(g / n);
      raw[o + 2] = Math.round(b / n);
    }
  }
  return encodePng(size, size, raw);
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bittisyvyys
  ihdr[9] = 2; // RGB, ei alfakanavaa (iOS-ikonit eivät saa olla läpinäkyviä)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Tiedostot ----------------------------------------------------------

const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });
mkdirSync(join(root, 'assets'), { recursive: true });

const jobs = [
  ['icon-1024.png', 1024, 1.0],
  ['icon-512.png', 512, 1.0],
  ['icon-192.png', 192, 1.0],
  ['icon-180.png', 180, 1.0],
  // Maskable: kuvio pienemmäksi, jotta se pysyy turva-alueella (keskimmäiset 80 %).
  ['icon-512-maskable.png', 512, 0.82],
];
for (const [name, size, scale] of jobs) {
  writeFileSync(join(outDir, name), render(size, scale));
  console.log('Kirjoitettu', name, `${size}x${size}`);
}
copyFileSync(join(outDir, 'icon-1024.png'), join(root, 'assets', 'icon.png'));
console.log('Kopioitu assets/icon.png');
