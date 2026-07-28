import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '..', 'frontend', 'public', 'assets', 'badge');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.png'));

for (const file of files) {
  const src = path.join(srcDir, file);
  const meta = await sharp(src).metadata();
  if (meta.channels === 4 && !meta.isIndexed) {
    console.log(`✓ ${file} — already RGBA`);
    continue;
  }
  const tmp = src + '.tmp.png';
  await sharp(src)
    .ensureAlpha()
    .toColourspace('srgb')
    .png()
    .toFile(tmp);
  fs.unlinkSync(src);
  fs.renameSync(tmp, src);
  console.log(`✔ ${file} — converted (was ${meta.channels}ch${meta.isIndexed ? ', indexed' : ''})`);
}
console.log('Done');
