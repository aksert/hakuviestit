// Kuvakaappaukset (headless): lukitusnäkymä Face ID:llä, Tietosuoja-osio, jarrutettu avaus, Android-näkymä
const http = require('http'), fs = require('fs'), path = require('path');
const pw = require(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx', '9833c18b2d85bc59', 'node_modules', 'playwright-core'));
const HTML = path.resolve(__dirname, '..', 'hakuviestit.html');
const SH = path.join(__dirname, 'shots');
fs.mkdirSync(SH, { recursive: true });
const PW = 'Kx7#mQ2!vR9$tLw4';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const server = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(HTML, 'utf8') + '</body></html>'); }).listen(0, '127.0.0.1');
(async () => {
  await new Promise(r => server.once('listening', r));
  const URL = 'http://localhost:' + server.address().port + '/';
  const browser = await pw.chromium.launch({ headless: true, channel: 'chrome' });
  const mk = async (o, prf) => {
    const ctx = await browser.newContext(Object.assign({ deviceScaleFactor: 2, hasTouch: true, isMobile: true }, o)); const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p); await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: prf !== false, automaticPresenceSimulation: true } });
    await p.goto(URL); await p.waitForSelector('#sec-setup-form'); await p.fill('#sec-pw1', PW); await p.fill('#sec-pw2', PW); await p.click('#sec-go');
    await p.waitForSelector('#chat-ex-valio', { timeout: 30000 }); await p.waitForTimeout(600);
    return { ctx, p };
  };
  const enableBio = async p => {
    await p.evaluate(() => document.getElementById('tab-accounts').click()); await p.waitForSelector('#sec-bio-on'); await p.click('#sec-bio-on');
    await p.fill('#bio-pw', PW); await p.click('#bio-check'); await p.waitForSelector('#bio-go:not([hidden])', { timeout: 15000 }); await p.click('#bio-go');
    await p.waitForSelector('#sec-bio-off:not([hidden])', { timeout: 20000 }); await p.waitForTimeout(900);
  };
  // 1. lukitusnäkymä, tumma, 375x812
  { const { ctx, p } = await mk({ viewport: { width: 375, height: 812 }, userAgent: IPHONE_UA, colorScheme: 'dark' });
    await enableBio(p); await p.reload(); await p.waitForSelector('#unlock-bio'); await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(SH, 'unlock-bio-dark.png') });
    // 3. jarrutettu avaus (5 virhettä), vaalea
    await p.emulateMedia({ colorScheme: 'light' });
    for (let i = 0; i < 5; i++) { await p.fill('#lock-pw', 'vaara-salasana-' + i); await p.click('#lock-go'); await p.waitForTimeout(900); }
    await p.waitForSelector('#unlock-wait:not([hidden])'); await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(SH, 'unlock-wait.png') });
    await ctx.close(); }
  // 2. Tietosuoja-osio, vaalea, iPhone
  { const { ctx, p } = await mk({ viewport: { width: 375, height: 812 }, userAgent: IPHONE_UA, colorScheme: 'light' });
    await p.click('#tab-accounts'); await p.waitForSelector('#sec-bio-on'); await p.waitForTimeout(300);
    await p.addStyleTag({ content: '#tabbar{display:none!important}' }); await p.locator('#sec-privacy').scrollIntoViewIfNeeded();
    await p.locator('#sec-privacy').screenshot({ path: path.join(SH, 'security-light.png') });
    await enableBio(p);
    await p.locator('#sec-privacy').screenshot({ path: path.join(SH, 'security-light-enabled.png') });
    await ctx.close(); }
  // 4. Tietosuoja-osio, Android-UA, 412x915
  { const { ctx, p } = await mk({ viewport: { width: 412, height: 915 }, userAgent: ANDROID_UA, colorScheme: 'light' });
    await p.click('#tab-accounts'); await p.waitForSelector('#sec-bio-on'); await p.waitForTimeout(300);
    await p.addStyleTag({ content: '#tabbar{display:none!important}' }); await p.locator('#sec-privacy').scrollIntoViewIfNeeded();
    await p.locator('#sec-privacy').screenshot({ path: path.join(SH, 'security-android.png') });
    await ctx.close(); }
  await browser.close(); server.close();
  console.log('shots ok');
})().catch(e => { console.error('SHOT-VIRHE', e); try { server.close(); } catch (x) { /* ok */ } process.exit(2); });
