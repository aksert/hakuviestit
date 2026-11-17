// Asettaa iOS-projektin App-ikonin: kirjoittaa kuvan jokaiseen Contents.json:ssa mainittuun tiedostonimeen.
// Käyttö: node scripts/set-ios-icon.mjs <icon.png> <AppIcon.appiconset-kansio>
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [iconArg, setArg] = process.argv.slice(2);
if (!iconArg || !setArg) {
  console.error('Käyttö: node scripts/set-ios-icon.mjs <icon.png> <AppIcon.appiconset>');
  process.exit(1);
}
const icon = resolve(iconArg);
const setDir = resolve(setArg);
const contentsPath = join(setDir, 'Contents.json');

if (!existsSync(icon)) {
  console.error(`Ikonia ei löydy: ${icon}`);
  process.exit(1);
}
if (!existsSync(contentsPath)) {
  console.error(`Contents.json puuttuu: ${contentsPath}`);
  process.exit(1);
}

const contents = JSON.parse(readFileSync(contentsPath, 'utf8'));
const images = Array.isArray(contents.images) ? contents.images : [];

// Jos jokin kuvakohta ei mainitse tiedostoa (uusi yhden koon muoto), anna sille nimi.
for (const img of images) {
  if (!img.filename && (img.size === '1024x1024' || images.length === 1)) {
    img.filename = 'AppIcon-512@2x.png';
  }
}
const names = [...new Set(images.map((i) => i.filename).filter(Boolean))];
if (names.length === 0) {
  console.error('Contents.json:ssa ei ole yhtään kuvakohtaa, johon ikoni voitaisiin kirjoittaa.');
  process.exit(1);
}

for (const name of names) {
  copyFileSync(icon, join(setDir, name));
  console.log('Ikoni kirjoitettu:', name);
}
writeFileSync(contentsPath, JSON.stringify(contents, null, 2) + '\n', 'utf8');
