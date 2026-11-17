// Headless-E2E asettelut (Chrome headless, ei näkyviä ikkunoita). Käyttö: node e2e.js
const http = require('http'), fs = require('fs'), path = require('path');
const pw = require(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx', '9833c18b2d85bc59', 'node_modules', 'playwright-core'));
const SH = path.join(__dirname, 'shots') + path.sep;
fs.mkdirSync(SH, { recursive: true });
const PW = 'Kx7#mQ2!vR9$tLw4';
const HTML = path.resolve(__dirname, '..', 'hakuviestit.html');
const server = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(HTML, 'utf8') + '</body></html>'); }).listen(0, '127.0.0.1');
(async () => {
  await new Promise(r => server.once('listening', r));
  const URL = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await pw.chromium.launch({ headless: true, channel: 'chrome' });
  const out = { headless: true }; const errs = [];
  async function mk(opts) { const ctx = await browser.newContext(opts); const p = await ctx.newPage(); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message)); await p.goto(URL); await p.waitForSelector('#sec-setup-form'); await p.fill('#sec-pw1', PW); await p.fill('#sec-pw2', PW); await p.click('#sec-go'); await p.waitForSelector('#chat-ex-valio', { timeout: 30000 }); await p.waitForTimeout(500); return { ctx, p }; }
  const info = p => p.evaluate(() => ({ device: document.documentElement.dataset.device, input: document.documentElement.dataset.input, layout: document.documentElement.dataset.layout, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, iw: innerWidth }));
  const chatM = p => p.evaluate(() => { const split = document.documentElement.dataset.layout === 'split'; const bb = document.querySelectorAll('.bubble'); const lb = bb[bb.length - 1].getBoundingClientRect(); const c = document.querySelector('.composer').getBoundingClientRect(); let dist, hs = false; if (split) { const m = document.getElementById('msgs-scroll'); dist = Math.round(m.scrollHeight - m.scrollTop - m.clientHeight); hs = m.scrollWidth > m.clientWidth; } else dist = Math.round(document.scrollingElement.scrollHeight - scrollY - innerHeight); return { dist, lastBottom: Math.round(lb.bottom), composerTop: Math.round(c.top), msgsHScroll: hs }; });
  for (const scheme of ['light', 'dark']) {
    const { ctx, p } = await mk({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
    const r = { info: await info(p) };
    await p.click('#chat-ex-valio'); await p.waitForTimeout(900); r.chat = await chatM(p);
    await p.screenshot({ path: SH + 'desktop-' + scheme + '.png' });
    await p.keyboard.type('Enterilla'); await p.keyboard.press('Enter'); await p.waitForTimeout(600); r.afterEnter = await chatM(p);
    await p.keyboard.press('Control+k'); r.ctrlK = await p.evaluate(() => document.activeElement.id);
    await p.keyboard.press('Escape');
    const before = await p.evaluate(() => document.getElementById('ch-name').textContent);
    await p.keyboard.press('Alt+ArrowDown'); await p.waitForTimeout(400);
    r.altDown = [before, await p.evaluate(() => document.getElementById('ch-name').textContent)];
    await p.click('#ch-who'); await p.waitForTimeout(500);
    r.sidePanel = await p.evaluate(() => { const s = document.querySelector('.layer.side .sheet'); const b = s && s.getBoundingClientRect(); return b ? { w: Math.round(b.width), right: Math.round(b.right) } : null; });
    await p.screenshot({ path: SH + 'desktop-' + scheme + '-info.png' });
    await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    r.escDeselect = await p.evaluate(() => !document.getElementById('right-empty').hidden);
    for (const v of ['summary', 'import', 'accounts']) { await p.click('#tab-' + v); await p.waitForTimeout(500); r[v] = (await info(p)).sw; if (v === 'summary') await p.screenshot({ path: SH + 'desktop-' + scheme + '-summary.png' }); }
    out['desktop-' + scheme] = r; await ctx.close();
  }
  { const { ctx, p } = await mk({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });
    out.tablet = await info(p); out.tabletRuns = [];
    for (let i = 0; i < 3; i++) { await p.tap('#chat-ex-valio'); await p.waitForTimeout(1200); out.tabletRuns.push(await chatM(p)); if (i === 0) await p.screenshot({ path: SH + 'tablet.png' }); await p.tap('#tab-chats'); await p.waitForTimeout(300); }
    await ctx.close(); }
  { const { ctx, p } = await mk({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    out.mobile = await info(p); out.mobileRuns = [];
    for (let i = 0; i < 3; i++) { await p.tap('#chat-ex-valio'); await p.waitForTimeout(1500); out.mobileRuns.push(await chatM(p)); if (i === 0) await p.screenshot({ path: SH + 'mobile.png' }); await p.tap('#ch-back'); await p.waitForTimeout(300); }
    for (const v of ['summary', 'import', 'accounts']) { await p.tap('#tab-' + v); await p.waitForTimeout(400); out['mobile-' + v] = (await info(p)).sw; }
    await ctx.close(); }
  { const { ctx, p } = await mk({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });
    out.w320 = (await info(p)).sw; await p.tap('#chat-ex-valio'); await p.waitForTimeout(1200); out.w320chat = (await info(p)).sw; await ctx.close(); }
  { const { ctx, p } = await mk({ viewport: { width: 1440, height: 900 } });
    await p.click('#chat-ex-valio'); await p.waitForTimeout(800);
    out.resize = [await chatM(p)];
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(800); out.resize.push(Object.assign(await chatM(p), await info(p)));
    await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(800); out.resize.push(Object.assign(await chatM(p), await info(p), { open: await p.evaluate(() => document.getElementById('ch-name').textContent) }));
    await ctx.close(); }
  await browser.close(); server.close();
  out.errs = errs;
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error('E2E-VIRHE', e); process.exit(1); });
