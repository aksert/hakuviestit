(async () => {
  const txt = el => el ? el.textContent : null;
  const byId = id => document.querySelector('#' + id);
  T.ok('setup shown on first start', await waitFor(() => byId('sec-setup-form')) && /Suojaa tietosi/.test(txt(document.querySelector('#lock'))), txt(document.querySelector('#lock')));
  T.ok('lock screen shows no chats before password', !/Valio|Kesko/.test(root.textContent));
  T.ok('short password rejected', (() => { byId('sec-pw1').value = 'lyhyt'; byId('sec-pw2').value = 'lyhyt'; byId('sec-setup-form').dispatchEvent({ type: 'submit' }); return S.locked && !byId('sec-err').hidden && /10 merkki/.test(txt(byId('sec-err'))); })());
  T.ok('mismatch rejected', (() => { byId('sec-pw1').value = PW; byId('sec-pw2').value = PW + 'x'; byId('sec-setup-form').dispatchEvent({ type: 'submit' }); return S.locked && /täsmää/.test(txt(byId('sec-err'))); })());
  byId('sec-pw1').value = 'Kx7#mQ2!vR9$tLw4'; byId('sec-pw1').dispatchEvent({ type: 'input' });
  T.ok('strength meter updates', /Vahva/.test(txt(byId('sec-meter-label'))) && /Jos unohdat salasanan, tietoja ei voi palauttaa kukaan/.test(txt(byId('sec-warn'))));
  T.ok('setup + examples visible', await doSetup());
  T.ok('local mode', S.mode === 'local');
  T.ok('banner shown (esikatselu)', !byId('banner').hidden && /Esikatselu/.test(txt(byId('banner'))), txt(byId('banner')));
  T.ok('5 chats', Object.keys(S.chats).length === 5, Object.keys(S.chats));
  T.ok('chat rows', document.querySelectorAll('.row').length === 5, document.querySelectorAll('.row').length);
  T.ok('example tags', document.querySelectorAll('.tag').length === 5);
  T.ok('kesko reminder', /Ei vastausta \d+ pv/.test(txt(byId('chat-ex-kesko'))), txt(byId('chat-ex-kesko')));
  T.ok('tabbar 4 tabs', document.querySelectorAll('.tab').length === 4);
  T.ok('fab visible in chats', byId('fabwrap').hidden === false);

  byId('f-hylatty').click();
  T.ok('filter hylatty', document.querySelectorAll('.row').length === 1);
  byId('f-all').click();
  const q = byId('q'); q.value = 'rekry@valio'; q.dispatchEvent({ type: 'input', target: q });
  T.ok('search by email', document.querySelectorAll('.row').length === 1 && document.querySelectorAll('.row')[0].id === 'chat-ex-valio');
  q.value = '040'; q.dispatchEvent({ type: 'input', target: q });
  q.value = ''; q.dispatchEvent({ type: 'input', target: q });

  const prevSvgs = document.querySelectorAll('.row-prev').flatMap(p => p.querySelectorAll('svg')); T.ok('list preview icons non-empty', prevSvgs.length >= 10 && prevSvgs.every(v => v.children.length > 0), prevSvgs.length);
  T.ok('example tag in preview row', document.querySelectorAll('.row-prev').flatMap(p => p.querySelectorAll('.tag')).length === 5);
  byId('chat-ex-valio').click();
  await sleepT(100);
  T.ok('chat view open', S.view === 'chat' && !byId('v-chat').hidden);
  T.ok('tabbar hidden in chat', byId('tabbar').hidden);
  T.ok('11 bubbles', document.querySelectorAll('.bubble').length === 11, document.querySelectorAll('.bubble').length);
  T.ok('every channel has non-empty icon', CHANNELS.every(ch => ico(ch).children.length > 0), CHANNELS.filter(ch => ico(ch).children.length === 0));
  T.ok('chIcon non-empty for all', CHANNELS.every(ch => chIcon(ch, 16).children.length > 0));
  T.ok('bubble meta icons non-empty', document.querySelectorAll('.bmeta').length === 11 && document.querySelectorAll('.bmeta').every(m => m.children[0].tagName === 'SVG' && m.children[0].children.length > 0));
  T.ok('composer channel icons non-empty', ['email','sms','whatsapp','call','meeting'].every(k => byId('c-ch-' + k).children[0].children.length > 0));
  T.ok('no expand button on short messages', document.querySelectorAll('.bexp').every(b => b.hidden === true));
  T.ok('example tag not in name row', document.querySelectorAll('.row-name').flatMap(p => p.querySelectorAll('.tag')).length === 0);
  T.ok('day separators', document.querySelectorAll('.day').length >= 5);
  T.ok('head sub', /^2 henkil.. . Haastattelu$/.test(txt(byId('ch-sub'))), txt(byId('ch-sub')));
  const ta = byId('c-body'); ta.value = 'Testiviesti kirjattu';
  byId('c-ch-whatsapp').click();
  byId('c-form').dispatchEvent({ type: 'submit' });
  await sleepT(300);
  T.ok('12 bubbles', document.querySelectorAll('.bubble').length === 12, document.querySelectorAll('.bubble').length);
  T.ok('stats sent=6', S.chats['ex-valio'].stats.sent === 6 && S.chats['ex-valio'].stats.lastPreview.startsWith('Testiviesti'), S.chats['ex-valio'].stats);
  byId('c-ch-email').click(); byId('c-dir-in').click(); byId('c-more-btn').click();
  byId('c-subject').value = 'Aihe X'; ta.value = 'Saatu mail';
  byId('c-form').dispatchEvent({ type: 'submit' });
  await sleepT(300);
  T.ok('13 bubbles', document.querySelectorAll('.bubble').length === 13);
  const bm = document.querySelectorAll('.bmore'); bm[bm.length - 1].click();
  T.ok('msg sheet open', sheetStack.length === 1);
  const acts = document.querySelectorAll('.act'); acts[2].click();
  await sleepT(50);
  byId('cf-ok').click();
  await sleepT(300);
  T.ok('13->12 after delete', document.querySelectorAll('.bubble').length === 12, document.querySelectorAll('.bubble').length);
  document.querySelectorAll('.bmore')[0].click();
  document.querySelectorAll('.act')[1].click();
  await sleepT(50);
  T.ok('move sheet lists 4 chats', document.querySelectorAll('.act').length === 4, document.querySelectorAll('.act').length);
  sheetStack[sheetStack.length - 1].close();
  byId('ch-who').click();
  T.ok('info sheet', sheetStack.length === 1 && !!byId('ci-name'));
  T.ok('2 members rendered', document.querySelectorAll('.mem').length === 2);
  const st = byId('ci-status'); st.value = 'tarjous'; st.dispatchEvent({ type: 'change' });
  await sleepT(100);
  T.ok('status saved', S.chats['ex-valio'].status === 'tarjous');
  st.value = 'haastattelu'; st.dispatchEvent({ type: 'change' }); await sleepT(50);
  byId('ci-addp').click();
  byId('mem-f-name').value = 'Uusi Henkilo'; byId('mem-f-email-0').value = 'Uusi@Valio.example.fi'; byId('mem-f-phone-0').value = '050 999 8877';
  byId('mem-form').dispatchEvent({ type: 'submit' });
  await sleepT(200);
  T.ok('member added', S.chats['ex-valio'].members.length === 3 && S.chats['ex-valio'].members[2].phones[0] === '+358509998877' && S.chats['ex-valio'].members[2].emails[0] === 'uusi@valio.example.fi', S.chats['ex-valio'].members[2]);
  byId('ci-addp').click();
  byId('mem-f-email-0').value = 'virhe'; byId('mem-form').dispatchEvent({ type: 'submit' }); await sleepT(50);
  T.ok('invalid email error shown', document.querySelectorAll('.err').some(e => !e.hidden && /nimi@yritys\.fi/.test(txt(e))), document.querySelectorAll('.err').map(e => [e.hidden, txt(e)]));
  while (sheetStack.length) sheetStack[sheetStack.length - 1].close();
  byId('ch-back').click();
  T.ok('back to chats', S.view === 'chats');

  byId('fab').click();
  byId('nc-name').value = 'Testi Oy - tehtava'; byId('nc-p-name').value = 'Teppo'; byId('nc-p-email-0').value = 'teppo@testi.example.fi';
  byId('nc-form').dispatchEvent({ type: 'submit' });
  await sleepT(300);
  T.ok('new chat created+opened', S.view === 'chat' && Object.keys(S.chats).length === 6 && S.chats[S.openId].company === 'Testi', S.openId);
  T.ok('empty chat msg', /Kirjaa ensimm.inen viesti alla/.test(txt(byId('msgs'))), txt(byId('msgs')));
  byId('ch-back').click();

  document.querySelector('#tab-summary').click();
  await sleepT(300);
  T.ok('summary stats', txt(byId('st-active')) === '5' && /^\d+$/.test(txt(byId('st-sent30'))), [txt(byId('st-active')), txt(byId('st-sent30'))]);
  T.ok('chart bars', document.querySelectorAll('.bar').length === 12, document.querySelectorAll('.bar').length);
  document.querySelectorAll('.bar')[11].click();
  T.ok('tip text', /vk \d+/.test(txt(byId('chart-tip'))), txt(byId('chart-tip')));
  T.ok('summary rows', document.querySelectorAll('.sum-row').length === 6);
  byId('sort-name').click();
  T.ok('sort name rows', document.querySelectorAll('.sum-row').length === 6);

  document.querySelector('#tab-accounts').click();
  T.ok('identities listed', document.querySelectorAll('.id-row').length === 2);
  T.ok('example remove visible', byId('acc-example').hidden === false);
  byId('acc-value').value = 'ei-sahkoposti@'; byId('acc-form').dispatchEvent({ type: 'submit' }); await sleepT(50);
  T.ok('identity validation', document.querySelectorAll('.err').some(e => !e.hidden && /nimi@yritys\.fi/.test(txt(e))), document.querySelectorAll('.err').map(e => [e.hidden, txt(e)]));
  byId('acc-type').value = 'phone'; byId('acc-value').value = '050 111 2222'; byId('acc-form').dispatchEvent({ type: 'submit' }); await sleepT(100);
  T.ok('identity added', S.profile.identities.length === 3 && S.profile.identities[2].value === '+358501112222', S.profile);
  T.ok('download hidden (no capability)', byId('acc-download').hidden === true);

  document.querySelector('#tab-import').click();
  T.ok('styled file fields', ['imp-eml','imp-wa'].every(id => byId(id).classList.contains('sr-file') && byId(id).closest('.filebtn') && /Ei valittua tiedostoa/.test(txt(byId(id).closest('.filebtn')))) && /Valitse tiedostot/.test(txt(byId('imp-eml').closest('.filebtn'))));
  T.ok('no AI import card', !byId('imp-ai-go') && !imp.ui.aiCard && !imp.ui.saCard);
  const waText = '25.10.2026 klo 14.03 - Maija Testaaja: Hei Eero!\n25.10.2026 klo 14.04 - Eero: Moi!\nJatkuu\n25.10.2026 klo 14.05 - Maija Testaaja: Kiitos';
  const p = startWa(new File([waText], 'wa.txt'));
  await sleepT(100);
  byId('wa-me-1').click();
  await p;
  T.ok('review ui', !!byId('imp-groups') && /Löytyi 3 viestiä, 1 henkilöä/.test(txt(byId('imp-found'))) || /3 viesti.*1 henkil/.test(txt(byId('imp-found'))), txt(byId('imp-found')));
  const sel = byId('imp-sel-0'); sel.value = 'new'; sel.dispatchEvent({ type: 'change', target: sel });
  T.ok('tmp chat created', S.imp.tmp.length === 1 && byId('imp-go').textContent === 'Tuo 3 viestiä', byId('imp-go').textContent);
  byId('imp-ph-0').value = '045 555 6677'; byId('imp-ph-0').dispatchEvent({ type: 'input', target: byId('imp-ph-0') });
  await executeImport();
  await sleepT(200);
  T.ok('import result', /Tuotiin 3 viestiä 1 keskusteluun/.test(txt(byId('imp-result'))) || /Tuotiin 3 viesti. 1 keskusteluun/.test(txt(byId('imp-result'))), txt(byId('imp-result')));
  const nc = Object.keys(S.chats).map(id => ({ id, c: S.chats[id] })).find(x => x.c.name === 'Maija Testaaja');
  T.ok('new chat from import', !!nc && nc.c.stats.sent === 1 && nc.c.stats.received === 2 && nc.c.members[0].phones[0] === '+358455556677', nc && nc.c);
  byId('imp-again').click();

  const mb = [
    'From a@b Mon Oct 12 10:05:00 +0000 2026', 'From: Heli Ranta <rekry@valio.example.fi>', 'To: oma.esimerkki@gmail.com', 'Subject: Mbox yksi', 'Date: Mon, 12 Oct 2026 10:05:00 +0300', 'Message-ID: <m1@x>', 'Content-Type: text/plain; charset=utf-8', '', 'Eka mbox-viesti', '',
    'From a@b Tue Oct 13 10:05:00 +0000 2026', 'From: Tuntematon <tuntematon@firma.example.fi>', 'To: oma.esimerkki@gmail.com', 'Subject: Mbox kaksi', 'Date: Tue, 13 Oct 2026 10:05:00 +0300', 'Message-ID: <m2@x>', '', 'Toinen',
    '', 'From a@b Wed Oct 14 10:05:00 +0000 2026', 'From: oma.esimerkki@gmail.com', 'To: Heli <rekry@valio.example.fi>', 'Subject: Vastaus', 'Date: Wed, 14 Oct 2026 10:05:00 +0300', 'Message-ID: <m3@x>', '', 'Oma vastaus'
  ].join('\n');
  const before = S.chats['ex-valio'].stats.received;
  await startEml([new File([mb], 'x.mbox')]);
  T.ok('mbox review 2 groups', S.imp && S.imp.groups.length === 2 && S.imp.groups[0].known === 'ex-valio', S.imp && S.imp.groups.map(g => [g.key, g.known, g.count]));
  T.ok('known autoselected', S.imp.groups[0].choice === 'chat:ex-valio' && S.imp.groups[1].choice === 'skip');
  byId('imp-keep').checked = true; byId('imp-keep').dispatchEvent({ type: 'change', target: byId('imp-keep') });
  T.ok('count with keep = 3', byId('imp-go').textContent === 'Tuo 3 viestiä', byId('imp-go').textContent);
  await executeImport(); await sleepT(300);
  T.ok('mbox result', /Tuotiin 2 viesti. 1 keskusteluun/.test(txt(byId('imp-result'))), txt(byId('imp-result')));
  T.ok('unsorted has 1', S.unsorted.length === 1 && S.unsorted[0].suggestedName === 'Tuntematon', S.unsorted);
  T.ok('valio stats updated', S.chats['ex-valio'].stats.received === before + 1, [before, S.chats['ex-valio'].stats.received]);
  const cnt = (await S.store.listMessages('ex-valio')).length;
  await startEml([new File([mb], 'x.mbox')]); await executeImport(); await sleepT(300);
  T.ok('reimport no dup', (await S.store.listMessages('ex-valio')).length === cnt, [cnt, (await S.store.listMessages('ex-valio')).length]);
  byId('imp-again').click();

  document.querySelector('#tab-chats').click();
  T.ok('unsorted row visible', !!byId('open-unsorted') && /\(1\)/.test(txt(byId('open-unsorted'))), txt(byId('open-unsorted')));
  byId('open-unsorted').click();
  T.ok('unsorted group', document.querySelectorAll('.grp').length === 1);
  byId('uns-new-0').click();
  await sleepT(400);
  T.ok('new chat from unsorted + opened', S.view === 'chat' && S.chats[S.openId].name === 'Tuntematon' && S.unsorted.length === 0, S.view);
  byId('ch-back').click();

  document.querySelector('#tab-accounts').click();
  byId('acc-example').click(); await sleepT(50);
  byId('cf-ok').click(); await sleepT(500);
  T.ok('examples removed', Object.values(S.chats).every(c => !c.example) && byId('acc-example').hidden === true, Object.keys(S.chats));
  T.ok('example identities removed', S.profile.identities.every(i => !i.example) && S.profile.identities.length === 1, S.profile.identities);

  let saved = null;
  S.downloads = { save: async r => { saved = r; return { status: 'saved' }; } };
  await exportBackup();
  const bk = JSON.parse(saved.data);
  const MYNAMES = ['Maija Testaaja', 'Testi Oy', 'Tuntematon', 'Teppo', 'oma.esimerkki', '+358501112222', 'Eero'];
  T.ok('backup is encrypted file', saved.filename.endsWith('.json') && bk.encrypted === true && bk.enc && bk.enc.iv && bk.enc.ct && bk.crypto.kdf === 'PBKDF2-SHA256' && bk.crypto.iter === 600000 && !bk.chats, Object.keys(bk));
  T.ok('backup has no plaintext names', !MYNAMES.some(n => saved.data.includes(n)), MYNAMES.filter(n => saved.data.includes(n)));
  const n0 = Object.keys(S.chats).length;
  const chatNames = Object.values(S.chats).map(c => c.name);
  T.ok('chats exist before delete', n0 >= 3 && chatNames.some(n => n.includes('Maija')), chatNames);
  for (const id of Object.keys(S.chats)) await deleteChats([id]);
  await sleepT(100);
  T.ok('all deleted', Object.keys(S.chats).length === 0);
  T.ok('empty state', !!byId('empty-add'));
  // plaintext-varmuuskopio hylätään
  let pr = restoreBackup(new File([JSON.stringify({ app: 'hakuviestit', version: 1, chats: [] })], 'old.json')); await pr;
  T.ok('plaintext backup rejected', Object.keys(S.chats).length === 0);
  // väärä salasana
  pr = restoreBackup(new File([saved.data], 'b.json'));
  await waitFor(() => byId('ask-form')); byId('ask-pw').value = 'vaara-salasana-9'; byId('ask-form').dispatchEvent({ type: 'submit' }); await pr;
  T.ok('restore needs correct password', Object.keys(S.chats).length === 0);
  pr = restoreBackup(new File([saved.data], 'b.json'));
  await waitFor(() => byId('ask-form')); byId('ask-pw').value = PW; byId('ask-form').dispatchEvent({ type: 'submit' });
  await waitFor(() => byId('cf-ok')); byId('cf-ok').click(); await pr; await sleepT(400);
  T.ok('restored', Object.keys(S.chats).length === n0, Object.keys(S.chats).length);

  // --- tallennus: ei selväkieltä ---
  await sleepT(700);
  const rawLS = localStorage.getItem('hakuviestit.v1');
  T.ok('localStorage written', !!rawLS);
  // Salatekstikentät (base64) pois ennen hakua: lyhyet sanat kuten "Moi" osuvat satunnaisesti base64-merkkijonoon
  const lsScan = rawLS.replace(/"(ct|iv|salt|check)":"[A-Za-z0-9+/=_-]*"/g, '""');
  const plainHits = MYNAMES.concat(['Valio', 'Kesko', 'Heli', 'Hei Eero', 'Moi']).filter(n => lsScan.includes(n));
  T.ok('localStorage has no plaintext', plainHits.length === 0 && /"ct":/.test(rawLS), plainHits);
  const parsedLS = JSON.parse(rawLS);
  const allDocs = [parsedLS.M.profile, parsedLS.M.crypto, ...Object.values(parsedLS.M.chats), ...Object.values(parsedLS.M.msgs).flatMap(o => Object.values(o))];
  T.ok('all stored docs encrypted (except meta/crypto)', allDocs.filter(d => d && d !== parsedLS.M.crypto).every(d => d.enc && d.enc.iv && d.enc.ct && d.v === 1));
  T.ok('meta/crypto fields', parsedLS.M.crypto.v === 1 && parsedLS.M.crypto.kdf === 'PBKDF2-SHA256' && parsedLS.M.crypto.iter === 600000 && parsedLS.M.crypto.salt && parsedLS.M.crypto.check.ct);
  T.ok('password never stored', !rawLS.includes(PW) && !String(localStorage.getItem('hv-fails')).includes(PW));

  // --- asetukset: esikatselun piilotus ---
  document.querySelector('#tab-accounts').click();
  T.ok('privacy section shown', !!byId('sec-privacy') && /Salaus: päällä/.test(txt(byId('sec-status'))) && /Automaattinen lukitus: 2 min/.test(txt(byId('sec-status'))), txt(byId('sec-status')));
  byId('sec-hideprev').checked = true; byId('sec-hideprev').dispatchEvent({ type: 'change', target: byId('sec-hideprev') }); await sleepT(300);
  document.querySelector('#tab-chats').click(); await sleepT(100);
  T.ok('hide preview: only name and date', S.profile.settings.hidePreview === true && document.querySelectorAll('.row').length >= 3 && document.querySelectorAll('.row-prev').length === 0 && byId('chat-list').querySelectorAll('.pill').length === 0, [S.profile.settings, document.querySelectorAll('.row').length, document.querySelectorAll('.row-prev').length, document.querySelectorAll('.pill').length]);
  document.querySelector('#tab-accounts').click();
  byId('sec-hideprev').checked = false; byId('sec-hideprev').dispatchEvent({ type: 'change', target: byId('sec-hideprev') }); await sleepT(300);
  document.querySelector('#tab-chats').click(); await sleepT(100);
  T.ok('preview back', document.querySelectorAll('.row-prev').length >= 3);

  // --- Nimisuoja, laitteen tila, arkaluonteinen keskustelu ---
  {
    const IOS_OLD = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1';
    const AND_RED = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
    document.querySelector('#tab-accounts').click(); await sleepT(50);
    // Claude- ja Nimisuoja-asetukset on poistettu
    T.ok('no Claude / Nimisuoja controls or settings', !byId('sec-claude') && !byId('sec-namemask') && !('allowClaude' in settings()) && !('nameMask' in settings()) && !/Claude|Nimisuoja/.test(txt(byId('sec-status'))), txt(byId('sec-status')));
    // Rehellinen tietosuojateksti
    { const pt = txt(byId('sec-privacy'));
      T.ok('privacy copy: old false claim gone, honest lines present', !/Claude tai claude\.ai ei näe sisältöä/.test(pt) && /Tiedot salataan laitteellasi ennen tallennusta/.test(pt)
        && pt.includes('Gmail-haku kulkee claude.ai:n Gmail-yhdistäjän kautta: haetut viestit kulkevat sen läpi, mutta ne tallennetaan vain salattuina.')
        && pt.includes('Mitään ei lähetetä Claudelle tai tekoälylle. Tiedot näkyvät vain sinulle.') && !/Nimisuoja|Salli Clauden/.test(pt)
        && pt.includes('Jaettu linkki ei näytä tietojasi muille: tiedot ovat vain sinun tililläsi ja salattuja.')); }
    // Laitteen tila
    { const kids = [...byId('sec-privacy').children], iDev = kids.findIndex(c => c.id === 'sec-device'), iTips = kids.findIndex(c => c.id === 'sec-tips');
      T.ok('device card #sec-device "Laitteen tila" sits right above the tips card', iDev > 0 && iTips === iDev + 1 && /Laitteen tila/.test(txt(byId('sec-device'))), [iDev, iTips]); }
    S.devInfo = detectDeviceInfo({ ua: IOS_OLD }); DEVB.dismissed = false; renderPrivacy();
    T.ok('device card: old iOS -> update line + note + checked month', /iOS 18\.3 – päivitys suositeltu \(vähintään 18\.7\.12\)\. Asetukset → Yleiset → Ohjelmistopäivitys\./.test(txt(byId('sec-device'))) && /Sovellus ei voi asentaa päivityksiä itse/.test(txt(byId('sec-device'))) && /tarkistettu 2026-11/.test(txt(byId('sec-device'))) && byId('dev-level').className.includes('l-update'), txt(byId('sec-device')));
    document.querySelector('#tab-chats').click(); await sleepT(50);
    T.ok('banner #dev-update-banner on the chat list when update recommended', !!byId('dev-update-banner') && /päivitys suositeltu/.test(txt(byId('dev-update-banner'))) && byId('v-chats').querySelector('#dev-update-banner') !== null);
    byId('dev-banner-close').click();
    T.ok('banner dismissed', !byId('dev-update-banner'));
    renderChatList(); renderDevice(); document.querySelector('#tab-accounts').click(); renderPrivacy(); document.querySelector('#tab-chats').click();
    T.ok('banner stays dismissed for the session (once per session)', !byId('dev-update-banner') && DEVB.dismissed === true);
    S.devInfo = detectDeviceInfo({ ua: AND_RED }); renderPrivacy();
    T.ok('device card: reduced Android UA -> unknown text + Play note, no banner', /Versiota ei voitu tunnistaa\. Tarkista päivitykset puhelimen asetuksista\./.test(txt(byId('sec-device'))) && /Google Play -järjestelmäpäivitys/.test(txt(byId('sec-device'))) && !byId('dev-update-banner'));
    S.devInfo = detectDeviceInfo({ ua: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36' }); renderPrivacy();
    T.ok('device card: Android 15 + Chrome 155 -> ok lines', /Android 15 – ajan tasalla\./.test(txt(byId('sec-device'))) && /Selain Chrome 155 – ajan tasalla\./.test(txt(byId('sec-device'))) && byId('dev-level').className.includes('l-ok'));
    S.devInfo = null; renderPrivacy();

    // Arkaluonteinen keskustelu
    const mdoc = toMsgDoc({ at: nowIso(), dir: 'in', channel: 'email', from: 'tiina@paivakoti.example.fi', fromName: 'Tiina Korhonen', to: ['oma@example.fi'], subject: 'Päiväkodin ilmoitus', body: 'Aino oli kipeänä tänään, ei tule huomenna.' });
    await doWrites([{ t: 'set', path: 'chats/sens1', data: { name: 'Aino Virtanen', company: '', status: 'haettu', notes: '', color: 'av2', members: [{ id: 'sm1', name: 'Tiina Korhonen', role: 'Opettaja', emails: ['tiina@paivakoti.example.fi'], phones: ['+358409998877'] }], createdAt: nowIso(), updatedAt: nowIso(), stats: computeStats([]) } },
      { t: 'set', path: 'chats/sens1/messages/mS1', data: mdoc }]);
    await sleepT(300); await doWrites([statsOp('sens1', [Object.assign({ id: 'mS1' }, mdoc)], [])]); await sleepT(400);
    T.ok('plain chat row shows preview and no shield', byId('chat-sens1').querySelectorAll('.row-prev').length === 1 && byId('chat-sens1').querySelectorAll('.shield').length === 0 && /Aino Virtanen/.test(txt(byId('chat-sens1'))) && /Päiväkodin ilmoitus/.test(txt(byId('chat-sens1'))), txt(byId('chat-sens1')));
    openChat('sens1'); await sleepT(100);
    byId('ch-who').click(); await sleepT(50);
    T.ok('info sheet: #chat-sensitive toggle with label, off by default', !!byId('chat-sensitive') && byId('chat-sensitive').checked === false && /Arkaluonteinen keskustelu \(esim\. päiväkoti, terveys\)/.test(txt(sheetStack[sheetStack.length - 1].layer)));
    byId('chat-sensitive').checked = true; byId('chat-sensitive').dispatchEvent({ type: 'change', target: byId('chat-sensitive') }); await sleepT(300);
    T.ok('toggle saved on the chat doc (sensitive: true), shield in the chat head, title still the chosen name', S.chats.sens1.sensitive === true && byId('ch-shield').hidden === false && byId('ch-shield').getAttribute('aria-label') === 'Arkaluonteinen' && txt(byId('ch-name')) === 'Aino Virtanen');
    sheetStack[sheetStack.length - 1].close(); await sleepT(50);
    // kopiointi vahvistetaan
    document.querySelectorAll('.bmore')[0].click(); document.querySelectorAll('.act')[0].click();
    T.ok('copy in sensitive chat asks confirmation text', await waitFor(() => byId('cf-ok'), 2000) && /Kopioidaanko arkaluonteinen viesti leikepöydälle\?/.test(txt(sheetStack[sheetStack.length - 1].layer)));
    byId('cf-cancel').click(); await sleepT(100);
    T.ok('copy cancelled: nothing copied (no fallback sheet)', !byId('cp-text') && sheetStack.length === 0);
    document.querySelectorAll('.bmore')[0].click(); document.querySelectorAll('.act')[0].click(); await waitFor(() => byId('cf-ok'), 2000); byId('cf-ok').click();
    T.ok('copy confirmed: copying proceeds (clipboard missing here -> fallback sheet)', await waitFor(() => byId('cp-text'), 2000));
    sheetStack[sheetStack.length - 1].close(); await sleepT(50);
    // listat: nimikirjaimet, ei esikatselua
    closeChat('chats'); await sleepT(100);
    { const row = byId('chat-sens1');
      T.ok('list row: initials instead of person name, no preview (global preview setting is on), shield badge', /A\. V\./.test(txt(row)) && !/Aino|Virtanen/.test(txt(row)) && !/Päiväkodin|kipeänä|tiina@/.test(txt(row)) && row.querySelectorAll('.row-prev').length === 0 && row.querySelectorAll('[aria-label="Arkaluonteinen"]').length === 1 && settings().hidePreview === false, txt(row)); }
    T.ok('other rows keep their previews', document.querySelectorAll('.row-prev').length >= 3);
    document.querySelector('#tab-summary').click(); await sleepT(100);
    T.ok('summary row: initials, shield, no full name', /A\. V\./.test(txt(byId('sum-sens1'))) && !/Aino|Virtanen/.test(txt(byId('sum-sens1'))) && byId('sum-sens1').querySelectorAll('[aria-label="Arkaluonteinen"]').length === 1, txt(byId('sum-sens1')));
    document.querySelector('#tab-chats').click(); await sleepT(50);
    // vienti: arkaluonteiset oletuksena pois, mukaan vain salasanalla
    let sv = null; S.downloads = { save: async r => { sv = r; return { status: 'saved' }; } };
    const nChats = Object.keys(S.chats).length;
    let ex = exportBackup(); await waitFor(() => byId('exp-go'), 3000);
    T.ok('export: sheet with checkbox "Sisällytä arkaluonteiset keskustelut", unchecked', !!byId('exp-sens') && byId('exp-sens').checked === false && /Sisällytä arkaluonteiset keskustelut/.test(txt(sheetStack[sheetStack.length - 1].layer)));
    byId('exp-go').click(); await ex;
    { const o = await decObj(SEC.key, JSON.parse(sv.data).enc, 'backup');
      T.ok('export default: sensitive chat excluded (no id, no name, no message text)', o.chats.length === nChats - 1 && !o.chats.some(c => c.id === 'sens1') && !JSON.stringify(o).includes('Aino Virtanen') && !JSON.stringify(o).includes('kipeänä'), o.chats.map(c => c.id)); }
    sv = null; ex = exportBackup(); await waitFor(() => byId('exp-go'), 3000); byId('exp-sens').checked = true; byId('exp-go').click();
    T.ok('export with sensitive: asks for the password', await waitFor(() => byId('ask-form'), 3000) && /Arkaluonteisten keskustelujen vienti vaatii salasanan/.test(txt(sheetStack[sheetStack.length - 1].layer)) && sv === null);
    byId('ask-pw').value = 'vaara-salasana-9'; byId('ask-form').dispatchEvent({ type: 'submit' }); await ex;
    T.ok('export with wrong password: nothing saved, error toast', sv === null && /Salasana ei kelpaa/.test(txt(byId('toasts'))));
    sv = null; ex = exportBackup(); await waitFor(() => byId('exp-go'), 3000); byId('exp-sens').checked = true; byId('exp-go').click();
    await waitFor(() => byId('ask-form'), 3000); byId('ask-pw').value = PW; byId('ask-form').dispatchEvent({ type: 'submit' }); await ex;
    { const o = await decObj(SEC.key, JSON.parse(sv.data).enc, 'backup'); const sc = o.chats.find(c => c.id === 'sens1');
      T.ok('export with correct password: sensitive chat included (flag + message kept), file still encrypted', o.chats.length === nChats && !!sc && sc.data.sensitive === true && sc.messages.length === 1 && !sv.data.includes('Aino Virtanen') && !sv.data.includes('kipeänä')); }
    sv = null; ex = exportBackup(); await waitFor(() => byId('exp-cancel'), 3000); byId('exp-cancel').click(); await ex;
    T.ok('export cancel: nothing saved', sv === null);
    // stored encrypted: no plaintext flag/name
    await sleepT(700);
    { const raw = localStorage.getItem('hakuviestit.v1');
      T.ok('stored data: sensitive flag and names only inside encrypted docs', !raw.includes('sensitive') && !raw.includes('Aino Virtanen') && !raw.includes('paivakoti') && !raw.includes('kipeänä')); }
    // asetus pois -> rivi palaa normaaliksi
    openChat('sens1'); await sleepT(50); byId('ch-who').click(); await sleepT(50);
    byId('chat-sensitive').checked = false; byId('chat-sensitive').dispatchEvent({ type: 'change', target: byId('chat-sensitive') }); await sleepT(300);
    sheetStack[sheetStack.length - 1].close(); closeChat('chats'); await sleepT(100);
    T.ok('turning it off restores the normal row', S.chats.sens1.sensitive === false && /Aino Virtanen/.test(txt(byId('chat-sens1'))) && byId('chat-sens1').querySelectorAll('.row-prev').length === 1 && byId('ch-shield').hidden === true);
    S.downloads = null;
    await deleteChats(['sens1']); await sleepT(150);
    T.ok('sensitive test chat cleaned up', !S.chats.sens1);
  }

  // --- Tuo-näkymä: ei tekoälyä ---
  document.querySelector('#tab-import').click(); updateImportCaps();
  T.ok('no mcp: mail card visible with hint #imp-mail-na (Yhdistä Gmail), controls hidden, files open', !!byId('imp-mail-card') && byId('imp-mail-na').hidden === false && /Yhdistä Gmail claude.ai:n asetuksissa/.test(txt(byId('imp-mail-na'))) && byId('imp-mail-controls').hidden === true && byId('imp-files').open === true);
  T.ok('Tuo view: no "Claude lukee" text, no AI import controls', !/Claude lukee/.test(txt(byId('v-import'))) && !/Lue Claude-avulla/.test(txt(byId('v-import'))) && !byId('imp-ai-text') && !byId('imp-ai-go') && !byId('imp-ai-img') && !byId('imp-ai-sensitive') && S.sample === undefined);
  document.querySelector('#tab-accounts').click();
  T.ok('Tietosuoja card says nothing is sent to Claude', /Mitään ei lähetetä Claudelle/.test(txt(byId('sec-privacy'))));

  // --- lukitus ---
  document.querySelector('#tab-chats').click();
  const names = Object.values(S.chats).map(c => c.name);
  byId('lockfab').click(); await sleepT(100);
  T.ok('locked: key and data wiped', S.locked && SEC.key === null && SEC.wstore === null && S.store === null && S.profile === null && Object.keys(S.chats).length === 0 && S.unsorted.length === 0 && S.messages.length === 0 && S.openId === null);
  const bodyText = root.textContent;
  T.ok('locked: no names or counts in DOM', !names.some(n => bodyText.includes(n)) && !/Maija|Testi Oy|Tuntematon|oma\.esimerkki/.test(bodyText) && document.querySelectorAll('.row').length === 0 && document.querySelectorAll('.bubble').length === 0 && byId('app').hidden === true, bodyText.slice(0, 200));
  T.ok('locked: only lock form', !!byId('lock-form') && /Hakuviestit on lukittu/.test(bodyText) && sheetStack.length === 0);
  // väärät salasanat -> odotus
  T.ok('wrong password rejected generically', !(await doUnlock('vaarin-1234567')) && /Salasana ei kelpaa/.test(txt(byId('lock-err'))) && S.locked, txt(byId('lock-err')));
  for (let k = 0; k < 3; k++) await doUnlock('vaarin-1234567' + k);
  T.ok('4 failures: no lockout yet', localStorage.getItem('hv-until') === null && localStorage.getItem('hv-fails') === '4');
  await doUnlock('vaarin-12345675');
  T.ok('5th failure: wait begins (30 s)', localStorage.getItem('hv-fails') === '5' && +localStorage.getItem('hv-until') - Date.now() > 15000 && +localStorage.getItem('hv-until') - Date.now() <= 30500 && /Yritä uudelleen 00:\d\d kuluttua/.test(txt(byId('unlock-wait'))) && byId('lock-go').disabled === true, [localStorage.getItem('hv-until'), txt(byId('unlock-wait'))]);
  T.ok('correct password refused during wait', !(await doUnlock(PW)) && S.locked);
  FAIL.n = 6; FAIL.until = Date.now() + 61000; localStorage.setItem('hv-fails', '6'); localStorage.setItem('hv-until', String(FAIL.until));
  showUnlock(); T.ok('6th: wait 60 s shown', /Yritä uudelleen 01:0[01] kuluttua/.test(txt(byId('unlock-wait'))), txt(byId('unlock-wait')));
  localStorage.removeItem('hv-until'); FAIL.until = 0;
  T.ok('unlock with right password restores data', await doUnlock(PW) && Object.keys(S.chats).length === n0 && S.profile.settings.hidePreview === false && localStorage.getItem('hv-fails') === null);

  // --- salasanan vaihto ---
  document.querySelector('#tab-accounts').click(); byId('sec-change').click();
  byId('cp-old').value = 'vaara-vanha-1234'; byId('cp-new1').value = 'Uusi-salasana-77'; byId('cp-new2').value = 'Uusi-salasana-77'; byId('cp-form').dispatchEvent({ type: 'submit' });
  await waitFor(() => !byId('cp-err').hidden, 5000);
  T.ok('change pw: wrong old rejected', /Vanha salasana ei kelpaa/.test(txt(byId('cp-err'))));
  byId('cp-old').value = PW; byId('cp-new1').value = 'lyhyt'; byId('cp-new2').value = 'lyhyt'; byId('cp-form').dispatchEvent({ type: 'submit' }); await sleepT(100);
  T.ok('change pw: short new rejected', /vähintään 10/.test(txt(byId('cp-err'))));
  byId('cp-new1').value = 'Uusi-salasana-77'; byId('cp-new2').value = 'Uusi-salasana-77'; byId('cp-form').dispatchEvent({ type: 'submit' });
  await waitFor(() => /Salasana vaihdettu/.test(txt(byId('toasts'))), 15000); await sleepT(700);
  T.ok('change pw: data intact after rotation', Object.keys(S.chats).length === n0 && !S.locked);
  const meta2 = JSON.parse(localStorage.getItem('hakuviestit.v1')).M.crypto;
  T.ok('change pw: new salt, no next marker', !meta2.next && meta2.salt !== parsedLS.M.crypto.salt);
  byId('lockfab').click(); await sleepT(100);
  T.ok('old password no longer works', !(await doUnlock(PW)));
  lsDel('hv-fails'); lsDel('hv-until'); FAIL.n = 0; FAIL.until = 0; showUnlock();
  T.ok('new password works, data readable', await doUnlock('Uusi-salasana-77') && Object.keys(S.chats).length === n0 && Object.values(S.chats).some(c => c.name.includes('Maija')));

  // --- automaattinen lukitus ---
  document.querySelector('#tab-accounts').click();
  byId('sec-lockmin').value = '1'; byId('sec-lockmin').dispatchEvent({ type: 'change', target: byId('sec-lockmin') }); await sleepT(300);
  T.ok('lock minutes saved (1/2/5/15 options)', S.profile.settings.lockMin === 1 && byId('sec-lockmin').querySelectorAll('option').map(o => o.value).join() === '1,2,5,15');
  const realNow = Date.now;
  Date.now = () => realNow() + 90 * 1000;
  await waitFor(() => S.locked, 7500);
  T.ok('auto-lock after inactivity', S.locked === true && byId('lock-form') && SEC.key === null);
  Date.now = realNow;
  T.ok('unlock again', await doUnlock('Uusi-salasana-77'));
  document.hidden = true; document.fire({ type: 'visibilitychange' });
  Date.now = () => realNow() + 61 * 1000;
  document.hidden = false; document.fire({ type: 'visibilitychange' }); Date.now = realNow;
  T.ok('lock after page hidden > 60 s', S.locked === true);
  T.ok('unlock after hide-lock', await doUnlock('Uusi-salasana-77'));
  document.hidden = true; document.fire({ type: 'visibilitychange' }); await sleepT(50); document.hidden = false; document.fire({ type: 'visibilitychange' });
  T.ok('short hide does not lock', S.locked === false);

  // --- Biometrinen avaus (WebAuthn PRF, valekäyttöliittymä), yksityisyysnäkymä, oletuslukitus, linkit ---
  {
    const PWN = 'Uusi-salasana-77';
    window.HV_NO_AUTO_BIO = true;                          // vanhat testit painavat nappia käsin; automaattikäynnistystä testataan erikseen alla
    const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const AND_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
    const setNav = (ua, cred) => Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: ua, credentials: cred } });
    globalThis.location = { hostname: 'hakuviestit.example' };
    window.PublicKeyCredential = function PublicKeyCredential() { };
    const hmacPrf = async (secret, salt) => { const k = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return await crypto.subtle.sign('HMAC', k, salt); };
    // Valetodennin: PRF = HMAC(laitteen salaisuus, suola); mode: 'create-prf' | 'get-prf' (iOS: tulos vasta get-kutsulla) | 'none' (ei PRF-tukea)
    const makeAuth = o => {
      const creds = new Map(), log = [], a = { log, creds, o, lastCreate: null, lastGet: null };
      a.create = async opt => {
        log.push('create'); a.lastCreate = opt.publicKey;
        if (o.throwCreate) throw Object.assign(new Error('blocked'), { name: 'SecurityError', code: 18 });
        const id = crypto.getRandomValues(new Uint8Array(16)), secret = crypto.getRandomValues(new Uint8Array(32));
        creds.set(Buffer.from(id).toString('base64'), secret);
        const res = o.mode === 'create-prf' ? { prf: { enabled: true, results: { first: await hmacPrf(secret, opt.publicKey.extensions.prf.eval.first) } } } : o.mode === 'none' ? {} : { prf: { enabled: true } };
        return { rawId: id.buffer, getClientExtensionResults: () => res };
      };
      a.get = async opt => {
        log.push('get'); a.lastGet = opt.publicKey;
        if (o.rejectGet) throw Object.assign(new Error('denied'), { name: 'NotAllowedError', code: 0 });
        const secret = o.badPrf ? crypto.getRandomValues(new Uint8Array(32)) : creds.get(Buffer.from(opt.publicKey.allowCredentials[0].id).toString('base64'));
        const res = (o.mode === 'none' || !secret) ? {} : { prf: { results: { first: await hmacPrf(secret, opt.publicKey.extensions.prf.eval.first) } } };
        return { getClientExtensionResults: () => res };
      };
      return a;
    };
    const submitPw = async (id, formId, pw) => { byId(id).value = pw; byId(formId).dispatchEvent({ type: 'submit' }); };
    const closeSheets = () => sheetStack.slice().forEach(x => x.close());
    const kids = () => byId('lock').querySelector('.lock-card').children.map(c => c.id || c.tagName);
    const storedCrypto = () => JSON.parse(localStorage.getItem('hakuviestit.v1')).M.crypto;

    // oletuslukitus: uusi asennus 2 min, vanhat 5 min, tallennettua valintaa ei muuteta
    T.ok('lock default: new setup meta.lm = 2 (kept through password change)', storedCrypto().lm === 2 && SEC.meta.lm === 2);
    { const ps = S.profile, sm = SEC.meta;
      S.profile = { identities: [] };
      T.ok('lock default: new setup -> 2 min', settings().lockMin === 2, settings().lockMin);
      SEC.meta = Object.assign({}, sm); delete SEC.meta.lm;
      T.ok('lock default: legacy meta (no lm) -> 5 min', settings().lockMin === 5, settings().lockMin);
      S.profile = { identities: [], settings: { lockMin: 15 } };
      T.ok('lock default: explicit choice > 5 (15) kept', settings().lockMin === 15);
      S.profile = ps; SEC.meta = sm; }

    // tips: alustan mukaan
    { const tipsFor = ua => { setNav(ua, null); const c = privacySection().querySelector('#sec-tips'); return txt(c); };
      const ti = tipsFor(IOS_UA), ta = tipsFor(AND_UA), tu = tipsFor('Mozilla/5.0 (Windows NT 10.0)');
      T.ok('sec-tips iPhone UA: iPhone list only', /Suojausvinkit puhelimeen/.test(ti) && /Varastetun laitteen suojaus: Asetukset → Face ID ja pääsykoodi\./.test(ti) && /Lockdown Mode/.test(ti) && !/Play Protect/.test(ti) && !/Varkaussuoja/.test(ti));
      T.ok('sec-tips Android UA: Android list only', /Suojausvinkit puhelimeen/.test(ta) && /Play Protect/.test(ta) && /Varkaussuoja \(Theft protection\)/.test(ta) && /Advanced Protection, Android 16/.test(ta) && !/App Storesta/.test(ta) && !/Lockdown/.test(ta));
      T.ok('sec-tips unknown UA: both lists with iPhone/Android headings', /App Storesta/.test(tu) && /Play Protect/.test(tu) && /iPhoneLaita/.test(tu) && /AndroidLaita/.test(tu), tu.slice(0, 120)); }

    // Face ID käyttöön (iOS: PRF-tulos vasta get-kutsulla)
    let auth = makeAuth({ mode: 'get-prf' }); setNav(IOS_UA, auth);
    document.querySelector('#tab-accounts').click(); await sleepT(100); renderPrivacy();
    T.ok('bio: sec-bio-on "Ota Face ID käyttöön" visible, sec-bio-off hidden', byId('sec-bio-on').hidden === false && txt(byId('sec-bio-on')) === 'Ota Face ID käyttöön' && byId('sec-bio-off').hidden === true, txt(byId('sec-bio-on')));
    { const pk = window.PublicKeyCredential; delete window.PublicKeyCredential; renderPrivacy();
      T.ok('bio: hidden when PublicKeyCredential missing', byId('sec-bio-on').hidden === true);
      window.PublicKeyCredential = pk; renderPrivacy(); }
    byId('sec-bio-on').click(); await sleepT(50);
    T.ok('bio enable: sheet asks for current password, WebAuthn not called yet', !!byId('bio-pw') && auth.log.length === 0);
    await submitPw('bio-pw', 'bio-form', 'vaara-salasana-99'); await waitFor(() => !byId('bio-err').hidden, 6000);
    T.ok('bio enable: wrong password rejected, no credential created', /Salasana ei kelpaa/.test(txt(byId('bio-err'))) && auth.log.length === 0 && !SEC.meta.bio);
    await submitPw('bio-pw', 'bio-form', PWN); await waitFor(() => byId('bio-go') && !byId('bio-go').hidden, 6000);
    T.ok('bio enable: password verified, WebAuthn waits for separate tap (user gesture)', auth.log.length === 0 && byId('bio-go').hidden === false);
    byId('bio-go').click(); await waitFor(() => SEC.meta.bio, 6000); await sleepT(200);
    T.ok('bio enable: create then get (iOS returns PRF only on get)', auth.log.join() === 'create,get', auth.log);
    { const c = auth.lastCreate, g = auth.lastGet;
      T.ok('create options: rp, user, challenge, algs, platform + UV required, resident preferred, prf salt 32 B', c.rp.name === 'Hakuviestit' && c.rp.id === 'hakuviestit.example' && c.user.id.length === 16 && c.user.name === 'hakuviestit' && c.user.displayName === 'Hakuviestit' && c.challenge.length === 32 && c.pubKeyCredParams.map(p => p.alg).join() === '-7,-257' && c.authenticatorSelection.authenticatorAttachment === 'platform' && c.authenticatorSelection.userVerification === 'required' && c.authenticatorSelection.residentKey === 'preferred' && c.extensions.prf.eval.first.length === 32, c);
      T.ok('get options: allowCredentials [credId], UV required, same salt', g.userVerification === 'required' && g.allowCredentials.length === 1 && g.allowCredentials[0].type === 'public-key' && Buffer.from(g.allowCredentials[0].id).toString('base64') === SEC.meta.bio.credId && Buffer.from(g.extensions.prf.eval.first).toString('base64') === SEC.meta.bio.salt); }
    await sleepT(700);                                      // paikallinen tallennus kirjoitetaan viiveellä
    const rawB = localStorage.getItem('hakuviestit.v1'), mcB = storedCrypto();
    T.ok('bio meta stored next to meta/crypto {v, credId, salt, iv, ct}', mcB.bio && Object.keys(mcB.bio).sort().join() === 'credId,ct,iv,salt,v' && mcB.bio.v === 1 && mcB.v === 1 && !!mcB.check, mcB.bio);
    T.ok('no plaintext password in any stored data (incl. bio ciphertext)', !rawB.includes(PWN) && !Buffer.from(mcB.bio.ct, 'base64').toString('latin1').includes(PWN) && !String(localStorage.getItem('hv-fails')).includes(PWN) && !JSON.stringify(SEC.meta.bio).includes(PWN));
    T.ok('bio enable: toast, sheet closed, off button shown, on hidden', /Face ID otettu käyttöön/.test(txt(byId('toasts'))) && sheetStack.length === 0 && byId('sec-bio-off').hidden === false && byId('sec-bio-on').hidden === true && txt(byId('sec-bio-off')) === 'Poista Face ID käytöstä');

    // lukitus -> Face ID avaa
    byId('lockfab').click(); await sleepT(100);
    const nLog = auth.log.length;
    T.ok('lock screen: unlock-bio above password form, "Avaa Face ID:llä", not auto-triggered (HV_NO_AUTO_BIO)', !!byId('unlock-bio') && txt(byId('unlock-bio')) === 'Avaa Face ID:llä' && kids().indexOf('unlock-bio') < kids().indexOf('lock-form') && auth.log.length === nLog && S.locked, kids());
    byId('unlock-bio').click(); await waitFor(() => !S.locked, 8000); await sleepT(400);
    T.ok('unlock-bio unlocks (password from PRF-protected wrap), data restored', S.locked === false && Object.keys(S.chats).length > 0 && SEC.key !== null && auth.log.length === nLog + 1 && failState().n === 0);
    // epäonnistuminen: NotAllowedError
    byId('lockfab').click(); await sleepT(100);
    auth.o.rejectGet = true; byId('unlock-bio').click(); await waitFor(() => !byId('lock-err').hidden, 6000);
    T.ok('NotAllowedError (manual): error text, still locked, password field focused, does NOT count as failure', S.locked && txt(byId('lock-err')) === 'Face ID -avaus epäonnistui. Kirjoita salasana.' && document.activeElement && document.activeElement.id === 'lock-pw' && failState().n === 0 && localStorage.getItem('hv-fails') === null, [txt(byId('lock-err')), failState()]);
    auth.o.rejectGet = false; auth.o.mode = 'none';
    byId('unlock-bio').click(); await waitFor(() => /epäonnistui/.test(txt(byId('lock-err'))) && byId('unlock-bio').disabled === false, 6000); await sleepT(30);
    T.ok('no PRF output at unlock -> same error, stays locked, does not count', S.locked && txt(byId('lock-err')) === 'Face ID -avaus epäonnistui. Kirjoita salasana.' && failState().n === 0);
    auth.o.mode = 'get-prf'; auth.o.badPrf = true;
    for (let k = 0; k < 5; k++) { byId('unlock-bio').click(); await waitFor(() => failState().n === 1 + k, 6000); await sleepT(20); }
    T.ok('5 failed Face ID attempts -> throttle: unlock-wait mm:ss, both buttons disabled', failState().n === 5 && /^Liian monta yritystä\. Yritä uudelleen 00:(29|30) kuluttua\.$/.test(txt(byId('unlock-wait'))) && byId('unlock-bio').disabled === true && byId('lock-go').disabled === true && byId('unlock-wait').hidden === false, [txt(byId('unlock-wait')), failState()]);
    const nl2 = auth.log.length; byId('unlock-bio').click(); await sleepT(50);
    T.ok('Face ID not attempted during wait', auth.log.length === nl2 && S.locked);
    clearFails(); auth.o.rejectGet = false; auth.o.badPrf = false; showUnlock();
    T.ok('after clearing the throttle the wait box is gone', byId('unlock-wait').hidden === true && byId('unlock-bio').disabled === false);
    byId('unlock-bio').click(); await waitFor(() => !S.locked, 8000); await sleepT(400);
    T.ok('Face ID works again', S.locked === false && failState().n === 0);

    // --- automaattinen Face ID avattaessa (HV_NO_AUTO_BIO pois) ---
    window.HV_NO_AUTO_BIO = false;
    {
      const n0 = auth.log.length;
      byId('lockfab').click(); await waitFor(() => !S.locked, 8000); await sleepT(400);
      T.ok('auto: lock screen with bio calls credentials.get exactly once and unlocks without a tap', auth.log.length === n0 + 1 && auth.log[n0] === 'get' && S.locked === false && failState().n === 0, auth.log);
      // peruttu: ei laskuria, ei punaista virhettä, hiljainen vihje
      auth.o.rejectGet = true; const n1 = auth.log.length; try { document.activeElement = null; } catch (e) { /* ok */ }
      byId('lockfab').click(); await sleepT(150);
      T.ok('auto cancelled (NotAllowedError): one get, no hv-fails, no lock-err, quiet hint, password field not focused', auth.log.length === n1 + 1 && S.locked && byId('lock-err').hidden === true && localStorage.getItem('hv-fails') === null && byId('unlock-hint').hidden === false && /Napauta/.test(txt(byId('unlock-hint'))) && !(document.activeElement && document.activeElement.id === 'lock-pw'), [auth.log.length - n1, S.locked, byId('lock-err').hidden, localStorage.getItem('hv-fails'), document.activeElement && document.activeElement.id]);
      auth.o.rejectGet = false; byId('unlock-bio').click(); await waitFor(() => !S.locked, 8000); await sleepT(400);
      T.ok('manual button still works after a cancelled auto prompt', S.locked === false && failState().n === 0);
      // väärä PRF: lasketaan
      auth.o.badPrf = true; byId('lockfab').click(); await waitFor(() => failState().n === 1, 6000); await sleepT(50);
      T.ok('auto with wrong PRF (unwrap fails): counts as failure, error shown, still locked', S.locked && failState().n === 1 && txt(byId('lock-err')) === 'Face ID -avaus epäonnistui. Kirjoita salasana.', failState());
      auth.o.badPrf = false; clearFails();
      // piilotettu sivu: ei ennen näkymistä, sitten kerran
      auth.o.rejectGet = true; document.hidden = true; const n2 = auth.log.length;
      showUnlock(); await sleepT(100);
      T.ok('hidden page: no get while hidden', auth.log.length === n2 && S.locked);
      document.hidden = false; document.fire({ type: 'visibilitychange' }); await sleepT(100); document.fire({ type: 'visibilitychange' }); await sleepT(100);
      T.ok('visibilitychange to visible: get started exactly once (even after a second event)', auth.log.length === n2 + 1, auth.log.length - n2);
      // korvattu lukitusnäkymä: vanhan kuuntelija poistuu, uusi (näkyvä) käynnistää yhden
      auth.o.rejectGet = false; document.hidden = true; showUnlock(); const n3 = auth.log.length;
      document.hidden = false; showUnlock(); await waitFor(() => !S.locked, 8000); await sleepT(300);
      document.fire({ type: 'visibilitychange' }); await sleepT(100);
      T.ok('replaced lock screen: old instance listener removed, exactly one get, unlocked', auth.log.length === n3 + 1 && S.locked === false, auth.log.length - n3);
    }
    window.HV_NO_AUTO_BIO = true;

    // poista käytöstä
    document.querySelector('#tab-accounts').click(); await sleepT(100);
    byId('sec-bio-off').click(); await waitFor(() => !SEC.meta.bio, 3000); await sleepT(700);
    T.ok('sec-bio-off removes bio meta (memory + storage), on button back', !SEC.meta.bio && !storedCrypto().bio && storedCrypto().check && byId('sec-bio-on').hidden === false && byId('sec-bio-off').hidden === true);

    // tarjous: Face ID käyttöön salasanalla avaamisen jälkeen
    {
      const offerShown = () => !!byId('bio-offer-go');
      localStorage.removeItem('hv-bio-offer'); closeSheets();
      byId('lockfab').click(); await sleepT(50);
      T.ok('offer: password unlock with bio supported + not enrolled opens the sheet', await doUnlock(PWN) && offerShown() && !!byId('bio-offer-no') && /Face ID käyttöön\?/.test(txt(byId('layers'))) && /Avaa Hakuviestit jatkossa Face ID:llä ilman salasanaa\./.test(txt(byId('layers'))) && txt(byId('bio-offer-go')) === 'Ota käyttöön' && txt(byId('bio-offer-no')) === 'Ei nyt', txt(byId('layers')));
      byId('bio-offer-no').click(); await sleepT(50);
      T.ok('offer "Ei nyt": flag stored, sheet closed', localStorage.getItem('hv-bio-offer') === 'no' && sheetStack.length === 0);
      byId('lockfab').click(); await sleepT(50);
      T.ok('offer not shown again after "Ei nyt"', await doUnlock(PWN) && !offerShown() && sheetStack.length === 0);
      // WebAuthn ei toimi: ei-tuettu-viesti, ei toistoa
      localStorage.removeItem('hv-bio-offer');
      { const a0 = auth; auth = makeAuth({ mode: 'create-prf', throwCreate: true }); setNav(IOS_UA, auth);
        byId('lockfab').click(); await sleepT(50);
        await doUnlock(PWN); byId('bio-offer-go').click(); await waitFor(() => !byId('bio-offer-err').hidden, 6000);
        T.ok('offer: enroll fails -> unsupported text in sheet, nothing stored, flag set so it does not nag', /^Face ID ei ole käytettävissä tässä näkymässä\./.test(txt(byId('bio-offer-err'))) && !SEC.meta.bio && localStorage.getItem('hv-bio-offer') === 'no', txt(byId('bio-offer-err')));
        closeSheets(); auth = a0; setNav(IOS_UA, auth); }
      // ei tukea: ei tarjousta
      localStorage.removeItem('hv-bio-offer');
      { const pk = window.PublicKeyCredential; delete window.PublicKeyCredential;
        byId('lockfab').click(); await sleepT(50);
        T.ok('offer not shown when bioSupported() is false', await doUnlock(PWN) && !offerShown() && sheetStack.length === 0);
        window.PublicKeyCredential = pk; }
      // Ota käyttöön: ei salasanakysymystä, create kerran, meta tallessa
      byId('lockfab').click(); await sleepT(50);
      await doUnlock(PWN);
      const c0 = auth.log.filter(x => x === 'create').length;
      T.ok('offer: sheet shown again (supported, not enrolled, flag cleared)', offerShown());
      byId('bio-offer-go').click(); await waitFor(() => SEC.meta.bio, 6000); await sleepT(700);
      T.ok('offer "Ota käyttöön": no password prompt, create called once, bio saved in meta (memory + storage), toast, sheet closed, flag cleared', !byId('bio-pw') && !byId('ask-pw') && auth.log.filter(x => x === 'create').length === c0 + 1 && !!SEC.meta.bio && !!storedCrypto().bio && /Face ID otettu käyttöön/.test(txt(byId('toasts'))) && sheetStack.length === 0 && localStorage.getItem('hv-bio-offer') === null, auth.log);
      T.ok('offer: password not stored anywhere', !localStorage.getItem('hakuviestit.v1').includes(PWN) && !JSON.stringify(SEC.meta.bio).includes(PWN));
      byId('lockfab').click(); await sleepT(50);
      byId('unlock-bio').click(); await waitFor(() => !S.locked, 8000); await sleepT(400);
      T.ok('bio unlock after offer enrolment works and shows no offer', S.locked === false && !offerShown());
      document.querySelector('#tab-accounts').click(); await sleepT(100);
      byId('sec-bio-off').click(); await waitFor(() => !SEC.meta.bio, 3000); await sleepT(700);
    }

    // ei PRF-tukea -> ei oteta käyttöön
    auth = makeAuth({ mode: 'none' }); setNav(IOS_UA, auth);
    byId('sec-bio-on').click(); await sleepT(50);
    await submitPw('bio-pw', 'bio-form', PWN); await waitFor(() => byId('bio-go') && !byId('bio-go').hidden, 6000);
    byId('bio-go').click(); await waitFor(() => !byId('bio-err').hidden, 6000); await sleepT(100);
    T.ok('no-PRF (iOS UA): not enabled, iOS unsupported text, tried create then get', txt(byId('bio-err')) === 'Face ID ei ole käytettävissä tässä näkymässä. Toimii Safarissa tai Koti-valikkoon lisätyssä sovelluksessa (iOS 18 tai uudempi): avaa sivu Safarilla ja valitse Jaa → Lisää Koti-valikkoon.' && !SEC.meta.bio && !storedCrypto().bio && auth.log.join() === 'create,get', [txt(byId('bio-err')), auth.log]);
    closeSheets();
    // WebAuthn estetty (esim. iframe-sandbox): sama ei-tuettu-viesti, Android-teksti
    auth = makeAuth({ mode: 'create-prf', throwCreate: true }); setNav(AND_UA, auth); renderPrivacy();
    T.ok('Android UA: button text "Ota sormenjälki tai kasvojentunnistus käyttöön"', txt(byId('sec-bio-on')) === 'Ota sormenjälki tai kasvojentunnistus käyttöön', txt(byId('sec-bio-on')));
    byId('sec-bio-on').click(); await sleepT(50);
    await submitPw('bio-pw', 'bio-form', PWN); await waitFor(() => byId('bio-go') && !byId('bio-go').hidden, 6000);
    byId('bio-go').click(); await waitFor(() => !byId('bio-err').hidden, 6000);
    T.ok('create blocked (SecurityError, Android UA): Android unsupported text, nothing stored', txt(byId('bio-err')) === 'Sormenjälki tai kasvojentunnistus ei ole käytettävissä tässä näkymässä. Toimii Chromessa tai aloitusnäytölle lisätyssä sovelluksessa (Android 9 tai uudempi, Google Play -palvelut).' && !SEC.meta.bio && !storedCrypto().bio, txt(byId('bio-err')));
    closeSheets();

    // Android: PRF jo create-vaiheessa -> käyttöön, avausnapin teksti
    auth = makeAuth({ mode: 'create-prf' }); setNav(AND_UA, auth); renderPrivacy();
    byId('sec-bio-on').click(); await sleepT(50);
    await submitPw('bio-pw', 'bio-form', PWN); await waitFor(() => byId('bio-go') && !byId('bio-go').hidden, 6000);
    byId('bio-go').click(); await waitFor(() => SEC.meta.bio, 6000); await sleepT(700);
    T.ok('Android UA with PRF on create: enabled with a single create call', auth.log.join() === 'create' && !!storedCrypto().bio && /Sormenjälki tai kasvojentunnistus otettu käyttöön/.test(txt(byId('toasts'))) && txt(byId('sec-bio-off')) === 'Poista sormenjälki tai kasvojentunnistus käytöstä');
    byId('lockfab').click(); await sleepT(100);
    T.ok('Android lock screen: "Avaa biometrisellä tunnistuksella", no Face ID wording', txt(byId('unlock-bio')) === 'Avaa biometrisellä tunnistuksella' && !/Face ID/.test(txt(byId('lock'))));
    byId('unlock-bio').click(); await waitFor(() => !S.locked, 8000); await sleepT(400);
    T.ok('Android: biometric unlock works (create-prf then get)', S.locked === false && auth.log.join() === 'create,get');
    byId('lockfab').click(); await sleepT(100);
    auth.o.rejectGet = true; byId('unlock-bio').click(); await waitFor(() => !byId('lock-err').hidden, 6000);
    T.ok('Android failure text: "Biometrinen avaus epäonnistui. Kirjoita salasana."', txt(byId('lock-err')) === 'Biometrinen avaus epäonnistui. Kirjoita salasana.' && S.locked);
    clearFails(); auth.o.rejectGet = false; showUnlock();
    byId('unlock-bio').click(); await waitFor(() => !S.locked, 8000); await sleepT(400);

    // salasanan vaihto poistaa biometrisen avauksen
    setNav(IOS_UA, auth);
    document.querySelector('#tab-accounts').click(); await sleepT(100);
    T.ok('bio enabled before password change', !!SEC.meta.bio && !!storedCrypto().bio);
    byId('sec-change').click(); await sleepT(50);
    byId('cp-old').value = PWN; byId('cp-new1').value = PWN; byId('cp-new2').value = PWN; byId('cp-form').dispatchEvent({ type: 'submit' });
    await waitFor(() => /Salasana vaihdettu/.test(txt(byId('toasts'))), 15000); await sleepT(800);
    T.ok('password change: bio meta cleared (memory + storage), lm kept', !SEC.meta.bio && !storedCrypto().bio && storedCrypto().lm === 2 && !SEC.metaRaw.bio);
    await waitFor(() => /Face ID poistettiin käytöstä salasanan vaihdon vuoksi\. Ota se uudelleen käyttöön Tietosuoja-osiossa\./.test(txt(byId('toasts'))), 6000);
    T.ok('password change: re-enable hint shown, on button back', /Ota se uudelleen käyttöön/.test(txt(byId('toasts'))) && byId('sec-bio-on').hidden === false && byId('sec-bio-off').hidden === true, txt(byId('toasts')));
    byId('lockfab').click(); await sleepT(100);
    T.ok('after password change: no unlock-bio on lock screen', !byId('unlock-bio') && !!byId('lock-pw'));
    T.ok('after password change: password unlock still works', await doUnlock(PWN) && Object.keys(S.chats).length > 0);
    T.ok('whole store still free of the password', !localStorage.getItem('hakuviestit.v1').includes(PWN));
    closeSheets(); setNav('', null);              // salasanalla avaus voi avata biometriatarjouksen
  }
  // --- yksityisyysnäkymä ---
  { const de = document.documentElement;
    document.hidden = true; document.fire({ type: 'visibilitychange' });
    T.ok('privacy-blur: class added when page hidden (lock enabled)', de.classList.contains('privacy-blur'));
    document.hidden = false; document.fire({ type: 'visibilitychange' });
    T.ok('privacy-blur: removed when visible again', !de.classList.contains('privacy-blur') && S.locked === false); }
  // --- linkit viesteissä ---
  {
    document.querySelector('#tab-chats').click(); await sleepT(100); const CID = Object.keys(S.chats)[0]; openChat(CID); await sleepT(300);
    const BODYL = 'Katso https://example.com/ilmoitus ja javascript:alert(1) sekä data:text/html,<b>x</b>\n[Napauta tästä](javascript:alert(2)) tai [turvallinen](https://example.org/a)\nSähköposti mailto:rekry@example.fi, puhelin tel:+358401234567.\nVahvista: paypal.com <https://secure-paypal.evil.example/login>';
    await S.store.set('chats/' + CID + '/messages/lk1', toMsgDoc({ at: '2026-11-01T10:00:00.000Z', dir: 'in', channel: 'email', from: 'rekry@valio.example.fi', fromName: 'Rekry', to: ['oma.esimerkki@gmail.com'], subject: 'Linkit', body: BODYL, source: 'manual' }));
    await waitFor(() => byId('msg-lk1'), 4000); await sleepT(200);
    const as = byId('msg-lk1').querySelectorAll('a');
    T.ok('bubble text unchanged by linkification', txt(byId('msg-lk1').querySelector('.bbody')) === BODYL.replace('[Napauta tästä](javascript:alert(2))', '[Napauta tästä](javascript:alert(2))').replace('[turvallinen](https://example.org/a)', 'turvallinen'));
    T.ok('only http(s)/mailto/tel become anchors (5)', as.length === 5 && as.map(a => a.getAttribute('href')).join(' ') === 'https://example.com/ilmoitus https://example.org/a mailto:rekry@example.fi tel:+358401234567 https://secure-paypal.evil.example/login', as.map(a => a.getAttribute('href')));
    T.ok('no javascript:/data: href anywhere in the message', !byId('msg-lk1').querySelectorAll('a').some(a => /^(javascript|data):/i.test(a.getAttribute('href'))) && !/<a/i.test(txt(byId('msg-lk1'))));
    T.ok('all links have rel="noopener noreferrer" target="_blank"', as.every(a => a.getAttribute('rel') === 'noopener noreferrer' && a.getAttribute('target') === '_blank'));
    as[0].click(); await sleepT(50);
    T.ok('http(s) click: confirm sheet shows real hostname "Avataanko linkki? example.com"', txt(byId('lk-q')) === 'Avataanko linkki? example.com' && txt(byId('lk-url')) === 'https://example.com/ilmoitus' && !byId('lk-warn') && byId('lk-go').getAttribute('href') === 'https://example.com/ilmoitus' && byId('lk-go').getAttribute('rel') === 'noopener noreferrer' && byId('lk-go').getAttribute('target') === '_blank', txt(byId('lk-q')));
    byId('lk-cancel').click(); await sleepT(20);
    T.ok('confirm sheet: cancel closes without opening', sheetStack.length === 0);
    as[4].click(); await sleepT(50);
    T.ok('phishing: label "paypal.com" but real host shown + warning naming both', txt(byId('lk-q')) === 'Avataanko linkki? secure-paypal.evil.example' && !!byId('lk-warn') && /paypal\.com/.test(txt(byId('lk-warn'))) && /secure-paypal\.evil\.example/.test(txt(byId('lk-warn'))), [txt(byId('lk-q')), txt(byId('lk-warn'))]);
    sheetStack.slice().forEach(x => x.close());
    as[2].click(); await sleepT(20);
    T.ok('mailto click: no confirm sheet (handled by mail app)', sheetStack.length === 0 && !byId('lk-q'));
    await S.store.del('chats/' + CID + '/messages/lk1'); await sleepT(200);
    closeChat();
  }
  // --- Lisää sähköpostilla ---
  const mkUns = (id, from, name) => S.store.set('unsorted/' + id, { at: '2026-10-20T10:00:00.000Z', dir: 'in', channel: 'email', from, fromName: name, to: ['oma@x.fi'], subject: 'Moi', body: 'Viesti osoitteesta ' + from, source: 'eml', createdAt: '2026-10-20T10:00:00.000Z', suggestedName: name });
  await mkUns('ae-u1', 'ville@kesko-testi.fi', 'Ville'); await mkUns('ae-u2', 'sari@kesko-testi.fi', 'Sari'); await mkUns('ae-u3', 'muu@ei-liity.fi', 'Muu');
  await waitFor(() => S.unsorted.length >= 3);
  const chatsBefore = Object.keys(S.chats).length;
  document.querySelector('#tab-chats').click();
  byId('fab').click();
  T.ok('new chat sheet has tabs (mobile entry to email add)', !!byId('tab-email') && !!byId('tab-new') && byId('tab-new').getAttribute('aria-pressed') === 'true');
  byId('tab-email').click(); await sleepT(50);
  T.ok('email tab opens add-by-email sheet', !!byId('ae-text') && sheetStack.length === 1);
  byId('ae-text').value = 'Ville Virtanen <ville@kesko-testi.fi>, sari@kesko-testi.fi; mikko.laine@valio-testi.fi\nhuono@, jussi@gmail.com, Ville Virtanen <ville@kesko-testi.fi>';
  byId('ae-text').dispatchEvent({ type: 'input' });
  const rowsTxt = txt(byId('ae-preview'));
  T.ok('preview: names, companies, invalid reason', /Ville Virtanen/.test(rowsTxt) && /Mikko Laine/.test(rowsTxt) && /Kesko-testi/.test(rowsTxt) && /Valio-testi/.test(rowsTxt) && /puuttuu verkkotunnus/.test(rowsTxt) && !/Jussi.*Gmail/.test(rowsTxt), rowsTxt);
  T.ok('preview: 4 valid + 1 invalid, summary', /4 uutta osoitetta/.test(txt(byId('ae-summary'))) && /1 virheellistä/.test(txt(byId('ae-summary'))), txt(byId('ae-summary')));
  T.ok('button: Lisää 3 keskustelua (company mode)', txt(byId('ae-go')) === 'Lisää 3 keskustelua' && byId('ae-go').disabled === false, txt(byId('ae-go')));
  byId('ae-mode-person').checked = true; byId('ae-mode-company').checked = false; byId('ae-mode-person').dispatchEvent({ type: 'change' });
  T.ok('person mode: 4 chats', txt(byId('ae-go')) === 'Lisää 4 keskustelua', txt(byId('ae-go')));
  byId('ae-mode-company').checked = true; byId('ae-mode-person').checked = false; byId('ae-mode-company').dispatchEvent({ type: 'change' });
  byId('ae-status').value = 'odottaa';
  byId('ae-go').click();
  await waitFor(() => Object.keys(S.chats).length === chatsBefore + 3 && S.unsorted.length === 1, 8000); await sleepT(500);
  const kesko = Object.values(S.chats).find(c => c.name === 'Kesko-testi');
  T.ok('3 chats created with status and company', Object.keys(S.chats).length === chatsBefore + 3 && kesko && kesko.status === 'odottaa' && kesko.company === 'Kesko-testi' && kesko.members.length === 2, kesko);
  T.ok('unsorted messages moved automatically (2 of 3)', S.unsorted.length === 1 && S.unsorted[0].id === 'ae-u3' && kesko.stats.received === 2, [S.unsorted.length, kesko.stats]);
  T.ok('toast summary', /Lisättiin 3 keskustelua, siirrettiin 2 viestiä/.test(txt(byId('toasts'))), txt(byId('toasts')));
  T.ok('sheet closed', sheetStack.length === 0);
  // tyhjä chat + tallennus salattuna
  const jussi = Object.keys(S.chats).find(id => S.chats[id].name === 'Jussi');
  openChat(jussi); await sleepT(200);
  T.ok('empty chat text', /Kirjaa ensimmäinen viesti alla tai tuo sähköpostit Tuo-välilehdeltä/.test(txt(byId('chat-empty'))) && /jussi@gmail\.com liittyvät viestit lajitellaan tänne automaattisesti/.test(txt(byId('chat-empty'))), txt(byId('chat-empty')));
  closeChat();
  const row = document.querySelectorAll('.row').find(r => /Jussi/.test(r.textContent));
  T.ok('empty chat shown in list with "Ei viestejä vielä"', row && /Ei viestejä vielä/.test(row.textContent));
  // olemassa olevat: tunnettu ohitetaan, domainin chatiin lisätään
  openAddByEmailSheet();
  byId('ae-text').value = 'ville@kesko-testi.fi anna.koski@kesko-testi.fi'; byId('ae-text').dispatchEvent({ type: 'input' });
  const t2 = txt(byId('ae-preview'));
  T.ok('known skipped, domain chat offered', /Jo keskustelussa Kesko-testi – ohitetaan/.test(t2) && /Lisää henkilö keskusteluun Kesko-testi/.test(t2) && txt(byId('ae-go')) === 'Lisää 1 henkilö keskusteluun', [t2, txt(byId('ae-go'))]);
  const selAe = document.querySelector('#ae-preview').querySelectorAll('select')[0];
  selAe.value = 'new'; selAe.dispatchEvent({ type: 'change', target: selAe });
  T.ok('can choose new chat instead', txt(byId('ae-go')) === 'Lisää 1 keskustelu', txt(byId('ae-go')));
  document.querySelector('#ae-preview').querySelectorAll('select')[0].value = 'addto'; document.querySelector('#ae-preview').querySelectorAll('select')[0].dispatchEvent({ type: 'change', target: document.querySelector('#ae-preview').querySelectorAll('select')[0] });
  byId('ae-go').click();
  await waitFor(() => (Object.values(S.chats).find(c => c.name === 'Kesko-testi') || { members: [] }).members.length === 3, 8000);
  T.ok('person added to existing chat', Object.values(S.chats).find(c => c.name === 'Kesko-testi').members.length === 3 && Object.keys(S.chats).length === chatsBefore + 3);
  openAddByEmailSheet(); byId('ae-text').value = 'ei osoite, toinen'; byId('ae-text').dispatchEvent({ type: 'input' });
  T.ok('only invalid: button disabled, nothing added', byId('ae-go').disabled === true && /virheellistä/.test(txt(byId('ae-summary'))));
  sheetStack[sheetStack.length - 1].close();
  await sleepT(800);
  T.ok('new chats stored encrypted (no addresses in localStorage)', (() => { const r = localStorage.getItem('hakuviestit.v1'); return !['kesko-testi', 'mikko.laine', 'jussi@gmail', 'Ville Virtanen'].some(x => r.includes(x)); })());
  document.querySelector('#tab-chats').click();
  byId('empty-email') && 0;

  // --- Unohdin salasanan -> aloita alusta ---
  byId('lockfab').click(); await sleepT(100);
  byId('lock-forgot').click(); await sleepT(50);
  T.ok('reset needs POISTA', byId('sec-reset-go').disabled === true);
  byId('sec-reset-word').value = 'poista'; byId('sec-reset-word').dispatchEvent({ type: 'input' }); T.ok('lowercase not accepted', byId('sec-reset-go').disabled === true);
  byId('sec-reset-word').value = 'POISTA'; byId('sec-reset-word').dispatchEvent({ type: 'input' }); T.ok('POISTA accepted', byId('sec-reset-go').disabled === false);
  byId('sec-reset-go').click(); await waitFor(() => byId('sec-setup-form'), 5000); await sleepT(700);
  const rawAfter = JSON.parse(localStorage.getItem('hakuviestit.v1'));
  T.ok('reset wipes everything, back to setup', !!byId('sec-setup-form') && rawAfter.M.crypto === null && Object.keys(rawAfter.M.chats).length === 0 && rawAfter.M.profile === null && Object.keys(rawAfter.M.msgs).length === 0 && rawAfter.seeded === false, [rawAfter.M.crypto, rawAfter.seeded]);
  T.ok('new setup works and examples reload (encrypted)', await doSetup() && Object.keys(S.chats).length === 5);
  T.done();
})().catch(e => { console.error(e); T.ok('driver exception', false, String(e && e.stack)); T.done(); });
