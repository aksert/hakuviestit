// Puhelinversion suora Gmail-yhteys: OAuth-paluu, etsintä Gmail REST -rajapinnan kautta (valefetch), lukitus unohtaa kirjautumisen. Kuvitteellista dataa.
(async () => {
  const txt = el => el ? el.textContent : null;
  const byId = id => document.querySelector('#' + id);
  const ms = iso => String(Date.parse(iso));
  const b64 = s => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const ME = 'oma.esimerkki@gmail.com';
  const hdrs = (from, to, subj, date) => [{ name: 'From', value: from }, { name: 'To', value: to }, { name: 'Subject', value: subj }, { name: 'Date', value: date }];
  const MSG = {
    s1: { id: 'sm1', threadId: 's1', internalDate: ms('2026-11-02T10:00:00Z'), labelIds: ['SENT'], snippet: '', payload: { headers: hdrs(ME, 'joku@example.fi', 'x', '') } },
    a1: [{ id: 'm1', threadId: 'a1', internalDate: ms('2026-11-01T10:00:00Z'), labelIds: ['INBOX'], snippet: 'Hei', payload: { mimeType: 'text/plain', headers: hdrs('Sirpa Testaaja <sirpa@testioy.example.fi>', ME, 'Työhaastattelu keskiviikkona', ''), body: { data: b64('Tervetuloa haastatteluun.') } } },
      { id: 'm2', threadId: 'a1', internalDate: ms('2026-11-01T12:00:00Z'), labelIds: ['SENT'], snippet: 'Kiitos', payload: { mimeType: 'text/plain', headers: hdrs(ME, 'sirpa@testioy.example.fi', 'Re: Työhaastattelu keskiviikkona', ''), body: { data: b64('Kiitos, tulen.') } } }]
  };
  FETCHHANDLER = async url => {
    const u = new URL(url);
    if (!url.startsWith('https://gmail.googleapis.com/gmail/v1/users/me/')) return { status: 400, body: {} };
    const q = u.searchParams.get('q');
    if (u.pathname.endsWith('/threads') && q === 'in:sent') return { status: 200, body: { threads: [{ id: 's1' }] } };
    if (u.pathname.endsWith('/threads') && q && q.startsWith('in:sent -in:chats')) return { status: 200, body: { threads: [{ id: 'a1' }] } };
    if (u.pathname.endsWith('/threads') && q && q.startsWith('-in:sent')) return { status: 200, body: {} };
    if (u.pathname.endsWith('/threads') && q && q.startsWith('(')) return { status: 200, body: { threads: [{ id: 'a1' }] } };
    if (u.pathname.endsWith('/threads/s1')) return { status: 200, body: { id: 's1', messages: [MSG.s1] } };
    if (u.pathname.endsWith('/threads/a1')) return { status: 200, body: { id: 'a1', messages: MSG.a1 } };
    return { status: 404, body: {} };
  };
  T.ok('oauth: fragment removed from URL before anything else', HIST.length === 1 && HIST[0][0] === 'replace' && HIST[0][1] === '/hv/' && location.hash === '', HIST);
  T.ok('oauth: state + intent consumed from localStorage', localStorage.getItem('hv-oauth-state') === null && localStorage.getItem('hv-oauth-intent') === null);
  T.ok('oauth: token held in memory, not usable while locked', gmailRestReady() && S.locked === true && !gmailAvailable());
  await doSetup();
  T.ok('after unlock: REST backend active', gmailAvailable() && gmailIsRest() && S.mcp === gmailRestBackend);
  T.ok('after unlock: discover prompt opened (intent)', await waitFor(() => byId('dp-go'), 3000));
  T.ok('no Gmail requests before the user taps', FETCHLOG.length === 0, FETCHLOG.map(f => f.url));
  byId('dp-go').click();
  T.ok('review sheet shown', await waitFor(() => byId('dr-go'), 6000), txt(byId('toasts')));
  T.ok('all requests to gmail.googleapis.com with bearer token, no credentials', FETCHLOG.length > 0 && FETCHLOG.every(f => f.url.startsWith('https://gmail.googleapis.com/') && f.auth === 'Bearer TESTTOKEN-xyz' && f.opts.credentials === 'omit'), FETCHLOG.map(f => f.url));
  T.ok('account from SENT added to own addresses', myEmailSet().has(ME));
  T.ok('Testioy found as job conversation', /Testioy/.test(txt(byId('dr-list'))), txt(byId('dr-list')));
  byId('dr-go').click();
  await waitFor(() => /\+1 keskustelu/.test(txt(byId('toasts'))), 8000);
  const cid = Object.keys(S.chats).find(k => /Testioy/i.test(S.chats[k].name));
  const msgs = cid ? await S.store.listMessages(cid) : [];
  T.ok('chat created with 2 messages from Gmail API', !!cid && msgs.filter(m => m.source === 'gmail').length === 2 && msgs.some(m => m.body === 'Tervetuloa haastatteluun.' && m.dir === 'in') && msgs.some(m => m.body === 'Kiitos, tulen.' && m.dir === 'out'), msgs.map(m => [m.id, m.dir, m.body]));
  await sleepT(700);
  const idbStr = JSON.stringify([...IDB_DATA.docs.entries()]) + JSON.stringify([...IDB_DATA.meta.entries()]);
  const lsStr = JSON.stringify(Object.keys(globalThis).includes('localStorage') ? [localStorage.getItem('hv-oauth-state')] : []);
  T.ok('token never persisted (idb, localStorage)', !idbStr.includes('TESTTOKEN') && !lsStr.includes('TESTTOKEN'));
  T.ok('direct send never offered (read-only)', (() => { openChat(cid); return true; })() && await waitFor(() => byId('c-gmail-row'), 2000) && settings().gmailDirect === false);
  // Omat tilit: yhdistetty-tila ja katkaisu
  closeChat('accounts'); await sleepT(200);
  T.ok('accounts: connected state, disconnect visible, direct-send hidden', byId('gm-rest').hidden === false && byId('gm-disconnect').hidden === false && byId('gm-connect').hidden === true && byId('gm-direct-row').hidden === true && /Yhdistetty/.test(txt(byId('gm-rest-status'))), txt(byId('gm-rest-status')));
  // vanhentunut kirjautuminen keskellä hakua -> virhe + "Kirjaudu Googleen"
  FETCHHANDLER = async () => ({ status: 401, body: {} });
  gmailSyncOne(cid);
  T.ok('401 -> reauth button shown, token forgotten', await waitFor(() => byId('gm-reauth'), 4000) && !gmailRestReady() && S.mcp === null, txt(byId('gm-err-text')));
  sheetStack.slice().forEach(s => s.close()); await sleepT(100);
  showView('accounts'); await sleepT(100);
  T.ok('accounts: client id setup shown when no id saved', byId('gm-setup-wrap').hidden === false && byId('gm-connect').hidden === true && !!byId('gm-redirect') && txt(byId('gm-redirect')) === 'https://esim.example/hv/', txt(byId('gm-redirect')));
  byId('gm-client').value = 'ei-kelpaa'; byId('gm-client-save').click(); await sleepT(100);
  T.ok('invalid client id rejected', byId('gm-client-err').hidden === false && !settings().gmailClientId);
  byId('gm-client').value = '123456789012-abcdefgh1234.apps.googleusercontent.com'; byId('gm-client-save').click(); await sleepT(500);
  T.ok('client id saved (encrypted profile), connect button shown', settings().gmailClientId === '123456789012-abcdefgh1234.apps.googleusercontent.com' && byId('gm-connect').hidden === false && byId('gm-setup-wrap').hidden === true);
  byId('gm-connect').click(); await waitFor(() => byId('cf-ok')); byId('cf-ok').click(); await sleepT(100);
  const as = HIST.find(x => x[0] === 'assign');
  const st = localStorage.getItem('hv-oauth-state');
  T.ok('connect: redirects to Google with readonly scope + random state stored', !!as && as[1].startsWith('https://accounts.google.com/o/oauth2/v2/auth?') && as[1].includes('gmail.readonly') && !!st && st.length === 32 && as[1].includes('state=' + st) && as[1].includes('redirect_uri=' + encodeURIComponent('https://esim.example/hv/')) && localStorage.getItem('hv-oauth-intent') === 'discover', as);
  // lukitus unohtaa kirjautumisen
  GOAUTH.token = 'X'; GOAUTH.exp = Date.now() + 60000; gmailRestUse();
  lockNow(); await sleepT(100);
  T.ok('lock forgets token', !gmailRestReady() && S.mcp === null && GOAUTH.token === '');
  T.done();
})().catch(e => { console.error(e); T.ok('driver exception', false, String(e && e.stack)); T.done(); });
