// Kokoaa hakuviestit.html ja seed.json lähteistä (scratchpad/src)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SP = __dirname;
const WORK = path.resolve(__dirname, '..');
const rd = f => fs.readFileSync(path.join(SP, 'src', f), 'utf8').replace(/\r\n/g, '\n');

const pure = rd('pure.js');
const js = [pure, rd('addr.js'), rd('gmail.js'), rd('crypto.js'), rd('app1.js'), rd('app2.js'), rd('app3.js'), rd('app5.js'), rd('app6.js'), rd('app7.js'), rd('app8.js'), rd('app4.js')].join('\n');
const css = rd('style.css') + rd('layout.css');
const body = `<div id="app">
<div id="banner" class="banner" role="status" hidden></div>
<main id="main"></main>
<div id="split" hidden>
<aside id="left" aria-label="Keskustelut ja valikko">
<div id="left-head"><div class="lh-row"><h1 class="brand">Hakuviestit</h1><button class="icon-btn" id="lock-left" type="button" aria-label="Lukitse (Ctrl+L)" title="Lukitse (Ctrl+L)"></button></div><div class="head-actions"><button class="btn primary" id="new-chat-btn" type="button"></button><button class="btn" id="email-chat-btn" type="button"></button></div></div>
<div id="left-nav"></div>
<div id="left-list"></div>
</aside>
<section id="right" aria-label="Sisältö">
<div class="right-empty" id="right-empty" hidden>
<h2>Valitse keskustelu vasemmalta</h2>
<p>Tai aloita uusi keskustelu painikkeella vasemmalla ylhäällä.</p>
<ul class="kbd-hints">
<li><kbd>Ctrl</kbd>+<kbd>K</kbd> haku</li>
<li><kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> edellinen / seuraava keskustelu</li>
<li><kbd>Enter</kbd> kirjaa viestin, <kbd>Shift</kbd>+<kbd>Enter</kbd> rivinvaihto</li>
<li><kbd>Esc</kbd> sulkee ikkunan tai tyhjentää valinnan</li>
</ul>
</div>
</section>
</div>
</div>
<div class="fabwrap" id="fabwrap" hidden><button class="fab" id="fab" type="button" aria-label="Uusi keskustelu"></button></div>
<nav id="tabbar" aria-label="Päävalikko" hidden></nav>
<div id="lock" hidden></div>
<button class="lockfab" id="lockfab" type="button" aria-label="Lukitse" title="Lukitse" hidden></button>
<div id="layers"></div>
<div id="toasts" role="status" aria-live="polite"></div>`;
const html = `<title>Hakuviestit</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@500;600;700&family=Figtree:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
${css}</style>
${body}
<script>
'use strict';
${js}
</script>
`;
fs.writeFileSync(path.join(WORK, 'hakuviestit.html'), html, 'utf8');
// Repossa: kopio myös app/-kansioon, josta PWA ja iOS-sovellus rakennetaan
if (fs.existsSync(path.join(WORK, 'app'))) fs.copyFileSync(path.join(WORK, 'hakuviestit.html'), path.join(WORK, 'app', 'hakuviestit.html'));
fs.writeFileSync(path.join(SP, 'script-extracted.js'), "'use strict';\n" + js, 'utf8');

// seed.json: ajetaan sama buildExampleDocs
const ex = pure.slice(pure.indexOf('//#PURE-START'), pure.indexOf('//#PURE-END')) + pure.slice(pure.indexOf('//#EXAMPLE-START'), pure.indexOf('//#EXAMPLE-END'));
const ctx = { TextDecoder, atob, btoa, console };
vm.createContext(ctx);
vm.runInContext(ex + '\nglobalThis.__docs = buildExampleDocs();', ctx);
fs.writeFileSync(path.join(WORK, 'seed.json'), JSON.stringify(ctx.__docs, null, 1), 'utf8');
console.log('html bytes', Buffer.byteLength(html), 'seed docs', ctx.__docs.length);
