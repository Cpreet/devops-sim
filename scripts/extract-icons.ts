/**
 * Extract Isoflow (isopacks) icons to public/icons for LB, API, DB, CACHE, QUEUE, WORKER.
 * Run with: bun run scripts/extract-icons.ts
 */
import iso from '@isoflow/isopacks/dist/isoflow.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'icons');

const KIND_TO_ISOPACK: Record<string, string> = {
  lb: 'loadbalancer',
  api: 'server',
  db: 'storage',
  cache: 'cache',
  queue: 'queue',
  worker: 'cronjob',
};

mkdirSync(OUT_DIR, { recursive: true });

for (const [ourName, isoName] of Object.entries(KIND_TO_ISOPACK)) {
  const icon = iso.icons.find((i: { name?: string; id?: string }) => (i.name || i.id) === isoName);
  if (!icon) {
    console.warn('Missing icon:', isoName);
    continue;
  }
  const url = icon.url as string;
  if (!url.startsWith('data:image/svg+xml;base64,')) {
    console.warn('Not base64 SVG:', isoName);
    continue;
  }
  const b64 = url.replace(/^data:image\/svg\+xml;base64,/, '');
  const svg = Buffer.from(b64, 'base64').toString('utf8');
  const outPath = join(OUT_DIR, `${ourName}.svg`);
  writeFileSync(outPath, svg, 'utf8');
  console.log('Wrote', outPath);
}

console.log('Done.');
