// Rakentaa www/index.html:n app/hakuviestit.html-fragmentista.
// Käyttö: node scripts/build-web.mjs [--src <polku>] [--out <kansio>]
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const srcFile = resolve(arg('--src') ?? join(root, 'app', 'hakuviestit.html'));
const outDir = resolve(arg('--out') ?? join(root, 'www'));
const publicDir = join(root, 'public');

if (!existsSync(srcFile)) {
  console.error(`Virhe: lähdetiedostoa ei löydy: ${srcFile}`);
  console.error('Kopioi sovelluksen tiedosto hakuviestit.html kansioon "app" ja yritä uudelleen.');
  process.exit(1);
}

// Poistetaan Google Fonts -linkit: fontit tarjoillaan omalta palvelimelta (fonts/fonts.css).
const GOOGLE_RE = /fonts\.googleapis|fonts\.gstatic/;
const fragment = readFileSync(srcFile, 'utf8')
  .replace(/^﻿/, '')
  .replace(/[ \t]*<link\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>[ \t]*\r?\n?/gi, '');

// Content-Security-Policy vain itsenäiseen PWA-versioon (claude.ai-artifaktiin sitä ei lisätä, koska ajoympäristö injektoi omia skriptejään). frame-ancestors ei toimi meta-elementissä.
// Ainoa ulkoinen yhteys: gmail.googleapis.com (omistajan hyväksymä poikkeus; käyttäjän itse käynnistämä Gmail-haku, vain lukulupa).
const head = `<!doctype html>
<html lang="fi">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self' https://gmail.googleapis.com; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'self'; manifest-src 'self'">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Hakuviestit">
<meta name="theme-color" content="#1D6B58">
<link rel="stylesheet" href="fonts/fonts.css">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)} body{margin:0;font:14px system-ui,sans-serif} img{max-width:100%} [hidden]{display:none!important}</style>
<script>window.HAKUVIESTIT_STANDALONE=true</script>
<script>
// Service worker vain selaimessa (https tai localhost), ei Capacitor-kuoressa.
if ('serviceWorker' in navigator && !window.Capacitor &&
    (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
}
</script>
</head>
<body>
`;

const html = head + fragment + '\n</body>\n</html>\n';

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

if (existsSync(publicDir)) {
  cpSync(publicDir, outDir, { recursive: true });
}

writeFileSync(join(outDir, 'index.html'), html, 'utf8');

// Fonttitiedostojen lista service workerin esivälimuistiin.
const fontsDir = join(outDir, 'fonts');
const fontFiles = existsSync(fontsDir)
  ? readdirSync(fontsDir).filter((f) => f.endsWith('.css') || f.endsWith('.woff2')).sort().map((f) => './fonts/' + f)
  : [];

// Versioi service workerin välimuisti sisällön mukaan, jotta päivitykset tulevat perille.
const swPath = join(outDir, 'sw.js');
if (existsSync(swPath)) {
  const buildId = createHash('sha256').update(html).update(fontFiles.join('|')).digest('hex').slice(0, 10);
  const sw = readFileSync(swPath, 'utf8')
    .replace(/__BUILD_ID__/g, buildId)
    .replace(/\[\s*\/\*__FONT_FILES__\*\/\s*\]/,JSON.stringify(fontFiles));
  writeFileSync(swPath, sw, 'utf8');
}

// Varmistus: ei saa jäädä viittauksia kolmansien osapuolten fonttipalveluihin.
for (const [nimi, sisalto] of [['index.html', html], ['sw.js', existsSync(swPath) ? readFileSync(swPath, 'utf8') : '']]) {
  if (GOOGLE_RE.test(sisalto)) {
    console.error(`Virhe: ${nimi} sisältää yhä viittauksen Google Fontsiin.`);
    process.exit(1);
  }
}

console.log(`Valmis: ${join(outDir, 'index.html')} (${html.length} merkkiä)`);
