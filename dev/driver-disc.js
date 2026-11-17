(async () => {
  const txt = el => el ? el.textContent : null;
  const byId = id => document.querySelector('#' + id);
  const ms = iso => String(Date.parse(iso));
  await doSetup();
  await waitFor(() => S.mcp !== null, 3000);
  await sleepT(200);
  T.ok('mcp available, sample never requested', gmailAvailable() && !USE_REQUESTED.includes('sample'));
  T.ok('no Gmail calls on load', GMLOG.length === 0);

  // ---- kuvitteellinen Gmail (vain example.fi) ----
  let ACC = 'oma.esimerkki@gmail.com';
  const M = (id, tid, sender, to, subj, date, o) => Object.assign({ id, threadId: tid, internalDate: ms(date), date, labelIds: ['INBOX'], sender, toRecipients: to, ccRecipients: [], addressDisplayNames: [], subject: subj }, o || {});
  const ME = ['oma.esimerkki@gmail.com'];
  const A1 = [
    { id: 'a1', messages: [M('m1', 'a1', 'rekry@valio.example.fi', ME, 'Haastattelu', '2026-11-01T10:00:00Z'), M('m2', 'a1', ME[0], ['rekry@valio.example.fi'], 'Re: Haastattelu', '2026-11-01T12:00:00Z', { labelIds: ['SENT'] })] },
    { id: 'a2', messages: [M('m3', 'a2', 'sirpa@testioy.example.fi', ME, 'Työhaastattelu keskiviikkona', '2026-10-20T10:00:00Z', { addressDisplayNames: [{ displayName: 'Sirpa Testaaja', emailAddress: 'sirpa@testioy.example.fi' }] }), M('m4', 'a2', ME[0], ['sirpa@testioy.example.fi'], 'Re: Työhaastattelu keskiviikkona', '2026-10-20T11:00:00Z', { labelIds: ['SENT'] })] }
  ];
  const A2 = [
    { id: 'a3', messages: [M('m5', 'a3', 'myynti@kauppa.example.fi', ME, 'Tilaus 55 kuitti', '2026-09-01T10:00:00Z')] },
    { id: 'a4', messages: [M('m6', 'a4', 'ystava@gmail.com', ME, 'Mökille viikonloppuna?', '2026-10-25T10:00:00Z', { addressDisplayNames: [{ displayName: 'Ystävä', emailAddress: 'ystava@gmail.com' }] }), M('m7', 'a4', ME[0], ['ystava@gmail.com'], 'Re: Mökille viikonloppuna?', '2026-10-25T11:00:00Z', { labelIds: ['SENT'] })] }
  ];
  const B1 = [{ id: 'b1', messages: [M('m8', 'b1', 'noreply@rekry.firma.example.fi', ME, 'Hakemuksesi on vastaanotettu', '2026-10-05T10:00:00Z')] },
    { id: 'b2', messages: [M('m20', 'b2', 'noreply@kuntarekry.fi', ME, 'Kiitos hakemuksestasi', '2026-10-12T10:00:00Z', { addressDisplayNames: [{ displayName: 'Kuntarekry / Esimerkkikaupunki', emailAddress: 'noreply@kuntarekry.fi' }] })] }]
    .concat(Array.from({ length: 30 }, (_, i) => ({ id: 'al' + i, messages: [M('mal' + i, 'al' + i, 'alerts@duunitori.fi', ME, 'Duunitori löysi sinulle ' + (i + 3) + ' työpaikkaa – rekrytoi nyt!', '2026-10-' + String(1 + (i % 28)).padStart(2, '0') + 'T08:00:00Z')] })))
    .concat(Array.from({ length: 6 }, (_, i) => ({ id: 'nl' + i, messages: [M('mnl' + i, 'nl' + i, 'vahti@tyovahti.example.fi', ME, 'Uusia työpaikkoja: rekrytoi nyt ' + i, '2026-10-0' + (i + 1) + 'T09:00:00Z')] })));
  const FULL = {
    tT: [M('g10', 'tT', 'sirpa@testioy.example.fi', ME, 'Työhaastattelu keskiviikkona', '2026-10-20T10:00:00Z', { plaintextBody: 'Tervetuloa haastatteluun.', addressDisplayNames: [{ displayName: 'Sirpa Testaaja', emailAddress: 'sirpa@testioy.example.fi' }] }), M('g11', 'tT', ME[0], ['sirpa@testioy.example.fi'], 'Re: Työhaastattelu keskiviikkona', '2026-10-20T11:00:00Z', { labelIds: ['SENT'], plaintextBody: 'Kiitos, tulen.' })],
    tK: [M('g13', 'tK', 'noreply@kuntarekry.fi', ME, 'Kiitos hakemuksestasi', '2026-10-12T10:00:00Z', { plaintextBody: 'Hakemuksesi on vastaanotettu.', addressDisplayNames: [{ displayName: 'Kuntarekry / Esimerkkikaupunki', emailAddress: 'noreply@kuntarekry.fi' }] })],
    tF: [M('g12', 'tF', 'noreply@rekry.firma.example.fi', ME, 'Hakemuksesi on vastaanotettu', '2026-10-05T10:00:00Z', { plaintextBody: 'Olemme vastaanottaneet hakemuksesi.' })]
  };
  const handler = async (tool, input) => {
    if (tool === 'search_threads') {
      const q = input.query;
      if (q === 'in:sent') return { threads: [{ id: 's1', messages: [M('sm', 's1', ACC, ['joku@example.fi'], '', '2026-11-02T10:00:00Z', { labelIds: ['SENT'] })] }] };
      if (q.startsWith('in:sent -in:chats')) return input.pageToken ? { threads: A2 } : { threads: A1, nextPageToken: 'p2' };
      if (q.startsWith('-in:sent -in:chats')) return { threads: B1 };
      if (q.startsWith('(')) {   // chat-kohtainen haku
        if (q.includes('testioy.example.fi')) return { threads: [{ id: 'tT' }] };
        if (q.includes('firma.example.fi')) return { threads: [{ id: 'tF' }] };
        if (q.includes('kuntarekry.fi')) return { threads: [{ id: 'tK' }] };
        return { threads: [] };
      }
    }
    if (tool === 'get_thread') return { id: input.threadId, messages: FULL[input.threadId] || [] };
    return {};
  };
  GMHANDLER = handler;
  const addEmail = async v => { document.querySelector('#tab-accounts').click(); byId('acc-type').value = 'email'; byId('acc-value').value = v; byId('acc-label').value = ''; byId('acc-form').dispatchEvent({ type: 'submit' }); };

  // ---- 1. oman sähköpostin lisäys avaa kysymyksen, mutta ei kutsu Gmailia ----
  ACC = 'toinen.tili@gmail.com';
  await addEmail('oma.discover@gmail.com');
  await waitFor(() => byId('dp-go'), 3000);
  T.ok('adding own email opens prompt (text, period default 2 v, buttons)', !!byId('dp-go') && !!byId('dp-no') && /Sovellus etsii Gmailista kaikki keskustelut, joita olet käynyt työnantajien kanssa, ja tekee niistä chatit\. Mitään ei lähetetä\./.test(txt(byId('dp-text'))) && byId('dp-period').value === '2y' && byId('dp-period').querySelectorAll('option').map(o => txt(o)).join() === '6 kk,1 v,2 v,Kaikki', byId('dp-period').value);
  T.ok('prompt: no Gmail call before the Etsi tap', GMLOG.length === 0);
  byId('dp-no').click(); await sleepT(100);
  T.ok('"Ei nyt": still no calls, no sheet', GMLOG.length === 0 && sheetStack.length === 0);
  T.ok('settings + empty-state buttons exist', (document.querySelector('#tab-accounts').click(), byId('gm-discover').hidden === false));

  // ---- 2. tilin ristiriita: peruutus ----
  byId('gm-discover').click(); await waitFor(() => byId('dp-go'), 2000);
  byId('dp-go').click();
  await waitFor(() => byId('cf-ok'), 4000);
  T.ok('account mismatch notice', /Gmail-yhdistäjä on kirjautunut tilille toinen\.tili@gmail\.com\. Voit hakea vain sen tilin postit\./.test(txt(sheetStack[sheetStack.length - 1].layer)) && /Jatka tällä tilillä/.test(txt(byId('cf-ok'))) && /Peruuta/.test(txt(byId('cf-cancel'))));
  T.ok('only the account check call so far (view METADATA_ONLY, pageSize 1)', GMLOG.length === 1 && GMLOG[0].input.query === 'in:sent' && GMLOG[0].input.pageSize === 1 && GMLOG[0].input.view === 'THREAD_VIEW_METADATA_ONLY', GMLOG);
  byId('cf-cancel').click(); await sleepT(200);
  T.ok('cancel stops discovery, nothing created, busy released', GMLOG.length === 1 && sheetStack.length === 0 && !DISC.busy && !GM.busy && !S.profile.identities.some(i => i.value === 'toinen.tili@gmail.com'));

  // ---- 3. jatka tällä tilillä -> haku ----
  GMLOG.length = 0;
  document.querySelector('#tab-accounts').click(); byId('gm-discover').click(); await waitFor(() => byId('dp-go'), 2000);
  byId('dp-go').click(); await waitFor(() => byId('cf-ok'), 4000);
  byId('cf-ok').click();
  await waitFor(() => byId('dr-go'), 8000);
  const dcalls = GMLOG.map(c => c.tool + ':' + (c.input.pageToken ? 'p2' : 'p1'));
  T.ok('identity of the connected account added (label Gmail)', S.profile.identities.some(i => i.type === 'email' && i.value === 'toinen.tili@gmail.com' && i.label === 'Gmail'), S.profile.identities);
  T.ok('discovery calls: account check, A p1, A p2, B', dcalls.join() === 'search_threads:p1,search_threads:p1,search_threads:p2,search_threads:p1', dcalls);
  const qA = GMLOG[1].input, qA2 = GMLOG[2].input, qB = GMLOG[3].input;
  T.ok('query A: in:sent -in:chats newer_than:2y, MINIMAL, pageSize 50, page token followed', qA.query === 'in:sent -in:chats newer_than:2y' && qA.view === 'THREAD_VIEW_MINIMAL' && qA.pageSize === 50 && qA2.pageToken === 'p2', [qA, qA2]);
  T.ok('query B: -in:sent -in:chats category:primary newer_than:2y (job words)', qB.query.startsWith('-in:sent -in:chats category:primary newer_than:2y (hakemus OR') && qB.query.includes('"job offer") -from:duunitori.fi') && !qB.query.includes('-from:kuntarekry.fi') && qB.view === 'THREAD_VIEW_MINIMAL', qB.query);
  T.ok('all discovery calls on server Gmail, cache:false, only metadata views (no get_thread)', GMLOG.every(c => c.server === 'Gmail' && c.opts.cache === false && c.tool === 'search_threads' && ['THREAD_VIEW_MINIMAL', 'THREAD_VIEW_METADATA_ONLY'].includes(c.input.view)));
  T.ok('no sample: heuristic used, no confirmation about Claude, sample never called', !USE_REQUESTED.includes('sample') && /sääntöpohjainen/.test(txt(byId('dr-note'))), txt(byId('dr-note')));

  // ---- 4. tarkistusnäkymä ----
  const sheetTxt = txt(sheetStack[sheetStack.length - 1].layer);
  T.ok('review: title "Löytyi 4 työpaikkaa"', /Löytyi 4 työpaikkaa/.test(sheetTxt), sheetTxt.slice(0, 80));
  const rows = document.querySelectorAll('.dr-row');
  const workRows = byId('dr-list').querySelectorAll('.dr-row'), otherRows = byId('dr-others').querySelectorAll('.dr-row');
  T.ok('review: 4 work rows checked on top (Valio, Testi, Firma, ATS), 4 others unchecked under collapsed "Muut keskustelut (4)"', workRows.length === 4 && otherRows.length === 4 && byId('dr-others').hidden === true && /Muut keskustelut \(4\)/.test(txt(byId('dr-others-toggle'))) && workRows.every(r => r.querySelector('input[type=checkbox]').checked) && otherRows.every(r => !r.querySelector('input[type=checkbox]').checked));
  T.ok('review: existing chat row shows "jo chatissa"', workRows.some(r => /jo chatissa: Valio/.test(txt(r))), workRows.map(r => txt(r).slice(0, 60)));
  T.ok('review: meta (threads, addresses, relative date)', workRows.some(r => /ketju · \d+ osoit/.test(txt(r)) || /ketjua · \d+ osoit/.test(txt(r))));
  T.ok('review: job board row is under Muut with tag "Työpaikkailmoitukset", unchecked; newsletter-like sender also unchecked', otherRows.some(r => /Työpaikkailmoitukset/.test(txt(r)) && /30 ketjua/.test(txt(r))) && otherRows.some(r => /Tyovahti|Vahti/i.test(txt(r)) && /6 ketjua/.test(txt(r))), otherRows.map(r => txt(r).slice(0, 70)));
  T.ok('review: ATS receipt row is work, company from display name (not the ATS domain)', workRows.some(r => r.querySelector('input[type=text]') && r.querySelector('input[type=text]').value === 'Esimerkkikaupunki'), workRows.map(r => (r.querySelector('input[type=text]') || { value: txt(r).slice(0, 20) }).value));
  T.ok('review: footer button', /^Luo 3 keskustelua ja hae viestit$/.test(txt(byId('dr-go'))), txt(byId('dr-go')));
  byId('dr-others-toggle').click();
  T.ok('others toggle expands', byId('dr-others').hidden === false && byId('dr-others-toggle').getAttribute('aria-expanded') === 'true');
  const shopChk = otherRows[0].querySelector('input[type=checkbox]'); shopChk.checked = true; shopChk.dispatchEvent({ type: 'change', target: shopChk });
  T.ok('checking an "other" row updates the button', /^Luo 4 keskustelua/.test(txt(byId('dr-go'))));
  shopChk.checked = false; shopChk.dispatchEvent({ type: 'change', target: shopChk });
  const testiRow = workRows.find(r => r.querySelector('input[type=text]') && r.querySelector('input[type=text]').value === 'Testioy');
  T.ok('review: company names editable (' + 'heuristic company from domain' + ')', !!testiRow);
  const nameIn = testiRow.querySelector('input[type=text]'); nameIn.value = 'Testi Oy'; nameIn.dispatchEvent({ type: 'input', target: nameIn });

  const savedChats = S.chats; S.chats = {}; renderChatList();
  T.ok('empty chat list state offers primary Hae sähköpostista (#empty-mail), empty-add not primary, old empty-discover gone', !!byId('empty-mail') && /Hae sähköpostista/.test(txt(byId('empty-mail'))) && byId('empty-mail').className.includes('primary') && !byId('empty-add').className.includes('primary') && !byId('empty-discover'));
  S.chats = savedChats; renderChatList();

  // ---- 5. luo ja hae viestit ----
  const chatsBefore = Object.keys(S.chats).length;
  GMLOG.length = 0;
  byId('dr-go').click();
  await waitFor(() => /\+3 keskustelua, \+4 viestiä/.test(txt(byId('toasts'))), 12000);
  T.ok('toast "+3 keskustelua, +4 viestiä"', /\+3 keskustelua, \+4 viestiä/.test(txt(byId('toasts'))), txt(byId('toasts')));
  const atsChat = Object.values(S.chats).find(c => c.name === 'Esimerkkikaupunki');
  T.ok('ATS chat created: name/company from display name, member = sender address, no job-board chat', !!atsChat && atsChat.company === 'Esimerkkikaupunki' && atsChat.members[0].emails[0] === 'noreply@kuntarekry.fi' && !Object.values(S.chats).some(c => (c.members || []).some(m => (m.emails || []).some(e => e.endsWith('@duunitori.fi')))), atsChat);
  const testi = Object.values(S.chats).find(c => c.name === 'Testi Oy'), firma = Object.values(S.chats).find(c => /^Firma|^Rekry/i.test(c.name) || (c.members || []).some(m => (m.emails || []).includes('noreply@rekry.firma.example.fi')));
  T.ok('chats created (name = company, status haettu, members with display names)', Object.keys(S.chats).length === chatsBefore + 3 && testi && testi.company === 'Testi Oy' && testi.status === 'haettu' && testi.members.length === 1 && testi.members[0].name === 'Sirpa Testaaja' && testi.members[0].emails[0] === 'sirpa@testioy.example.fi', testi);
  T.ok('ATS chat query is narrowed by company name', GMLOG.some(c => c.input.query && c.input.query.includes('(from:noreply@kuntarekry.fi "Esimerkkikaupunki")') && !c.input.query.includes('from:kuntarekry.fi')), GMLOG.map(c => (c.input.query || '').slice(0, 60)));
  T.ok('automation-only group: noreply used as member so it can be synced', !!firma && firma.members[0].emails[0] === 'noreply@rekry.firma.example.fi', firma);
  const tm = await S.store.listMessages(Object.keys(S.chats).find(id => S.chats[id].name === 'Testi Oy'));
  T.ok('messages imported through existing sync (gm- ids, stats)', tm.length === 2 && tm.every(m => m.id.startsWith('gm-')) && S.chats[Object.keys(S.chats).find(id => S.chats[id].name === 'Testi Oy')].stats.sent === 1, tm.map(m => m.id));
  T.ok('import used per-chat queries + get_thread; progress per chat', GMLOG.filter(c => c.tool === 'search_threads' && c.input.query.startsWith('(')).length === 4 && GMLOG.filter(c => c.tool === 'get_thread').length === 3, GMLOG.map(c => c.tool + ':' + (c.input.query || c.input.threadId).slice(0, 20)));
  T.ok('goes to chat list', S.view === 'chats' && sheetStack.length === 0 && !DISC.busy && !GM.busy);
  await sleepT(700);
  const raw = localStorage.getItem('hakuviestit.v1');
  T.ok('discovered content stored encrypted', !['Testi Oy', 'sirpa@testioy', 'Tervetuloa haastatteluun', 'Olemme vastaanottaneet hakemuksesi'].some(x => raw.includes(x)));
  // ---- 6. Tuo-näkymän sähköpostihaku ----
  document.querySelector('#tab-import').click(); await sleepT(50);
  T.ok('Tuo: mail card first, controls visible, na hidden, files collapsed', !!byId('imp-mail-card') && byId('imp-mail-go') && byId('imp-mail-controls').hidden === false && byId('imp-mail-na').hidden === true && !byId('imp-files').open && byId('imp-mail-period').value === '2y' && /Hae sähköpostista/.test(txt(byId('imp-mail-card'))));
  T.ok('Tuo: input prefilled with own email', byId('imp-mail').value === 'oma.esimerkki@gmail.com' || byId('imp-mail').value === (S.profile.identities.find(i => i.type === 'email') || {}).value, byId('imp-mail').value);
  GMLOG.length = 0;
  byId('imp-mail').value = 'ei-osoite'; byId('imp-mail-go').click(); await sleepT(100);
  T.ok('Tuo: invalid address shows #imp-mail-err, no Gmail call', byId('imp-mail-err').hidden === false && /ei näytä oikealta/.test(txt(byId('imp-mail-err'))) && GMLOG.length === 0, txt(byId('imp-mail-err')));
  ACC = 'uusi.haku@gmail.com';
  byId('imp-mail').value = 'Uusi.Haku@Gmail.com'; byId('imp-mail-period').value = '1y';
  byId('imp-mail').dispatchEvent({ type: 'keydown', key: 'Enter' });
  await waitFor(() => byId('dr-go'), 8000);
  T.ok('Tuo: valid new address saved as identity and discovery started with chosen period', S.profile.identities.some(i => i.type === 'email' && i.value === 'uusi.haku@gmail.com') && byId('imp-mail-err').hidden === true && GMLOG.some(c => c.input.query && c.input.query.includes('newer_than:1y')), GMLOG.map(c => c.input.query));

  // ---- 7. Mitään ei lähde tekoälylle: ei sample-capabilityä, ei Claude-tekstiä, luokittelu vain säännöillä ----
  {
    const topTxt = () => (sheetStack.length ? txt(sheetStack[sheetStack.length - 1].layer) : '');
    // aiemman testin tarkistusnäkymä voi olla vielä auki: suljetaan se
    for (let i = 0; i < 6; i++) { await sleepT(250); if (!sheetStack.length) break; sheetStack[sheetStack.length - 1].close(); }
    await waitFor(() => !DISC.busy && !GM.busy, 5000);
    T.ok('S.sample is undefined (no AI state)', S.sample === undefined && S.imgMax === undefined);
    T.ok('allowClaude / nameMask settings are gone', !('allowClaude' in settings()) && !('nameMask' in settings()));
    const tid = Object.keys(S.chats).find(id => S.chats[id].name === 'Testi Oy');
    await doWrites([{ t: 'update', path: 'chats/' + tid, data: { sensitive: true, updatedAt: nowIso() } }]); await sleepT(200);
    T.ok('Testi Oy chat marked sensitive', S.chats[tid].sensitive === true);
    ACC = 'uusi.haku@gmail.com';
    document.querySelector('#tab-import').click();
    byId('imp-mail').value = 'uusi.haku@gmail.com'; byId('imp-mail-period').value = '1y';
    byId('imp-mail').dispatchEvent({ type: 'keydown', key: 'Enter' });
    await waitFor(() => byId('dr-go'), 8000);
    T.ok('classification asks no confirmation about Claude; review opens', !/Claude/.test(topTxt()) && !!byId('dr-go'), topTxt().slice(0, 120));
    T.ok('review note says rules-based, never Claude', /sääntöpohjainen/.test(txt(byId('dr-note'))) && !/Claude/.test(txt(byId('dr-note'))), txt(byId('dr-note')));
    sheetStack[sheetStack.length - 1].close(); await sleepT(100);
    T.ok('Tuo view has no "Claude lukee" text and no AI import controls', !/Claude lukee/.test(txt(byId('v-import'))) && !byId('imp-ai-text') && !byId('imp-ai-go') && !byId('imp-ai-img'));
    T.ok('claude.use was never asked for "sample"', !USE_REQUESTED.includes('sample') && USE_REQUESTED.includes('mcp'), USE_REQUESTED);
  }
  T.done();
})().catch(e => { console.error(e); T.ok('driver exception', false, String(e && e.stack)); T.done(); });
