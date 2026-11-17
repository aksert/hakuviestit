// Tietosuoja-E2E headless Chromella (standalone-tila, IndexedDB): salaus, lukitus, automaattinen lukitus, salattu varmuuskopio
const http = require('http'), fs = require('fs'), path = require('path');
const pw = require(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx', '9833c18b2d85bc59', 'node_modules', 'playwright-core'));
const HTML = path.resolve(__dirname, '..', 'hakuviestit.html');
const PW = 'Kx7#mQ2!vR9$tLw4';
const NAMES = ['Valio', 'Kesko', 'Fazer', 'Posti', 'Mäkinen', 'Heli', 'Mikko', 'Sari', 'Pekka', 'example.fi', 'oma.esimerkki', 'Hakemus', 'Esimerkki', 'Rekrytoija'];
let pass = 0, fail = 0; const errs = [];
const ok = (n, c, i) => { if (c) pass++; else { fail++; console.log('FAIL', n, i === undefined ? '' : JSON.stringify(i)); } };
const server = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(HTML, 'utf8') + '</body></html>'); }).listen(0, '127.0.0.1');
(async () => {
  await new Promise(r => server.once('listening', r));
  const URL = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await pw.chromium.launch({ headless: true, channel: 'chrome' });
  for (const standalone of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('hv-bio-offer', 'no'); } catch (e) { /* ok */ } });   // ei biometriatarjousta muiden testien tielle

    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
    if (standalone) await p.addInitScript(() => { window.HAKUVIESTIT_STANDALONE = true; });
    await p.clock.install();
    await p.goto(URL);
    const tag = standalone ? '[standalone] ' : '[preview] ';
    await p.waitForSelector('#sec-setup-form');
    ok(tag + 'first start shows setup, no data', /Suojaa tietosi/.test(await p.innerText('#lock')) && !(await p.innerText('body')).includes('Valio'));
    await p.fill('#sec-pw1', 'lyhyt'); await p.fill('#sec-pw2', 'lyhyt'); await p.click('#sec-go');
    ok(tag + 'short password rejected', /vähintään 10/.test(await p.textContent('#sec-err')));
    await p.fill('#sec-pw1', PW); await p.fill('#sec-pw2', PW + 'x'); await p.click('#sec-go');
    ok(tag + 'mismatch rejected', /täsmää/.test(await p.textContent('#sec-err')));
    await p.fill('#sec-pw2', PW); await p.click('#sec-go');
    await p.waitForSelector('#chat-ex-valio', { timeout: 30000 }); await p.waitForTimeout(800);
    ok(tag + 'examples visible after password', await p.locator('#chat-list .row').count() === 5);
    // tallennus: ei selväkieltä
    const stored = await p.evaluate(async (std) => {
      if (std) {
        const db = await new Promise((res, rej) => { const r = indexedDB.open('hakuviestit', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
        const tx = db.transaction('docs'); const ds = tx.objectStore('docs');
        const keys = await new Promise(r => { const q = ds.getAllKeys(); q.onsuccess = () => r(q.result); });
        const vals = await new Promise(r => { const q = ds.getAll(); q.onsuccess = () => r(q.result); });
        return JSON.stringify(keys.map((k, i) => [k, vals[i]]));
      }
      return localStorage.getItem('hakuviestit.v1');
    }, standalone);
    ok(tag + 'raw storage has no plaintext names', !NAMES.some(n => stored.includes(n)), NAMES.filter(n => stored.includes(n)));
    ok(tag + 'raw storage is encrypted docs + meta/crypto', /"kdf":"PBKDF2-SHA256"/.test(stored) && /"enc":\{"iv":"/.test(stored) && /"iter":600000/.test(stored));
    ok(tag + 'password not in storage', !stored.includes(PW));
    // Ctrl+L
    await p.click('#chat-ex-valio'); await p.waitForTimeout(400);
    await p.keyboard.press('Control+l'); await p.waitForSelector('#lock-form');
    const txt = await p.evaluate(() => document.body.innerText);
    ok(tag + 'Ctrl+L: no names/counts in DOM text', !NAMES.some(n => txt.includes(n)) && !/\d+ viestiä|\d+ henkilöä/.test(txt), txt.replace(/\s+/g, ' ').slice(0, 160));
    ok(tag + 'Ctrl+L: DOM has no chat elements', await p.evaluate(() => document.querySelectorAll('.row,.bubble,.avatar,.pill').length === 0));
    // väärä ja oikea salasana
    await p.fill('#lock-pw', 'vaarasalasana'); await p.click('#lock-go'); await p.waitForTimeout(700);
    ok(tag + 'wrong password: generic error', /Salasana ei kelpaa/.test(await p.textContent('#lock-err')));
    await p.fill('#lock-pw', PW); await p.click('#lock-go'); await p.waitForSelector('#chat-ex-valio', { timeout: 30000 }); await p.waitForTimeout(500);
    ok(tag + 'unlock restores data', await p.locator('#chat-list .row').count() === 5);
    // salattu varmuuskopio (standalone: <a download>)
    if (standalone) {
      await p.click('#tab-accounts'); await p.waitForTimeout(300);
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.click('#acc-download')]);
      const fp = path.join(__dirname, 'shots', 'backup-test.json'); await dl.saveAs(fp);
      const bk = fs.readFileSync(fp, 'utf8');
      ok(tag + 'backup is encrypted, no plaintext names', /"encrypted":true/.test(bk) && !NAMES.some(n => bk.includes(n)) && bk.includes('PBKDF2-SHA256'), NAMES.filter(n => bk.includes(n)));
      // palautus: väärä salasana hylätään, oikea hyväksytään
      await p.setInputFiles('#acc-restore', fp); await p.waitForSelector('#ask-form');
      await p.fill('#ask-pw', 'vaara-salasana-1'); await p.click('#ask-go'); await p.waitForTimeout(1500);
      ok(tag + 'restore wrong password rejected', /Salasana ei kelpaa/.test(await p.textContent('#toasts')));
      await p.setInputFiles('#acc-restore', fp); await p.waitForSelector('#ask-form');
      await p.fill('#ask-pw', PW); await p.click('#ask-go'); await p.waitForSelector('#cf-ok', { timeout: 20000 });
      await p.click('#cf-ok');
      const restored = await p.waitForFunction(() => /Palautettu: \d+ keskustelua/.test(document.getElementById('toasts').textContent), null, { timeout: 20000 }).then(() => true, () => false);
      ok(tag + 'restore with password succeeds', restored);
      fs.unlinkSync(fp);
    }
    // arkaluonteinen keskustelu: merkintä ja nimet tallentuvat vain salattuina, merkintä säilyy lukituksen yli
    {
      await p.evaluate(async () => {
        const md = toMsgDoc({ at: nowIso(), dir: 'in', channel: 'email', from: 'tiina@paivakoti.example.fi', fromName: 'Tiina Korhonen', to: ['oma@example.fi'], subject: 'Päiväkodin ilmoitus', body: 'Aino oli kipeänä tänään.' });
        await doWrites([{ t: 'set', path: 'chats/sens-e2e', data: { name: 'Aino Virtanen', company: '', status: 'haettu', notes: '', color: 'av2', members: [{ id: 'sm1', name: 'Tiina Korhonen', role: 'Opettaja', emails: ['tiina@paivakoti.example.fi'], phones: [] }], createdAt: nowIso(), updatedAt: nowIso(), stats: computeStats([]) } }, { t: 'set', path: 'chats/sens-e2e/messages/mS1', data: md }]);
      });
      await p.waitForSelector('#chat-sens-e2e'); await p.click('#chat-sens-e2e'); await p.click('#ch-who'); await p.waitForSelector('#chat-sensitive');
      await p.click('#chat-sensitive');
      await p.waitForFunction(() => S.chats['sens-e2e'] && S.chats['sens-e2e'].sensitive === true, null, { timeout: 10000 });
      await p.waitForTimeout(900);
      const rawS = await p.evaluate(async (std) => {
        if (std) {
          const db = await new Promise((res, rej) => { const r = indexedDB.open('hakuviestit', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
          const ds = db.transaction('docs').objectStore('docs');
          const keys = await new Promise(r => { const q = ds.getAllKeys(); q.onsuccess = () => r(q.result); });
          const vals = await new Promise(r => { const q = ds.getAll(); q.onsuccess = () => r(q.result); });
          return JSON.stringify(keys.map((k, i) => [k, vals[i]]));
        }
        return localStorage.getItem('hakuviestit.v1');
      }, standalone);
      ok(tag + 'sensitive chat: flag + names/messages stored only inside encrypted docs (no plaintext "sensitive", names, address, text)', !['sensitive', 'Aino Virtanen', 'Virtanen', 'Korhonen', 'paivakoti', 'kipeänä', 'Päiväkodin'].some(x => rawS.includes(x)), ['sensitive', 'Aino Virtanen', 'Korhonen', 'paivakoti', 'kipeänä'].filter(x => rawS.includes(x)));
      ok(tag + 'sensitive chat doc is stored as an encrypted doc (enc.iv/ct)', await p.evaluate(async (std) => { const raw = await SEC.inner.getDoc('chats/sens-e2e'); return !!(raw && raw.enc && raw.enc.iv && raw.enc.ct && !('sensitive' in raw) && !('name' in raw)); }, standalone));
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      await p.keyboard.press('Control+l'); await p.waitForSelector('#lock-form');
      ok(tag + 'locked: no sensitive chat name in DOM', !(await p.evaluate(() => document.body.innerText)).includes('Virtanen'));
      await p.fill('#lock-pw', PW); await p.click('#lock-go'); await p.waitForSelector('#chat-sens-e2e', { timeout: 30000 }); await p.waitForTimeout(400);
      ok(tag + 'after unlock the flag is restored from the encrypted doc; list row shows initials, no preview, shield', await p.evaluate(() => { const r = document.getElementById('chat-sens-e2e'); return S.chats['sens-e2e'].sensitive === true && /A\. V\./.test(r.innerText) && !/Aino|Virtanen|kipeänä|Päiväkodin/.test(r.innerText) && !r.querySelector('.row-prev') && !!r.querySelector('[aria-label="Arkaluonteinen"]'); }));
      await p.evaluate(async () => { await deleteChats(['sens-e2e']); }); await p.waitForTimeout(500);
      ok(tag + 'sensitive test chat removed', await p.locator('#chat-list .row').count() === 5);
    }
    // automaattinen lukitus: uuden asennuksen oletus 2 min
    await p.click('#tab-chats'); await p.waitForTimeout(200);
    await p.clock.fastForward('01:30'); await p.waitForTimeout(300);
    ok(tag + 'no auto-lock at 1.5 min (default 2 min)', await p.locator('#lock-form').count() === 0);
    await p.clock.fastForward('01:00'); await p.waitForTimeout(500);
    ok(tag + 'auto-lock after 2 min inactivity (new-setup default)', await p.locator('#lock-form').count() === 1 && !(await p.evaluate(() => document.body.innerText)).includes('Valio'));
    await p.fill('#lock-pw', PW); await p.click('#lock-go'); await p.waitForSelector('#chat-ex-valio', { timeout: 30000 }); await p.waitForTimeout(400);
    // lyhennetty aika 1 min
    await p.click('#tab-accounts'); await p.waitForTimeout(200);
    await p.selectOption('#sec-lockmin', '1'); await p.waitForTimeout(500);
    await p.clock.fastForward('00:50'); await p.waitForTimeout(200);
    ok(tag + 'no lock at 50 s (1 min setting)', await p.locator('#lock-form').count() === 0);
    await p.clock.fastForward('00:30'); await p.waitForTimeout(400);
    ok(tag + 'auto-lock after 1 min (setting)', await p.locator('#lock-form').count() === 1);
    await p.fill('#lock-pw', PW); await p.click('#lock-go'); await p.waitForSelector('#chat-ex-valio', { timeout: 30000 }); await p.waitForTimeout(400);
    ok(tag + 'setting persisted (encrypted profile)', await p.inputValue('#sec-lockmin') === '1');
    // 5 virheellistä -> odotus
    await p.keyboard.press('Control+l'); await p.waitForSelector('#lock-form');
    for (let i = 0; i < 5; i++) { await p.fill('#lock-pw', 'vaara' + i); await p.click('#lock-go'); await p.waitForTimeout(700); }
    ok(tag + '5 failures -> wait message (mm:ss, #unlock-wait) and disabled button', /^Liian monta yritystä\. Yritä uudelleen 00:\d\d kuluttua\.$/.test(await p.textContent('#unlock-wait')) && await p.isDisabled('#lock-go'));
    ok(tag + 'failure counter persisted in localStorage (survives reload), not in sessionStorage', await p.evaluate(() => localStorage.getItem('hv-fails') === '5' && sessionStorage.getItem('hv-fails') === null));
    await p.clock.fastForward('00:35'); await p.waitForTimeout(1500);
    ok(tag + 'wait expires after 30 s', !(await p.isDisabled('#lock-go')));
    // diag/send: selväkielinen, ei @-merkkiä eikä viestin sisältöä; kaikki muu salattua (vain diag/-etuliite sallittu selväkielisenä)
    await p.fill('#lock-pw', PW); await p.click('#lock-go'); await p.waitForSelector('#chat-ex-valio', { timeout: 30000 }); await p.waitForTimeout(500);
    await p.evaluate(() => writeSendDiag('reply', 'reply', { code: 'tool_error', message: 'Bad recipient eero.testi@example.fi: Salainen-viesti-123', retryable: false, result: { content: [{ type: 'text', text: 'to eero.testi@example.fi' }], structuredContent: { body: 'Salainen-viesti-123' } } }, ['Salainen-viesti-123', 'Aihe-salainen']));
    await p.waitForTimeout(1200);
    const dump = await p.evaluate(async (std) => {
      if (std) {
        const db = await new Promise((res, rej) => { const r = indexedDB.open('hakuviestit', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
        const ds = db.transaction('docs').objectStore('docs');
        const keys = await new Promise(r => { const q = ds.getAllKeys(); q.onsuccess = () => r(q.result); });
        const vals = await new Promise(r => { const q = ds.getAll(); q.onsuccess = () => r(q.result); });
        return keys.map((k, i) => [k, vals[i]]);
      }
      const M = JSON.parse(localStorage.getItem('hakuviestit.v1')).M;
      const out = [['meta/crypto', M.crypto], ['meta/profile', M.profile]];
      Object.keys(M.chats).forEach(k => out.push(['chats/' + k, M.chats[k]]));
      Object.keys(M.msgs).forEach(c => Object.keys(M.msgs[c]).forEach(m => out.push(['chats/' + c + '/messages/' + m, M.msgs[c][m]])));
      Object.keys(M.diag || {}).forEach(k => out.push(['diag/' + k, M.diag[k]]));
      return out;
    }, standalone);
    const diag = dump.find(([k]) => k === 'diag/send');
    ok(tag + 'diag/send stored, plaintext, no @, no secret message/subject', !!diag && !diag[1].enc && diag[1].attempt === 'reply' && diag[1].code === 'tool_error' && !JSON.stringify(diag[1]).includes('@') && !JSON.stringify(diag[1]).includes('Salainen') && JSON.stringify(diag[1]).includes('<email>'), diag);
    ok(tag + 'every stored doc except meta/crypto and diag/* is encrypted (exactly the diag/ prefix is allowed plain)', dump.filter(([k]) => k !== 'meta/crypto' && !k.startsWith('diag/')).every(([, v]) => v && v.enc && v.enc.iv && v.enc.ct) && dump.filter(([k]) => k.startsWith('diag/')).every(([k]) => /^diag\/[A-Za-z0-9_-]+$/.test(k)), dump.filter(([k, v]) => k !== 'meta/crypto' && !k.startsWith('diag/') && !(v && v.enc)).map(x => x[0]));
    // yksityisyysnäkymä (vaalea + tumma): sivun piilotus peittää sisällön
    for (const scheme of ['light', 'dark']) {
      await p.emulateMedia({ colorScheme: scheme });
      await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      const pb = await p.evaluate(() => { const cs = getComputedStyle(document.body, '::after'); const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(); return { cls: document.documentElement.classList.contains('privacy-blur'), pos: cs.position, z: cs.zIndex, bg: cs.backgroundColor, blur: getComputedStyle(document.getElementById('app')).filter }; });
      ok(tag + 'privacy-blur (' + scheme + '): html class + opaque full-screen cover + blurred app', pb.cls && pb.pos === 'fixed' && /blur/.test(pb.blur) && pb.bg !== 'rgba(0, 0, 0, 0)', pb);
      await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
      ok(tag + 'privacy-blur (' + scheme + '): removed when visible', await p.evaluate(() => !document.documentElement.classList.contains('privacy-blur') && getComputedStyle(document.body, '::after').content === 'none'));
    }
    await ctx.close();
  }
  // WebAuthn PRF oikeaa selaimen API:a vasten (Chrome virtual authenticator, localhost = kelvollinen rpId)
  const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
  for (const [name, ua, prf] of [['iPhone UA + PRF authenticator', IPHONE_UA, true], ['Android UA + PRF authenticator', ANDROID_UA, true], ['iPhone UA, authenticator without PRF', IPHONE_UA, false]]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: ua }); const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: prf, automaticPresenceSimulation: true } });
    const LURL = 'http://localhost:' + server.address().port + '/';
    const tag = '[bio: ' + name + '] ';
    await p.goto(LURL);
    await p.waitForSelector('#sec-setup-form'); await p.fill('#sec-pw1', PW); await p.fill('#sec-pw2', PW); await p.click('#sec-go');
    await p.waitForSelector('#chat-ex-valio', { timeout: 30000 }); await p.waitForTimeout(500);
    await p.waitForSelector('#bio-offer-go', { timeout: 5000 });
    ok(tag + 'offer sheet shown after first-time password setup (go + not now)', await p.isVisible('#bio-offer-no') && /käyttöön\?/.test(await p.textContent('.sheet-t')));
    await p.click('#bio-offer-no'); await p.waitForSelector('#bio-offer-go', { state: 'detached' });
    ok(tag + 'offer "Ei nyt" stores hv-bio-offer=no', await p.evaluate(() => localStorage.getItem('hv-bio-offer')) === 'no');
    await p.click('#tab-accounts'); await p.waitForSelector('#sec-bio-on');
    const wantLabel = ua === IPHONE_UA ? 'Ota Face ID käyttöön' : 'Ota sormenjälki tai kasvojentunnistus käyttöön';
    ok(tag + 'enable button shows platform label', (await p.textContent('#sec-bio-on')) === wantLabel, await p.textContent('#sec-bio-on'));
    await p.click('#sec-bio-on'); await p.fill('#bio-pw', 'vaara-salasana-1'); await p.click('#bio-check');
    await p.waitForFunction(() => /Salasana ei kelpaa/.test(document.getElementById('bio-err').textContent), null, { timeout: 15000 });
    ok(tag + 'wrong password rejected before any WebAuthn', true);
    await p.fill('#bio-pw', PW); await p.click('#bio-check'); await p.waitForSelector('#bio-go:not([hidden])', { timeout: 15000 });
    await p.click('#bio-go');
    if (prf) {
      await p.waitForSelector('#sec-bio-off:not([hidden])', { timeout: 20000 });
      const meta = await p.evaluate(() => JSON.parse(localStorage.getItem('hakuviestit.v1')).M.crypto);
      await p.waitForTimeout(700);
      const meta2 = await p.evaluate(() => JSON.parse(localStorage.getItem('hakuviestit.v1')).M.crypto);
      ok(tag + 'enabled: bio meta {v, credId, salt, iv, ct} stored with the lock meta', !!meta2.bio && Object.keys(meta2.bio).sort().join() === 'credId,ct,iv,salt,v' && !!meta2.check, meta2);
      ok(tag + 'password not stored anywhere', !(await p.evaluate(() => localStorage.getItem('hakuviestit.v1'))).includes(PW));
      await p.reload(); await p.waitForSelector('#lock-form', { state: 'attached' }).catch(() => { });
      await p.waitForSelector('#chat-ex-valio', { timeout: 20000 }); await p.waitForTimeout(400);
      ok(tag + 'app opens: biometric prompt starts by itself and unlocks (real PRF round trip) without a tap, data restored', await p.locator('#chat-list .row').count() === 5);
      await p.click('#lockfab'); await p.waitForSelector('#chat-ex-valio', { timeout: 20000 });
      ok(tag + 'second lock: auto unlock works too', true);
      // poista tunniste laitteelta -> automaattinen yritys epäonnistuu hiljaa, salasana toimii
      await cdp.send('WebAuthn.clearCredentials', { authenticatorId }); await p.click('#lockfab'); await p.waitForSelector('#lock-form');
      await p.waitForFunction(() => { const e = document.getElementById('unlock-hint'); return e && !e.hidden; }, null, { timeout: 20000 }).catch(() => { });
      ok(tag + 'failing authenticator (auto): quiet hint, no red error, no failure counted, still locked', await p.isVisible('#unlock-hint') && await p.evaluate(() => document.getElementById('lock-err').hidden === true && localStorage.getItem('hv-fails') === null) && await p.locator('#lock-form').count() === 1);
      ok(tag + 'unlock button above the password field', await p.evaluate(() => { const k = [...document.querySelector('.lock-card').children].map(c => c.id); return k.indexOf('unlock-bio') < k.indexOf('lock-form'); }));
      await p.click('#unlock-bio'); await p.waitForFunction(() => /epäonnistui\. Kirjoita salasana\./.test(document.getElementById('lock-err').textContent), null, { timeout: 20000 }).catch(() => { });
      const failTxt = await p.textContent('#lock-err');
      ok(tag + 'manual retry fails: generic fallback text, still locked, exception not counted', /(Face ID -avaus|Biometrinen avaus) epäonnistui\. Kirjoita salasana\./.test(failTxt) && await p.locator('#lock-form').count() === 1 && await p.evaluate(() => localStorage.getItem('hv-fails') === null), failTxt);
      await p.fill('#lock-pw', PW); await p.click('#lock-go'); await p.waitForSelector('#chat-ex-valio', { timeout: 30000 });
      ok(tag + 'password still unlocks', true);
    } else {
      await p.waitForFunction(() => !document.getElementById('bio-err').hidden, null, { timeout: 20000 });
      const t = await p.textContent('#bio-err');
      ok(tag + 'no PRF -> not enabled, iOS unsupported text', /^Face ID ei ole käytettävissä tässä näkymässä\. Toimii Safarissa tai Koti-valikkoon lisätyssä sovelluksessa \(iOS 18 tai uudempi\): avaa sivu Safarilla ja valitse Jaa → Lisää Koti-valikkoon\.$/.test(t) && !(await p.evaluate(() => JSON.parse(localStorage.getItem('hakuviestit.v1')).M.crypto.bio)), t);
    }
    await ctx.close();
  }
  await browser.close(); server.close();
  ok('no console errors/warnings', errs.length === 0, errs);
  console.log(`\nE2E tietosuoja: ${pass} ok, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('E2E-VIRHE', e); try { server.close(); } catch (x) { /* ok */ } process.exit(2); });
