// Rakentaa www/index.html:n app/hakuviestit.html-fragmentista.
// Käyttö: node scripts/build-web.mjs [--src <polku>] [--out <kansio>]
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, cpSync } from 'node:fs';
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

const fragment = readFileSync(srcFile, 'utf8').replace(/^﻿/, '');

// Content-Security-Policy vain itsenäiseen PWA-versioon (claude.ai-artifaktiin sitä ei lisätä, koska ajoympäristö injektoi omia skriptejään). frame-ancestors ei toimi meta-elementissä.
const head = `<!doctype html>
<html lang="fi">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Hakuviestit">
<meta name="theme-color" content="#1D6B58">
<link rel="manifest" href="manifest.webmanifest">
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

// Versioi service workerin välimuisti sisällön mukaan, jotta päivitykset tulevat perille.
const swPath = join(outDir, 'sw.js');
if (existsSync(swPath)) {
  const buildId = createHash('sha256').update(html).digest('hex').slice(0, 10);
  const sw = readFileSync(swPath, 'utf8').replace(/__BUILD_ID__/g, buildId);
  writeFileSync(swPath, sw, 'utf8');
}

console.log(`Valmis: ${join(outDir, 'index.html')} (${html.length} merkkiä)`);
