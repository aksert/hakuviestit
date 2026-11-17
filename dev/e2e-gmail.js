// Gmail-E2E headless Chromella: mock window.claude.use('mcp') (kuvitteellista dataa), kuvakaappaukset dev\shots\
const http = require('http'), fs = require('fs'), path = require('path');
const pw = require(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx', '9833c18b2d85bc59', 'node_modules', 'playwright-core'));
const HTML = path.resolve(__dirname, '..', 'hakuviestit.html');
const SH = path.join(__dirname, 'shots');
fs.mkdirSync(SH, { recursive: true });
const PW = 'Kx7#mQ2!vR9$tLw4';
let pass = 0, fail = 0; const errs = [];
const ok = (n, c, i) => { if (c) pass++; else { fail++; console.log('FAIL', n, i === undefined ? '' : JSON.stringify(i)); } };
const server = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(HTML, 'utf8') + '</body></html>'); }).listen(0, '127.0.0.1');

const MOCK = () => {
  const ms = iso => String(Date.parse(iso));
  window.__gmlog = [];
  const T = {
    t1: [{ id: 'e1', threadId: 't1', internalDate: ms('2026-11-02T09:00:00Z'), date: '2026-11-02T09:00:00Z', labelIds: ['INBOX'], sender: 'rekry@valio.example.fi', toRecipients: ['oma.esimerkki@gmail.com'], addressDisplayNames: [{ displayName: 'Heli Ranta', emailAddress: 'rekry@valio.example.fi' }], subject: 'Toinen haastattelu', snippet: 's', plaintextBody: 'Hei Eero,\n\nkutsumme sinut toiselle kierrokselle tiistaina klo 10.\n\nOn Mon, 2 Nov 2026 at 08:00, Eero <oma.esimerkki@gmail.com> wrote:\n> Kiitos kutsusta' }],
    t2: [{ id: 'e2', threadId: 't2', internalDate: ms('2026-11-03T07:30:00Z'), date: '2026-11-03T07:30:00Z', labelIds: ['SENT'], sender: 'oma.esimerkki@gmail.com', toRecipients: ['mikko.laine@valio.example.fi'], addressDisplayNames: [], subject: 'Re: Aikataulu', snippet: 's', plaintextBody: 'Kiitos, sopii hyvin.', attachments: [{ filename: 'cv.pdf' }] }]
  };
  const mcp = { callTool: async (server, tool, input, opts) => {
    window.__gmlog.push({ server, tool, input, opts });
    await new Promise(r => setTimeout(r, 60));
    if (tool === 'search_threads') {
      const q = input.query || '';
      const mm = (id, tid, sender, to, subj, date, o) => Object.assign({ id, threadId: tid, internalDate: ms(date), date, labelIds: ['INBOX'], sender, toRecipients: to, ccRecipients: [], addressDisplayNames: [], subject: subj }, o || {});
      const ME = ['oma.esimerkki@gmail.com'];
      if (q === 'in:sent') return { payload: { threads: [{ id: 's1', messages: [mm('sm', 's1', ME[0], ['x@example.fi'], '', '2026-11-02T10:00:00Z', { labelIds: ['SENT'] })] }] } };
      if (q.startsWith('in:sent -in:chats')) return { payload: { threads: [
        { id: 'a1', messages: [mm('d1', 'a1', 'sirpa@testioy.example.fi', ME, 'Työhaastattelu keskiviikkona', '2026-10-20T10:00:00Z', { addressDisplayNames: [{ displayName: 'Sirpa Testaaja', emailAddress: 'sirpa@testioy.example.fi' }] }), mm('d2', 'a1', ME[0], ['sirpa@testioy.example.fi'], 'Re: Työhaastattelu keskiviikkona', '2026-10-20T11:00:00Z', { labelIds: ['SENT'] })] },
        { id: 'a2', messages: [mm('d3', 'a2', 'rekry@uusiyritys.example.fi', ME, 'Hakemuksesi', '2026-10-28T10:00:00Z'), mm('d4', 'a2', ME[0], ['rekry@uusiyritys.example.fi'], 'Re: Hakemuksesi', '2026-10-28T11:00:00Z', { labelIds: ['SENT'] })] },
        { id: 'a3', messages: [mm('d5', 'a3', 'myynti@kauppa.example.fi', ME, 'Tilaus 55 kuitti', '2026-09-01T10:00:00Z')] },
        { id: 'a4', messages: [mm('d6', 'a4', 'ystava@gmail.com', ME, 'Mökille viikonloppuna?', '2026-10-25T10:00:00Z', { addressDisplayNames: [{ displayName: 'Ystävä', emailAddress: 'ystava@gmail.com' }] })] }] } };
      if (q.startsWith('-in:sent')) return { payload: { threads: [{ id: 'b1', messages: [mm('d7', 'b1', 'noreply@rekry.firma.example.fi', ME, 'Hakemuksesi on vastaanotettu', '2026-10-05T10:00:00Z')] }] } };
      return { payload: { threads: [{ id: 't1' }, { id: 't2' }] } };
    }
    if (tool === 'get_thread') return { payload: { id: input.threadId, messages: T[input.threadId] } };
    if (tool === 'reply') return { payload: { id: 'sent9', threadId: 't1' } };
    if (tool === 'send_message') return { payload: { id: 'sent8', threadId: 'tn' } };
    return { payload: {} };
  } };
  window.claude = { use: async n => (n === 'mcp' ? mcp : n === 'permissions' ? { state: async () => 'granted', manage: async () => { } } : null) };
};

