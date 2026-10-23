// Genereert de PWA-iconen uit public/icon.svg (eigen ontwerp, geen merkmateriaal van derden).
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/icon.svg');
// Maskable: extra marge (safe zone 80%) op de achtergrondkleur.
const maskable = Buffer.from(
  readFileSync('public/icon.svg', 'utf8')
    .replace('<g id="art">', '<g id="art" transform="translate(51.2 51.2) scale(0.8)">')
    .replace(/rx="\d+"/, 'rx="0"'),
);

const out = [
  ['public/pwa-192.png', svg, 192],
  ['public/pwa-512.png', svg, 512],
  ['public/apple-touch-icon.png', svg, 180],
  ['public/maskable-512.png', maskable, 512],
];
for (const [file, src, size] of out) {
  await sharp(src, { density: 384 }).resize(size, size).flatten({ background: '#0a0d0c' }).png().toFile(file);
  console.log('✓', file);
}
writeFileSync('public/favicon.svg', svg);
