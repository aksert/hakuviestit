const http = require('http'), fs = require('fs'), path = require('path');
const pw = require(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx', '9833c18b2d85bc59', 'node_modules', 'playwright-core'));
const HTML = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(path.resolve(__dirname, '..', 'hakuviestit.html'), 'utf8') + '</body></html>';
const SH = path.join(__dirname, 'shots'); fs.mkdirSync(SH, { recursive: true });
const PW = 'Kx7#mQ2!vR9$tLw4';
const server = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(HTML); }).listen(0, '127.0.0.1');
const MOCK = () => { const mcp = { callTool: async () => ({ payload: {} }) }; window.claude = { use: async n => (n === 'mcp' ? mcp : n === 'permissions' ? { state: async () => 'granted', manage: async () => { } } : null) }; };
(async () => {
  await new Promise(r => server.once('listening', r));
  const URL = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await pw.chromium.launch({ headless: true, channel: 'chrome' });
  for (const [name, opts, file] of [['mobile', { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, colorScheme: 'light' }, 'import-mail.png'], ['desktop', { viewport: { width: 1280, height: 800 }, colorScheme: 'light' }, 'import-mail-desktop.png']]) {
    const ctx = await browser.newContext(opts); const p = await ctx.newPage();
    await p.addInitScript(MOCK); await p.goto(URL);
    await p.waitForSelector('#sec-setup-form'); await p.fill('#sec-pw1', PW); await p.fill('#sec-pw2', PW); await p.click('#sec-go');
    await p.waitForSelector('#chat-ex-valio', { timeout: 30000 }); await p.waitForTimeout(800);
    await p.evaluate(() => showView('import')); await p.waitForTimeout(500);
    console.log(name, 'overflow', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'go visible', await p.isVisible('#imp-mail-go'));
    await p.screenshot({ path: path.join(SH, file) });
    await ctx.close();
  }
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