(async () => {
  await new Promise(r => server.once('listening', r));
  const URL = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await pw.chromium.launch({ headless: true, channel: 'chrome' });
  for (const [name, opts] of [['mobile', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }], ['desktop', { viewport: { width: 1440, height: 900 } }]]) {
    const ctx = await browser.newContext(opts); await ctx.addInitScript(() => { try { localStorage.setItem('hv-bio-offer', 'no'); } catch (e) { /* ok */ } });   // ei biometriatarjousta muiden testien tielle
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(MOCK);
    await p.goto(URL);
    await p.waitForSelector('#sec-setup-form'); await p.fill('#sec-pw1', PW); await p.fill('#sec-pw2', PW); await p.click('#sec-go');
    await p.waitForSelector('#chat-ex-valio', { timeout: 30000 }); await p.waitForTimeout(600);
    const tap = sel => (name === 'mobile' ? p.tap(sel) : p.click(sel));
    ok(name + ': no Gmail calls before user action', await p.evaluate(() => window.__gmlog.length === 0));
    await tap('#chat-ex-valio'); await p.waitForTimeout(700);
    ok(name + ': Gmail button visible in chat header', await p.isVisible('#ch-gmail'));
    await tap('#ch-gmail'); await p.waitForSelector('#gs-cancel', { timeout: 3000 }).catch(() => { });
    await p.waitForFunction(() => /\+2 uutta viestiä/.test(document.getElementById('toasts').textContent), null, { timeout: 15000 });
    await p.waitForTimeout(900);
    ok(name + ': sync inserted 2 messages (3 calls)', await p.evaluate(() => window.__gmlog.map(c => c.tool).join() === 'search_threads,get_thread,get_thread'));
    const lay = await p.evaluate(() => { const bb = document.querySelectorAll('.bubble'); const lb = bb[bb.length - 1].getBoundingClientRect(); const c = document.querySelector('.composer').getBoundingClientRect(); return { bubbles: bb.length, lastBottom: Math.round(lb.bottom), composerTop: Math.round(c.top), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
    ok(name + ': last bubble above composer, no h-overflow', lay.lastBottom <= lay.composerTop && lay.sw <= lay.cw, lay);
    await p.screenshot({ path: path.join(SH, name === 'mobile' ? 'gmail-sync.png' : 'gmail-sync-desktop.png') });
    // työpaikkakeskustelujen etsintä (ei sample-capabilityä -> sääntöpohjainen)
    await p.evaluate(() => { window.__gmlog.length = 0; });
    await tap('#ch-back').catch(() => {});
    await tap('#tab-accounts'); await p.waitForSelector('#gm-discover');
    await p.evaluate(() => document.getElementById('gm-discover').scrollIntoView({ block: 'center' }));
    await tap('#gm-discover'); await p.waitForSelector('#dp-go');
    ok(name + ': discovery prompt, no Gmail calls before Etsi', await p.evaluate(() => window.__gmlog.length === 0));
    await tap('#dp-go'); await p.waitForSelector('#dr-go', { timeout: 15000 }); await p.waitForTimeout(300);
    const dsum = await p.evaluate(() => ({ title: document.querySelector('.sheet-t').textContent, work: document.querySelectorAll('#dr-list .dr-row').length, others: document.querySelectorAll('#dr-others .dr-row').length, btn: document.getElementById('dr-go').textContent, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok(name + ': review shows work rows, others collapsed, no h-overflow', dsum.work === 3 && dsum.others === 2 && dsum.sw <= dsum.cw, dsum);
    await p.screenshot({ path: path.join(SH, name === 'mobile' ? 'gmail-discover.png' : 'gmail-discover-desktop.png') });
    await tap('.sheet-h .icon-btn'); await p.waitForTimeout(200);
    await p.evaluate(() => { window.__gmlog.length = 0; });
    await tap('#tab-chats'); await p.waitForTimeout(200);
    await tap('#chat-ex-valio'); await p.waitForTimeout(500);
    // oletus: avaa sähköpostisovelluksessa, ei Gmail-kirjoitusta
    await p.check('#c-gmail');
    await p.fill('#c-body', 'Kiitos kutsusta, tulen mielelläni toiselle kierrokselle.');
    await tap('#c-send'); await p.waitForSelector('#gc-open');
    ok(name + ': default compose: gc-open mailto href, no gc-send, no Gmail calls', await p.evaluate(() => /^mailto:[^?]+[?]subject=Re%3A/.test(document.getElementById('gc-open').getAttribute('href')) && !document.getElementById('gc-send') && !window.__gmlog.length));
    await tap('#gc-cancel'); await p.waitForTimeout(300);
    await tap('#ch-back').catch(() => {});
    await tap('#tab-accounts'); await p.waitForSelector('#gm-direct');
    await p.evaluate(() => document.getElementById('gm-direct').scrollIntoView({ block: 'center' }));
    await p.check('#gm-direct'); await p.waitForTimeout(300);
    await tap('#tab-chats'); await p.waitForTimeout(200);
    await tap('#chat-ex-valio'); await p.waitForTimeout(500);
    // lähetys: vahvistussheet
    await p.check('#c-gmail');
    await p.fill('#c-body', 'Kiitos kutsusta, tulen mielelläni toiselle kierrokselle.');
    await tap('#c-send'); await p.waitForSelector('#gc-send');
    ok(name + ': confirm sheet shows recipient, subject, body; nothing sent yet', await p.evaluate(() => /Kiitos kutsusta/.test(document.getElementById('gc-body').value) && document.getElementById('gc-subject').value.startsWith('Re: ') && !window.__gmlog.some(c => c.tool === 'reply')));
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(SH, name === 'mobile' ? 'gmail-confirm.png' : 'gmail-confirm-desktop.png') });
    await tap('#gc-send'); await p.waitForFunction(() => window.__gmlog.some(c => c.tool === 'reply'), null, { timeout: 5000 });
    await p.waitForTimeout(800);
    const rep = await p.evaluate(() => window.__gmlog.find(c => c.tool === 'reply'));
    ok(name + ': reply called with messageId/body/to', rep && Object.keys(rep.input).sort().join() === 'body,messageId,to' && rep.input.messageId === 'e2' && rep.opts.cache === false, rep);
    ok(name + ': composer cleared after send', await p.inputValue('#c-body') === '');
    await ctx.close();
  }
  // mcp = null -> ei Gmail-UI:ta
  { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); await ctx.addInitScript(() => { try { localStorage.setItem('hv-bio-offer', 'no'); } catch (e) { /* ok */ } });   // ei biometriatarjousta muiden testien tielle
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.claude = { use: async () => null }; });
    await p.goto(URL); await p.waitForSelector('#sec-setup-form'); await p.fill('#sec-pw1', PW); await p.fill('#sec-pw2', PW); await p.click('#sec-go');
    await p.waitForSelector('#chat-ex-valio', { timeout: 30000 }); await p.waitForTimeout(500);
    await p.click('#chat-ex-valio'); await p.waitForTimeout(500);
    ok('mcp null: no Gmail header button; composer email toggle (mailto) visible', !(await p.isVisible('#ch-gmail')) && (await p.isVisible('#c-gmail-row')));
    await p.click('#ch-back'); await p.click('#tab-accounts'); await p.waitForTimeout(300);
    ok('mcp null: settings note, no sync button', /Gmail-yhteys toimii, kun sovellus avataan claude\.ai:ssa\./.test(await p.textContent('#gm-note')) && !(await p.isVisible('#gm-sync-all')));
    await ctx.close(); }
  await browser.close(); server.close();
  ok('no console errors/warnings', errs.length === 0, errs);
  console.log(`\nE2E Gmail: ${pass} ok, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('E2E-VIRHE', e); try { server.close(); } catch (x) { /* ok */ } process.exit(2); });
