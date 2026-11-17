// Ensikäyttö puhtaalta pöydältä (headless Chrome, ei näkyviä ikkunoita). Käyttö: node e2e-flow.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const pw = require(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx', '9833c18b2d85bc59', 'node_modules', 'playwright-core'));
const HTML = path.resolve(__dirname, '..', 'hakuviestit.html');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const PW = 'Kx7#mQ2!vR9$tLw4';
const log = [];
const note = (k, v) => { log.push([k, v]); console.log(k, JSON.stringify(v)); };

const server = http.createServer((q, r) => {
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  r.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(HTML, 'utf8') + '</body></html>');
}).listen(0, '127.0.0.1');

(async () => {
  await new Promise(r => server.once('listening', r));
  const URL = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await pw.chromium.launch({ headless: true, channel: 'chrome' });
  const errs = [];
  const mk = async (opts) => {
    const ctx = await browser.newContext(opts); const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await p.goto(URL); return { ctx, p };
  };
  const ovf = async (p, label) => { const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); if (r.sw > r.cw) note('OVERFLOW ' + label, r); return r; };
  const shot = (p, n) => p.screenshot({ path: path.join(SHOTS, n + '.png') });

  // ============ MOBIILI 390x844, puhdas pöytä ============
  { const { ctx, p } = await mk({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await p.waitForSelector('#sec-setup-form');
    note('setup-title', await p.textContent('#lock h1'));
    await p.fill('#sec-pw1', 'Kx7#mQ2!vR9$tLw4'.slice(0, 6));
    await shot(p, 'setup-short');
    await p.fill('#sec-pw1', PW); await p.fill('#sec-pw2', PW);
    await shot(p, 'setup');
    await ovf(p, 'setup');
    const t0 = Date.now();
    await p.tap('#sec-go');
    await p.waitForSelector('#chat-list .row', { timeout: 30000 });
    note('setup->list ms', Date.now() - t0);
    await p.waitForTimeout(600);
    note('banner', await p.textContent('#banner'));
    await ovf(p, 'list');
    // Omat tilit: oma osoite
    await p.tap('#tab-accounts'); await p.waitForTimeout(300);
    await p.fill('#acc-value', 'oma.osoite@gmail.com'); await p.fill('#acc-label', 'Gmail');
    await p.tap('#acc-add'); await p.waitForTimeout(600);
    note('identities', await p.locator('.id-row').count());
    await shot(p, 'accounts');
    await ovf(p, 'accounts');
    // Lisää sähköpostilla: 3 osoitetta
    await p.tap('#tab-chats'); await p.waitForTimeout(300);
    await p.tap('#fab'); await p.waitForSelector('#tab-email'); await p.tap('#tab-email');
    await p.waitForSelector('#ae-text');
    await p.fill('#ae-text', 'Mikko Laine <mikko.laine@testiyritys.fi>, sari.virtanen@testiyritys.fi\nrekry@toinen.fi');
    await p.waitForTimeout(200);
    await shot(p, 'add-by-email');
    note('ae-go', await p.textContent('#ae-go'));
    await ovf(p, 'add-by-email');
    await p.tap('#ae-go'); await p.waitForTimeout(1200);
    note('toast', await p.textContent('#toasts'));
    note('chat rows', await p.locator('#chat-list .row').count());
    // avaa uusi tyhjä chat
    await p.fill('#q', 'Testiyritys'); await p.waitForTimeout(200);
    await p.tap('#chat-list .row >> nth=0'); await p.waitForSelector('#chat-empty'); await p.waitForTimeout(600);
    note('chat-empty', await p.textContent('#chat-empty'));
    await shot(p, 'chat-empty');
    await ovf(p, 'chat-empty');
    // kirjaa viesti
    await p.fill('#c-body', 'Soitin ja kerroin hakemuksestani.'); await p.tap('#c-send'); await p.waitForTimeout(900);
    const m = await p.evaluate(() => { const bb = document.querySelectorAll('.bubble'); const lb = bb[bb.length - 1].getBoundingClientRect(); const c = document.querySelector('.composer').getBoundingClientRect(); return { bubbles: bb.length, lastBottom: Math.round(lb.bottom), composerTop: Math.round(c.top), dist: Math.round(document.scrollingElement.scrollHeight - scrollY - innerHeight) }; });
    note('after send', m);
    await shot(p, 'chat-with-message');
    // lukitse
    await p.tap('#ch-back'); await p.waitForTimeout(200);
    await p.tap('#lockfab'); await p.waitForSelector('#lock-form'); await p.waitForTimeout(200);
    const lockText = await p.evaluate(() => document.body.innerText);
    note('lock innerText', lockText.replace(/\s+/g, ' ').slice(0, 200));
    note('lock leaks', ['Testiyritys', 'Mikko', 'Valio', 'Kesko', 'Fazer', 'gmail', 'Soitin'].filter(x => lockText.includes(x)));
    await shot(p, 'lock');
    await ovf(p, 'lock');
    // väärä salasana, sitten oikea
    await p.fill('#lock-pw', 'vaarasalasana'); await p.tap('#lock-go'); await p.waitForTimeout(800);
    note('wrong pw msg', await p.textContent('#lock-err'));
    await p.fill('#lock-pw', PW); await p.tap('#lock-go'); await p.waitForSelector('#chat-list .row', { timeout: 30000 }); await p.waitForTimeout(500);
    // Yhteenveto
    await p.tap('#tab-summary'); await p.waitForTimeout(900);
    note('summary stats', await p.evaluate(() => [...document.querySelectorAll('.stat b')].map(e => e.textContent)));
    await shot(p, 'summary');
    await ovf(p, 'summary');
    await p.tap('#tab-import'); await p.waitForTimeout(300); await ovf(p, 'import'); await shot(p, 'import');
    // asetukset
    await p.tap('#tab-accounts'); await p.waitForTimeout(300);
    await p.evaluate(() => document.getElementById('sec-privacy').scrollIntoView());
    await p.waitForTimeout(200); await shot(p, 'privacy');
    await ovf(p, 'accounts2');
    await ctx.close(); }

  // ============ DESKTOP 1440x900 ============
  { const { ctx, p } = await mk({ viewport: { width: 1440, height: 900 } });
    await p.waitForSelector('#sec-setup-form');
    await p.fill('#sec-pw1', PW); await p.fill('#sec-pw2', PW); await p.click('#sec-go');
    await p.waitForSelector('#chat-list .row', { timeout: 30000 }); await p.waitForTimeout(500);
    await p.click('#chat-ex-valio'); await p.waitForTimeout(900);
    await shot(p, 'desktop');
    await ovf(p, 'desktop');
    await p.keyboard.press('Control+l'); await p.waitForSelector('#lock-form');
    note('desktop ctrl+L locks', true);
    const t = await p.evaluate(() => document.body.innerText);
    note('desktop lock leaks', ['Valio', 'Mikko', 'Esimerkki'].filter(x => t.includes(x)));
    await shot(p, 'desktop-lock');
    await ctx.close(); }

  await browser.close(); server.close();
  note('console errors/warnings', errs);
  fs.writeFileSync(path.join(SHOTS, 'flow-log.json'), JSON.stringify(log, null, 1));
})().catch(e => { console.error('FLOW-VIRHE', e); try { server.close(); } catch (x) { /* ok */ } process.exit(1); });
