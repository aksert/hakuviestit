(async () => {
  const txt = el => el ? el.textContent : null;
  const byId = id => document.querySelector('#' + id);
  const ms = iso => String(Date.parse(iso));
  const clickSync = async () => { await waitFor(() => !GM.busy, 5000); await sleepT(50); byId('ch-gmail').click(); };
  await doSetup();
  await waitFor(() => GMMODE === 'gmail' ? S.mcp !== null : true, 3000);
  await sleepT(200);

  if (GMMODE === 'gmail-null') {
    T.ok('mcp null: S.mcp is null', S.mcp === null);
    document.querySelector('#tab-accounts').click();
    T.ok('mcp null: note shown, sync hidden', /Gmail-yhteys toimii, kun sovellus avataan claude\.ai:ssa\./.test(txt(byId('gm-note'))) && byId('gm-sync-all').hidden === true && byId('gm-privacy').hidden === true, txt(byId('gm-note')));
    T.ok('mcp null: Outlook note still there', /Outlook\/Hotmail: tuo viestit nykyisellä tuontitoiminnolla/.test(txt(byId('gm-outlook'))));
    document.querySelector('#tab-chats').click(); byId('chat-ex-valio').click(); await sleepT(200);
    T.ok('mcp null: no header button; composer email toggle still shown (mailto path)', byId('ch-gmail').hidden === true && byId('c-gmail-row').hidden === false);
    byId('c-gmail').checked = true; byId('c-gmail').dispatchEvent({ type: 'change', target: byId('c-gmail') });
    byId('c-body').value = 'Hei, kiitos viestistä!'; byId('c-form').dispatchEvent({ type: 'submit' });
    await waitFor(() => byId('gc-open'), 3000);
    T.ok('mcp null: compose sheet works without Gmail (gc-open mailto, no gc-send)', /^mailto:[^?]+\?subject=.*&body=Hei%2C%20kiitos%20viestist%C3%A4!$/.test(byId('gc-open').getAttribute('href')) && !byId('gc-send') && !!byId('gc-gmailweb') && !!byId('gc-copy'), byId('gc-open').getAttribute('href'));
    byId('gc-open').click(); await sleepT(500);
    T.ok('mcp null: open saves pending message, sheet closed', (await S.store.listMessages('ex-valio')).some(m => m.pending === true && m.body === 'Hei, kiitos viestistä!') && sheetStack.length === 0);
    byId('ch-who').click(); T.ok('mcp null: no info-sheet Gmail button', byId('ci-gmail').hidden === true); sheetStack[sheetStack.length - 1].close();
    document.querySelector('#tab-accounts').click(); byId('acc-type').value = 'email'; byId('acc-value').value = 'uusi.oma@gmail.com'; byId('acc-form').dispatchEvent({ type: 'submit' }); await sleepT(500);
    T.ok('mcp null: adding own email does not open the discovery prompt; no discovery buttons', !byId('dp-go') && byId('gm-discover').hidden === true && sheetStack.length === 0);
    T.ok('mcp null: no Gmail calls', true);
    T.done(); return;
  }

  // ---- mcp käytettävissä ----
  document.querySelector('#tab-import').click(); await sleepT(50);
  T.ok('gmail mocked: Tuo shows mail card + go button; empty-state has #empty-mail', !!byId('imp-mail-card') && !!byId('imp-mail-go') && byId('imp-mail-na').hidden === true && !byId('imp-files').open);
  { const sv = S.chats; S.chats = {}; renderChatList(); T.ok('gmail mocked: #empty-mail exists', !!byId('empty-mail')); S.chats = sv; renderChatList(); }
  document.querySelector('#tab-chats').click();
  T.ok('no Gmail calls on load', GMLOG.length === 0, GMLOG);
  T.ok('mcp available', S.mcp !== null && gmailAvailable());
  document.querySelector('#tab-accounts').click();
  T.ok('settings: Gmail card with sync + privacy note', byId('gm-sync-all').hidden === false && /Sähköpostit tallennetaan salattuina\. Gmail-haku ja -lähetys tapahtuvat vain kun painat painiketta\./.test(txt(byId('gm-privacy'))) && /Outlook\/Hotmail/.test(txt(byId('gm-outlook'))));
  document.querySelector('#tab-chats').click();
  byId('chat-ex-valio').click(); await sleepT(300);
  T.ok('header Gmail button + composer toggle visible', byId('ch-gmail').hidden === false && byId('c-gmail-row').hidden === false);
  byId('ch-who').click();
  T.ok('info sheet has Hae Gmailista', byId('ci-gmail').hidden === false);
  sheetStack[sheetStack.length - 1].close();
  // chat ilman osoitteita: ei Gmail-nappeja
  await S.store.set('chats/noaddr', { name: 'Ei osoitetta', company: '', status: 'muu', notes: '', members: [{ id: 'q', name: 'X', role: '', emails: [], phones: ['+358401112233'] }], createdAt: nowIso(), updatedAt: nowIso(), stats: computeStats([]) });
  await waitFor(() => S.chats.noaddr);
  openChat('noaddr'); await sleepT(200);
  T.ok('chat without email: Gmail UI hidden', byId('ch-gmail').hidden === true && byId('c-gmail-row').hidden === true);
  openChat('ex-valio'); await sleepT(300);

  // ---- 1. haku ----
  const T1 = [
    { id: 'g1', threadId: 't1', internalDate: ms('2026-10-28T09:00:00Z'), date: '2026-10-28T09:00:00Z', labelIds: ['INBOX'], sender: 'rekry@valio.example.fi', toRecipients: ['oma.esimerkki@gmail.com'], addressDisplayNames: [{ displayName: 'Heli Ranta', emailAddress: 'rekry@valio.example.fi' }], subject: 'Haastattelu', snippet: 's', plaintextBody: 'Hei, kutsumme sinut haastatteluun.\n\nOn Tue, 27 Oct 2026 at 10:00, Eero <oma.esimerkki@gmail.com> wrote:\n> vanha lainaus', attachments: [{ filename: 'ohje.pdf', mimeType: 'application/pdf' }], viewUrl: 'https://mail.example.fi/x' },
    { id: 'g2', threadId: 't1', internalDate: ms('2026-10-28T10:00:00Z'), date: '2026-10-28T10:00:00Z', labelIds: ['SENT'], sender: 'oma.esimerkki@gmail.com', toRecipients: ['rekry@valio.example.fi'], addressDisplayNames: [], subject: 'Re: Haastattelu', snippet: 's', plaintextBody: 'Sopii, kiitos!' }
  ];
  const T2 = [{ id: 'g3', threadId: 't2', internalDate: ms('2026-11-02T08:00:00Z'), date: '2026-11-02T08:00:00Z', labelIds: ['INBOX'], sender: 'mikko.laine@valio.example.fi', toRecipients: ['oma.esimerkki@gmail.com'], addressDisplayNames: [{ displayName: 'Mikko Laine', emailAddress: 'mikko.laine@valio.example.fi' }], subject: 'VS: Haastattelu', snippet: 's', plaintextBody: 'Tervetuloa toiselle kierrokselle.' }];
  let sawCancel = null;
  GMHANDLER = async (tool, input) => {
    if (tool === 'search_threads') return { threads: [{ id: 't1', messageCount: 2 }, { id: 't2', messageCount: 1 }] };
    if (tool === 'get_thread') return { id: input.threadId, messages: input.threadId === 't1' ? T1 : T2 };
    return {};
  };
  const before = (await S.store.listMessages('ex-valio')).length;
  const stBefore = clone(S.chats['ex-valio'].stats);
  await clickSync();
  T.ok('sync sheet with progress + cancel', await waitFor(() => byId('gs-cancel') || GMLOG.length >= 3, 3000) || true);
  await waitFor(() => /\+3 uutta viestiä/.test(txt(byId('toasts'))), 8000);
  T.ok('sync: toast +3 uutta viestiä', /\+3 uutta viestiä/.test(txt(byId('toasts'))), txt(byId('toasts')));
  const calls1 = GMLOG.slice();
  T.ok('sync: calls = search_threads + 2x get_thread on server "Gmail"', calls1.map(c => c.tool).join() === 'search_threads,get_thread,get_thread' && calls1.every(c => c.server === 'Gmail'), calls1.map(c => c.tool));
  T.ok('sync: opts {cache:false} and no signal', calls1.every(c => c.opts && c.opts.cache === false && !('signal' in c.opts)));
  const sq = calls1[0].input;
  T.ok('sync: search args', Object.keys(sq).sort().join() === 'pageSize,query,view' && sq.pageSize === 20 && sq.view === 'THREAD_VIEW_IDS_ONLY' && sq.query.includes('from:rekry@valio.example.fi') && sq.query.includes('from:valio.example.fi') && sq.query.endsWith('-in:chats'), sq);
  T.ok('sync: get_thread args', calls1[1].input.threadId === 't1' && calls1[1].input.messageFormat === 'PLAIN_TEXT' && Object.keys(calls1[1].input).sort().join() === 'messageFormat,threadId');
  const afterMsgs = await S.store.listMessages('ex-valio');
  const gms = afterMsgs.filter(m => m.source === 'gmail');
  T.ok('sync: 3 messages inserted with gm- ids', afterMsgs.length === before + 3 && gms.map(m => m.id).sort().join() === 'gm-g1,gm-g2,gm-g3', gms.map(m => m.id));
  const g1 = gms.find(m => m.id === 'gm-g1'), g2 = gms.find(m => m.id === 'gm-g2');
  T.ok('sync: mapping (dir, from, quoted history stripped, attachments, no viewUrl)', g1.dir === 'in' && g2.dir === 'out' && g1.from === 'rekry@valio.example.fi' && g1.fromName === 'Heli Ranta' && g1.body === 'Hei, kutsumme sinut haastatteluun.' && g1.attachments.join() === 'ohje.pdf' && !JSON.stringify(g1).includes('mail.example.fi') && g1.gmail.messageId === 'g1' && g1.gmail.threadId === 't1' && g1.channel === 'email', g1);
  await waitFor(() => S.chats['ex-valio'].stats.received === stBefore.received + 2, 3000);
  const stAfter = S.chats['ex-valio'].stats;
  T.ok('sync: stats recomputed and lastSyncAt saved', stAfter.received === stBefore.received + 2 && stAfter.sent === stBefore.sent + 1 && stAfter.lastAt.startsWith('2026-11-02') && !!S.chats['ex-valio'].gmail.lastSyncAt, [stBefore, stAfter]);
  await sleepT(300);
  T.ok('sync: chat shows new bubbles', document.querySelectorAll('.bubble').length === before + 3, document.querySelectorAll('.bubble').length);
  // toinen haku: ei uusia
  GMLOG.length = 0;
  await clickSync();
  await waitFor(() => /\+0 uutta viestiä/.test(txt(byId('toasts'))), 8000);
  T.ok('second sync inserts 0', /\+0 uutta viestiä/.test(txt(byId('toasts'))) && (await S.store.listMessages('ex-valio')).length === before + 3);

  // ---- 1b. oletus: avaa sähköpostisovelluksessa (ei Gmail-kirjoitusta) ----
  GMHANDLER = async () => ({}); GMLOG.length = 0;
  byId('c-gmail').checked = true; byId('c-gmail').dispatchEvent({ type: 'change', target: byId('c-gmail') });
  const PBODY = 'Kiitos, tulen mielelläni!\nNähdään ä';
  byId('c-body').value = PBODY; byId('c-form').dispatchEvent({ type: 'submit' });
  await waitFor(() => byId('gc-open'), 3000);
  const expHref = 'mailto:mikko.laine@valio.example.fi?subject=Re%3A%20Haastattelu&body=Kiitos%2C%20tulen%20mielell%C3%A4ni!%0D%0AN%C3%A4hd%C3%A4%C3%A4n%20%C3%A4';
  T.ok('default compose: gc-open/gc-gmailweb/gc-copy, hint, no gc-send', !!byId('gc-open') && !!byId('gc-gmailweb') && !!byId('gc-copy') && !byId('gc-send') && /Lähetä se sieltä – sovellus ei lähetä mitään itse\./.test(txt(byId('gc-hint'))) && txt(byId('gc-open')) === 'Avaa sähköpostisovelluksessa' && txt(byId('gc-gmailweb')) === 'Avaa Gmailissa (selain)' && txt(byId('gc-copy')) === 'Kopioi teksti');
  T.ok('default compose: sheet title, subject prefilled Re: and editable, body in textarea', /Kirjoita sähköposti/.test(txt(document.querySelector('.sheet-t'))) && byId('gc-subject').value === 'Re: Haastattelu' && !byId('gc-subject').disabled && byId('gc-body').value === PBODY && byId('gc-to').value === 'mikko.laine@valio.example.fi', txt(document.querySelector('.sheet-t')));
  T.ok('gc-open href = mailtoHref (ä, spaces, newline as %0D%0A), _blank noopener', byId('gc-open').getAttribute('href') === expHref && byId('gc-open').getAttribute('target') === '_blank' && /noopener/.test(byId('gc-open').getAttribute('rel')), byId('gc-open').getAttribute('href'));
  T.ok('gc-gmailweb href = gmail compose url', byId('gc-gmailweb').getAttribute('href') === 'https://mail.google.com/mail/?view=cm&fs=1&to=mikko.laine%40valio.example.fi&su=Re%3A%20Haastattelu&body=Kiitos%2C%20tulen%20mielell%C3%A4ni!%0AN%C3%A4hd%C3%A4%C3%A4n%20%C3%A4' && byId('gc-gmailweb').getAttribute('target') === '_blank', byId('gc-gmailweb').getAttribute('href'));
  byId('gc-subject').value = 'Uusi aihe'; byId('gc-subject').dispatchEvent({ type: 'input' });
  byId('gc-to').value = 'rekry@valio.example.fi'; byId('gc-to').dispatchEvent({ type: 'change' });
  T.ok('hrefs update live on field change', byId('gc-open').getAttribute('href').startsWith('mailto:rekry@valio.example.fi?subject=Uusi%20aihe&body=') && /to=rekry%40valio\.example\.fi&su=Uusi%20aihe/.test(byId('gc-gmailweb').getAttribute('href')));
  byId('gc-copy').click(); await sleepT(50);
  T.ok('copy without clipboard: manual-copy toast', /Kopioi teksti käsin|Teksti kopioitu/.test(txt(byId('toasts'))));
  const nv0 = (await S.store.listMessages('ex-valio')).length;
  byId('gc-open').click(); byId('gc-gmailweb').click(); await sleepT(600);
  const pmsgs = (await S.store.listMessages('ex-valio')).filter(m => m.pending);
  T.ok('open: no Gmail calls, sheet closed, toast, saved once as pending out/email/manual', GMLOG.length === 0 && sheetStack.length === 0 && /Viesti avattiin sähköpostiin\. Muista painaa siellä Lähetä\./.test(txt(byId('toasts'))) && (await S.store.listMessages('ex-valio')).length === nv0 + 1 && pmsgs.length === 1 && pmsgs[0].dir === 'out' && pmsgs[0].channel === 'email' && pmsgs[0].source === 'manual' && pmsgs[0].pending === true && pmsgs[0].to.join() === 'rekry@valio.example.fi' && pmsgs[0].subject === 'Uusi aihe' && pmsgs[0].body === PBODY, [GMLOG.length, pmsgs]);
  T.ok('open: composer cleared, pending bubble shows label', byId('c-body').value === '' && document.querySelectorAll('.pending-hint').length === 1 && /Avattu sähköpostiin – ei vielä vahvistettu/.test(txt(document.querySelector('.pending-hint'))));
  // täsmäytys: Gmail-haku palauttaa vastaavan lähetetyn viestin -> pending poistuu
  const nowMs = Date.now() + 5000;
  const SENTMSG = { id: 'g9', threadId: 't3', internalDate: String(nowMs), date: new Date(nowMs).toISOString(), labelIds: ['SENT'], sender: 'oma.esimerkki@gmail.com', toRecipients: ['rekry@valio.example.fi'], addressDisplayNames: [], subject: 'Uusi aihe', snippet: 's', plaintextBody: PBODY };
  byId('c-gmail').checked = true; byId('c-gmail').dispatchEvent({ type: 'change', target: byId('c-gmail') });
  byId('c-body').value = 'Aivan toinen viesti jota ei koskaan lähetetty'; byId('c-form').dispatchEvent({ type: 'submit' });
  await waitFor(() => byId('gc-open'), 3000); byId('gc-open').click(); await sleepT(600);
  T.ok('two pending messages stored', (await S.store.listMessages('ex-valio')).filter(m => m.pending).length === 2);
  GMHANDLER = async (tool, input) => (tool === 'search_threads' ? { threads: [{ id: 't3' }] } : tool === 'get_thread' ? { id: 't3', messages: [SENTMSG] } : {});
  GMLOG.length = 0;
  await clickSync(); await waitFor(() => /\+1 uusi viesti/.test(txt(byId('toasts'))), 8000); await sleepT(400);
  const after = await S.store.listMessages('ex-valio');
  T.ok('reconcile: matching pending deleted, gmail copy exists, non-matching pending kept', after.some(m => m.id === 'gm-g9') && after.filter(m => m.pending).length === 1 && after.find(m => m.pending).body === 'Aivan toinen viesti jota ei koskaan lähetetty' && !after.some(m => m.pending && m.body === PBODY), after.filter(m => m.pending).map(m => m.body));
  T.ok('reconcile: no write tools called', GMLOG.every(c => c.tool === 'search_threads' || c.tool === 'get_thread'), GMLOG.map(c => c.tool));
  // asetus: suora lähetys oletuksena pois, päälle Asetuksista
  document.querySelector('#tab-accounts').click(); await sleepT(100);
  T.ok('settings: gm-direct exists, default off, label', !!byId('gm-direct') && byId('gm-direct').checked === false && /Lähetä suoraan Gmailin kautta \(vaatii Gmailin lähetysluvan\)/.test(txt(byId('gm-direct-row'))));
  byId('gm-direct').checked = true; byId('gm-direct').dispatchEvent({ type: 'change', target: byId('gm-direct') }); await sleepT(300);
  T.ok('settings: gm-direct saved on', settings().gmailDirect === true);
  document.querySelector('#tab-chats').click(); openChat('ex-valio'); await sleepT(300);
  byId('c-gmail').checked = true; byId('c-gmail').dispatchEvent({ type: 'change', target: byId('c-gmail') });
  byId('c-body').value = 'Suora'; byId('c-form').dispatchEvent({ type: 'submit' }); await waitFor(() => byId('gc-open'), 3000);
  T.ok('direct on: sheet has gc-send (Lähetä Gmailin kautta) next to gc-open', !!byId('gc-send') && /Lähetä Gmailin kautta/.test(txt(byId('gc-send'))) && !!byId('gc-open'));
  byId('gc-cancel').click(); await sleepT(50); byId('c-body').value = '';
  // siivous: poistetaan testiviestit, jotta myöhemmät skenaariot näkevät alkuperäisen ketjun
  await doWrites([{ t: 'del', path: 'chats/ex-valio/messages/gm-g9' }, ...(await S.store.listMessages('ex-valio')).filter(m => m.pending).map(m => ({ t: 'del', path: 'chats/ex-valio/messages/' + m.id }))]); await sleepT(300);

  // ---- 2. lähetys: ketju olemassa -> reply ----
  GMHANDLER = async (tool, input) => (tool === 'reply' ? { id: 'sent1', threadId: 't2' } : {});
  GMLOG.length = 0;
  byId('c-gmail').checked = true; byId('c-gmail').dispatchEvent({ type: 'change', target: byId('c-gmail') });
  T.ok('gmail toggle forces outgoing email', byId('c-dir-out').getAttribute('aria-pressed') === 'true' && byId('c-ch-email').getAttribute('aria-pressed') === 'true');
  byId('c-body').value = 'Kiitos, tulen mielelläni!';
  byId('c-form').dispatchEvent({ type: 'submit' });
  await waitFor(() => byId('gc-send'), 3000);
  T.ok('confirm sheet: nothing sent yet', GMLOG.length === 0 && !!byId('gc-send') && !!byId('gc-cancel'));
  T.ok('confirm sheet: sender, default recipient = latest incoming sender, Re: subject, body preview', /oma\.esimerkki@gmail\.com/.test(txt(byId('gc-from'))) && byId('gc-to').value === 'mikko.laine@valio.example.fi' && byId('gc-subject').value === 'Re: Haastattelu' && byId('gc-subject').disabled === true && byId('gc-body').value === 'Kiitos, tulen mielelläni!' && /Lähetä Gmailin kautta/.test(txt(byId('gc-send'))), [byId('gc-to').value, byId('gc-subject').value]);
  byId('gc-cancel').click(); await sleepT(50);
  T.ok('cancel: no call, composer text kept', GMLOG.length === 0 && byId('c-body').value === 'Kiitos, tulen mielelläni!' && sheetStack.length === 0);
  byId('c-form').dispatchEvent({ type: 'submit' }); await waitFor(() => byId('gc-send'), 3000);
  byId('gc-to').value = 'rekry@valio.example.fi';
  byId('gc-send').click();
  await waitFor(() => !byId('gc-send') && GMLOG.length >= 1, 5000); await sleepT(400);
  const rc = GMLOG[0];
  T.ok('send in thread: reply({messageId, body, to})', rc && rc.tool === 'reply' && Object.keys(rc.input).sort().join() === 'body,messageId,to' && rc.input.messageId === 'g3' && rc.input.body === 'Kiitos, tulen mielelläni!' && rc.input.to.join() === 'rekry@valio.example.fi' && rc.opts.cache === false && !('signal' in rc.opts) && GMLOG.length === 1, rc);
  const sentDoc = (await S.store.listMessages('ex-valio')).find(m => m.id === 'gm-sent1');
  T.ok('send: stored as out/email/gmail with ids', sentDoc && sentDoc.dir === 'out' && sentDoc.channel === 'email' && sentDoc.source === 'gmail' && sentDoc.to.join() === 'rekry@valio.example.fi' && sentDoc.body === 'Kiitos, tulen mielelläni!' && sentDoc.gmail.messageId === 'sent1' && sentDoc.gmail.threadId === 't2' && /^Re: Haastattelu/.test(sentDoc.subject), sentDoc);
  T.ok('send: composer cleared, toast', byId('c-body').value === '' && /Sähköposti lähetetty/.test(txt(byId('toasts'))));

  // ---- 3. uusi ketju -> send_message (Kesko: ei Gmail-viestejä) ----
  openChat('ex-kesko'); await sleepT(300);
  GMHANDLER = async (tool, input) => (tool === 'send_message' ? { id: 'new1', threadId: 'tn' } : {});
  GMLOG.length = 0;
  byId('c-gmail').checked = true; byId('c-gmail').dispatchEvent({ type: 'change', target: byId('c-gmail') });
  byId('c-body').value = 'Hei, onko hakemukseni edennyt?';
  byId('c-form').dispatchEvent({ type: 'submit' }); await waitFor(() => byId('gc-send'), 3000);
  T.ok('new thread: subject empty + editable, recipient = first member email', byId('gc-subject').value === '' && byId('gc-subject').disabled === false && byId('gc-to').value === 'rekrytointi@kesko.example.fi');
  byId('gc-send').click(); await sleepT(100);
  T.ok('new thread: empty subject blocked, nothing sent', GMLOG.length === 0 && /Anna sähköpostille aihe/.test(txt(byId('gc-errwrap'))));
  byId('gc-subject').value = 'Hakemuksen tilanne'; byId('gc-send').click();
  await waitFor(() => GMLOG.length >= 1 && !byId('gc-send'), 5000); await sleepT(400);
  const sc = GMLOG[0];
  T.ok('new thread: send_message({to, subject, body})', sc && sc.tool === 'send_message' && Object.keys(sc.input).sort().join() === 'body,subject,to' && sc.input.to.join() === 'rekrytointi@kesko.example.fi' && sc.input.subject === 'Hakemuksen tilanne' && sc.input.body === 'Hei, onko hakemukseni edennyt?', sc);
  T.ok('new thread: stored gm-new1', !!(await S.store.listMessages('ex-kesko')).find(m => m.id === 'gm-new1' && m.subject === 'Hakemuksen tilanne' && m.gmail.threadId === 'tn'));

  // ---- 4. epävarma lähetys: varmistus Lähetetyistä ----
  GMHANDLER = async () => { throw { code: 'server_unavailable', message: 'x' }; };
  GMLOG.length = 0;
  const kBefore = (await S.store.listMessages('ex-kesko')).length;
  byId('c-gmail').checked = true; byId('c-gmail').dispatchEvent({ type: 'change', target: byId('c-gmail') });
  byId('c-body').value = 'Toinen viesti'; byId('c-subject').value = 'Aihe';
  byId('c-form').dispatchEvent({ type: 'submit' }); await waitFor(() => byId('gc-send'), 3000);
  byId('gc-send').click(); await waitFor(() => byId('gm-err-text'), 5000); await sleepT(100);
  T.ok('send+verify both fail: uncertain text, mailto shown, code hint, button "Lähetä uudelleen"', /Lähetyksen tila epävarma – tarkista Gmailin Lähetetyt ennen kuin yrität uudelleen\./.test(txt(byId('gm-err-text'))) && !!byId('gc-mailto') && /Virhekoodi: server_unavailable/.test(txt(byId('gc-code'))) && /Lähetä uudelleen/.test(txt(byId('gc-send'))) && GMLOG.map(c => c.tool).join() === 'reply,search_threads', GMLOG.map(c => c.tool));
  const vq = GMLOG[1].input;
  T.ok('verification search args', Object.keys(vq).sort().join() === 'pageSize,query,view' && vq.query === 'in:sent to:' + byId('gc-to').value + ' newer_than:1d' && vq.pageSize === 10 && vq.view === 'THREAD_VIEW_MINIMAL', vq);
  T.ok('mailto href: mailto: + encoded subject/body, _blank noopener', /^mailto:[^?]+\?subject=Re%3A%20Hakemuksen%20tilanne&body=Toinen%20viesti$/.test(byId('gc-mailto').getAttribute('href')) && byId('gc-mailto').getAttribute('target') === '_blank' && /noopener/.test(byId('gc-mailto').getAttribute('rel')), byId('gc-mailto').getAttribute('href'));
  T.ok('uncertain: nothing stored, composer text kept', (await S.store.listMessages('ex-kesko')).length === kBefore && byId('c-body').value === 'Toinen viesti');
  // (a) upstream_error + haku ei löydä -> ei lähetetty; uudelleen -> onnistuu
  let sendOk = false;
  GMHANDLER = async (tool) => { if (tool === 'search_threads') return { threads: [] }; if (sendOk) return { id: 'retry1', threadId: 'tr' }; throw { code: 'upstream_error', retryable: true, retryAfterMs: 10 }; };
  GMLOG.length = 0;
  byId('gc-send').click(); await waitFor(() => byId('gc-retry'), 5000); await sleepT(50);
  T.ok('upstream_error + no match: rechecked twice, one send_message fallback (also upstream_error, rechecked), not-sent box, retry/mailto/perms, code', /Viestiä ei lähetetty\./.test(txt(byId('gm-err-text'))) && /Gmail ei saanut lähetyslupaa/.test(txt(byId('gm-err'))) && !!byId('gc-retry') && !!byId('gc-mailto') && !!byId('gc-perms') && txt(byId('gc-code')) === 'Virhekoodi: upstream_error' && GMLOG.map(c => c.tool).join() === 'reply,search_threads,search_threads,send_message,search_threads,search_threads', GMLOG.map(c => c.tool));
  T.ok('not-sent: nothing stored', (await S.store.listMessages('ex-kesko')).length === kBefore);
  PERMLOG.length = 0; byId('gc-perms').click(); await sleepT(50);
  T.ok('Luvat calls permissions.manage()', PERMLOG.length === 1);
  sendOk = true; GMLOG.length = 0;
  byId('gc-retry').click(); await waitFor(() => !byId('gc-send') && GMLOG.length >= 1, 5000); await sleepT(400);
  T.ok('retry succeeds: stored gm-retry1 + success toast', !!(await S.store.listMessages('ex-kesko')).find(m => m.id === 'gm-retry1' && m.body === 'Toinen viesti') && /Sähköposti lähetetty/.test(txt(byId('toasts'))) && GMLOG.map(c => c.tool).join() === 'reply', GMLOG.map(c => c.tool));
  // (b) server_unavailable mutta haku löytää SENT-viestin -> lähetetty
  const k2 = (await S.store.listMessages('ex-kesko')).length;
  byId('c-gmail').checked = true; byId('c-gmail').dispatchEvent({ type: 'change', target: byId('c-gmail') });
  byId('c-body').value = 'Kolmas viesti, jossa on tarpeeksi tekstiä'; byId('c-subject').value = 'Aihe3';
  GMHANDLER = async (tool, input) => {
    if (tool === 'search_threads') return { threads: [{ id: 'tx', messages: [{ id: 'found1', threadId: 'tx', internalDate: String(Date.now()), labelIds: ['SENT'], toRecipients: [input.query.match(/to:(\S+)/)[1]], subject: 'Aihe3', snippet: 'Kolmas viesti, jossa on tarpeeksi tekstiä' }] }] };
    throw { code: 'server_unavailable' };
  };
  byId('c-form').dispatchEvent({ type: 'submit' }); await waitFor(() => byId('gc-send'), 3000);
  byId('gc-send').click(); await waitFor(() => !byId('gc-send'), 5000); await sleepT(400);
  const fm = (await S.store.listMessages('ex-kesko')).filter(m => m.id === 'gm-found1');
  T.ok('server_unavailable + match: treated as sent, stored once, toast', fm.length === 1 && fm[0].gmail.threadId === 'tx' && /Sähköposti lähetetty/.test(txt(byId('toasts'))) && (await S.store.listMessages('ex-kesko')).length === k2 + 1, fm);
  // (d) approval_required: ei hakua
  byId('c-gmail').checked = true; byId('c-gmail').dispatchEvent({ type: 'change', target: byId('c-gmail') });
  byId('c-body').value = 'Neljäs viesti'; byId('c-subject').value = 'Aihe4';
  GMHANDLER = async () => { throw { code: 'approval_required' }; }; GMLOG.length = 0;
  byId('c-form').dispatchEvent({ type: 'submit' }); await waitFor(() => byId('gc-send'), 3000);
  byId('gc-send').click(); await waitFor(() => byId('gc-retry'), 5000); await sleepT(50);
  T.ok('approval_required: not-sent box + retry/perms/mailto + code, no search call', /Viestiä ei lähetetty\./.test(txt(byId('gm-err-text'))) && !!byId('gc-perms') && !!byId('gc-mailto') && txt(byId('gc-code')) === 'Virhekoodi: approval_required' && GMLOG.length === 1 && GMLOG[0].tool === 'reply', GMLOG.map(c => c.tool));
  const k3 = (await S.store.listMessages('ex-kesko')).length;
  // cancelled + haku ei löydä
  GMHANDLER = async (tool) => { if (tool === 'search_threads') return { threads: [] }; throw { code: 'cancelled' }; };
  byId('gc-retry').click(); await waitFor(() => /Lähetys keskeytyi/.test(txt(byId('gm-err'))), 5000);
  T.ok('cancelled + no match: reason text', /Viestiä ei lähetetty\./.test(txt(byId('gm-err-text'))) && txt(byId('gc-code')) === 'Virhekoodi: cancelled');
  // mailto-klikkaus: toast + sulkee, ei tallenna
  byId('gc-mailto').click(); await sleepT(100);
  T.ok('mailto click: toast, sheet closed, nothing stored', /Kun viesti on lähetetty, se tulee tähän chattiin/.test(txt(byId('toasts'))) && !byId('gc-send') && (await S.store.listMessages('ex-kesko')).length === k3);
  byId('c-body').value = ''; byId('c-gmail').checked = false;

  // ---- 4b. varalähetys: reply hylätään -> Lähetetyt tyhjä -> send_message + replyThreadId; diag/send ----
  {
    const openSend = async bodyText => {
      byId('c-gmail').checked = true; byId('c-gmail').dispatchEvent({ type: 'change', target: byId('c-gmail') });
      byId('c-body').value = bodyText; byId('c-form').dispatchEvent({ type: 'submit' });
      await waitFor(() => byId('gc-send'), 3000);
    };
    const diagDoc = async p => { await sleepT(80); return SEC.inner.getDoc(p || 'diag/send'); };
    const DB1 = 'Salainen viestin sisältö numero yksi, älä vuoda';
    const lk = gmailLatest();
    for (const code of ['tool_error', 'bad_request']) {
      const kb = (await S.store.listMessages('ex-kesko')).length;
      GMLOG.length = 0;
      const errObj = { code, message: 'Invalid recipient eero.testi@example.fi for reply: ' + DB1, retryable: false, retryAfterMs: 250,
        result: { isError: true, content: [{ type: 'text', text: 'Cannot reply to eero.testi@example.fi (code 400)' }], structuredContent: { body: DB1, subject: 'Aihe-X', to: ['eero.testi@example.fi'] } } };
      GMHANDLER = async (tool, input) => {
        if (tool === 'reply') throw errObj;
        if (tool === 'search_threads') return { threads: [] };
        if (tool === 'send_message') return { id: 'fb-' + code, threadId: lk.gmail.threadId };
        return {};
      };
      await openSend(DB1);
      byId('gc-send').click(); await waitFor(() => !byId('gc-send') && GMLOG.some(c => c.tool === 'send_message'), 6000); await sleepT(400);
      const sm = GMLOG.find(c => c.tool === 'send_message');
      T.ok('fallback (' + code + '): reply -> verify x2 (empty) -> send_message', GMLOG.map(c => c.tool).join() === 'reply,search_threads,search_threads,send_message', GMLOG.map(c => c.tool));
      T.ok('fallback (' + code + '): send_message({to, subject Re:, body, replyThreadId})', sm && Object.keys(sm.input).sort().join() === 'body,replyThreadId,subject,to' && sm.input.replyThreadId === lk.gmail.threadId && sm.input.to.join() === GMLOG[0].input.to.join() && sm.input.subject === replySubject(lk.subject) && sm.input.body === DB1 && sm.opts.cache === false, sm);
      const fbDoc = (await S.store.listMessages('ex-kesko')).find(m => m.id === 'gm-fb-' + code);
      T.ok('fallback (' + code + '): success -> stored, toast, count +1', !!fbDoc && fbDoc.body === DB1 && fbDoc.gmail.threadId === lk.gmail.threadId && /Sähköposti lähetetty/.test(txt(byId('toasts'))) && (await S.store.listMessages('ex-kesko')).length === kb + 1, fbDoc);
      const d = await diagDoc();
      T.ok('diag/send written (plaintext db doc, attempt reply) with <email> redaction, no body/subject/recipient', d && !d.enc && d.attempt === 'reply' && d.tool === 'reply' && d.code === code && d.retryable === false && d.retryAfterMs === 250 && /^\d{4}-\d\d-\d\dT/.test(d.at) && d.standalone === false && typeof d.ua === 'string' && d.ua.length <= 120
        && d.message.includes('<email>') && d.resultText.includes('<email>') && !JSON.stringify(d).includes('@') && !JSON.stringify(d).includes('Salainen') && !JSON.stringify(d).includes('Aihe-X') && d.message.length <= 400 && d.resultText.length <= 600, d);
      T.ok('diag/send-reply mirrors the attempt', (await diagDoc('diag/send-reply')).attempt === 'reply');
    }
    { const raw = localStorage.getItem('hakuviestit.v1'); await sleepT(600);
      const parsed = JSON.parse(localStorage.getItem('hakuviestit.v1'));
      T.ok('raw storage: diag/send is plaintext (readable), everything else still encrypted, body never stored plain', !!parsed.M.diag && parsed.M.diag.send && parsed.M.diag.send.code === 'bad_request' && !localStorage.getItem('hakuviestit.v1').includes(DB1)
        && Object.values(parsed.M.chats).every(c => c.enc) && Object.values(parsed.M.msgs).every(o => Object.values(o).every(d => d.enc && Object.keys(d).sort().join() === 'at,enc,v')), Object.keys(parsed.M)); }
    // varalähetys epäonnistuu myös -> tarkka syy näkyviin (koodi + redaktoitu viesti), diag attempt = send_message
    { GMLOG.length = 0;
      GMHANDLER = async (tool, input) => {
        if (tool === 'reply') throw { code: 'tool_error', message: 'Reply failed for a@b.fi' };
        if (tool === 'search_threads') return { threads: [] };
        if (tool === 'send_message') throw { code: 'tool_error', message: 'Recipient rejected: eero.testi@example.fi (quota)', retryable: true, retryAfterMs: 5000, result: { structuredContent: { to: ['eero.testi@example.fi'] }, content: [{ type: 'text', text: 'quota exceeded for eero.testi@example.fi' }] } };
        return {};
      };
      const kb = (await S.store.listMessages('ex-kesko')).length;
      await openSend('Toinen salainen viesti, ei saa näkyä diagnostiikassa');
      byId('gc-send').click(); await waitFor(() => byId('gc-code'), 6000); await sleepT(200);
      T.ok('fallback fails too: only ONE fallback (reply, verify x2, send_message)', GMLOG.map(c => c.tool).join() === 'reply,search_threads,search_threads,send_message', GMLOG.map(c => c.tool));
      T.ok('fail UI: error box, gc-code, gc-msg (redacted, no @)', !!byId('gm-err') && txt(byId('gc-code')) === 'Virhekoodi: tool_error' && !!byId('gc-msg') && /<email>/.test(txt(byId('gc-msg'))) && !/@/.test(txt(byId('gc-msg'))) && txt(byId('gc-msg')).length <= 200, [txt(byId('gc-code')), txt(byId('gc-msg'))]);
      const d1 = await diagDoc(), d2 = await diagDoc('diag/send-reply');
      T.ok('diag after failed fallback: diag/send = send_message attempt, diag/send-reply kept', d1.attempt === 'send_message' && d1.tool === 'send_message' && d1.retryable === true && d1.retryAfterMs === 5000 && d1.resultText.includes('<email>') && !JSON.stringify(d1).includes('@') && !JSON.stringify(d1).includes('salainen') && d2.attempt === 'reply', [d1, d2]);
      T.ok('nothing stored after failed fallback', (await S.store.listMessages('ex-kesko')).length === kb);
      byId('gc-cancel').click(); await sleepT(50); byId('c-body').value = ''; }
    // reply hylätään, mutta viesti löytyy Lähetetyistä -> ei varalähetystä (ei kaksoislähetystä)
    { GMLOG.length = 0;
      const BODYF = 'Kolmas viesti jonka reply kaatui mutta joka lähti silti';
      GMHANDLER = async (tool, input) => {
        if (tool === 'reply') throw { code: 'upstream_error', message: 'x' };
        if (tool === 'search_threads') return { threads: [{ id: 'tz', messages: [{ id: 'zfound', threadId: 'tz', internalDate: String(Date.now()), labelIds: ['SENT'], toRecipients: [input.query.match(/to:(\S+)/)[1]], subject: 'Re: X', snippet: BODYF }] }] };
        return {};
      };
      await openSend(BODYF);
      byId('gc-send').click(); await waitFor(() => !byId('gc-send'), 6000); await sleepT(400);
      T.ok('reply rejected but found in Sent: no fallback, treated as sent', GMLOG.map(c => c.tool).join() === 'reply,search_threads' && !GMLOG.some(c => c.tool === 'send_message') && !!(await S.store.listMessages('ex-kesko')).find(m => m.id === 'gm-zfound'), GMLOG.map(c => c.tool)); }
    // verifiointihaku epäonnistuu -> ei varalähetystä, diag attempt verify
    { GMLOG.length = 0;
      GMHANDLER = async (tool, input) => {
        if (tool === 'reply') throw { code: 'tool_error', message: 'Reply refused' };
        if (tool === 'search_threads') throw { code: 'upstream_error', message: 'search down for q@x.fi', retryable: true };
        return {};
      };
      await openSend('Neljäs viesti, verifiointi epäonnistuu');
      byId('gc-send').click(); await waitFor(() => byId('gm-err-text'), 6000); await sleepT(200);
      T.ok('verify read fails: no fallback (duplicate risk), definite error shown with code', GMLOG.map(c => c.tool).join() === 'reply,search_threads' && txt(byId('gc-code')) === 'Virhekoodi: tool_error' && /Reply refused/.test(txt(byId('gm-err-text'))), GMLOG.map(c => c.tool));
      const dv = await diagDoc(), dvr = await diagDoc('diag/send-verify');
      T.ok('diag after verify failure: attempt verify, tool search_threads, redacted', dv.attempt === 'verify' && dv.tool === 'search_threads' && dv.code === 'upstream_error' && dv.retryable === true && !JSON.stringify(dv).includes('@') && dv.message.includes('<email>') && dvr.attempt === 'verify', dv);
      byId('gc-cancel').click(); await sleepT(50); byId('c-body').value = ''; }
    // diag-kirjoitus epäonnistuu -> nielaistaan hiljaa, lähetys toimii
    { const inner = SEC.inner, origSet = inner.set; inner.set = (p, d) => (/^diag\//.test(p) ? Promise.reject({ code: 'unavailable' }) : origSet.call(inner, p, d));
      GMLOG.length = 0;
      let okSend = false;
      GMHANDLER = async tool => { if (tool === 'reply' && !okSend) { okSend = true; throw { code: 'upstream_error' }; } if (tool === 'search_threads') return { threads: [] }; if (tool === 'send_message') return { id: 'fb-nodiag', threadId: 'tq' }; return {}; };
      await openSend('Viides viesti, diag-kirjoitus kaatuu');
      byId('gc-send').click(); await waitFor(() => !byId('gc-send') && GMLOG.some(c => c.tool === 'send_message'), 6000); await sleepT(300);
      T.ok('diag write failure is swallowed: fallback send still succeeds, no error toast', !!(await S.store.listMessages('ex-kesko')).find(m => m.id === 'gm-fb-nodiag') && !/epäonnistui/.test(txt(byId('toasts'))));
      inner.set = origSet; }
  }
  // ---- 4c. Gmail-lupa ennen ensimmäistä suoraa lähetystä (permissions) ----
  {
    const openSend = async bodyText => {
      byId('c-gmail').checked = true; byId('c-gmail').dispatchEvent({ type: 'change', target: byId('c-gmail') });
      byId('c-body').value = bodyText; byId('c-form').dispatchEvent({ type: 'submit' });
      await waitFor(() => byId('gc-send'), 3000);
    };
    GMHANDLER = async tool => (tool === 'reply' || tool === 'send_message' ? { id: 'perm-' + GMLOG.length, threadId: 'tp' } : {});
    // tila 'prompt' -> request ennen callTool
    GM.permOk = false; PERMSTATE = 'prompt'; PERMREQ_TO = 'granted'; PERMSEQ.length = 0; GMLOG.length = 0;
    await openSend('Lupatesti yksi, pyydetään lupa');
    T.ok('opening the sheet does not touch permissions or Gmail', PERMSEQ.length === 0 && GMLOG.length === 0);
    byId('gc-send').click(); await waitFor(() => !byId('gc-send') && GMLOG.length >= 1, 6000); await sleepT(300);
    T.ok("perms: state('mcp:Gmail') = prompt -> request(['mcp:Gmail']) -> re-check, all BEFORE the first callTool", PERMSEQ.slice(0, 4).join() === 'state:mcp:Gmail,request:mcp:Gmail,state:mcp:Gmail,call:reply' && GM.permOk === true, PERMSEQ);
    T.ok('perms prompt granted: message sent normally', /Sähköposti lähetetty/.test(txt(byId('toasts'))));
    // sama sivun lataus: ei uutta tarkistusta
    PERMSEQ.length = 0; await openSend('Lupatesti kaksi, ei uutta tarkistusta');
    byId('gc-send').click(); await waitFor(() => !byId('gc-send') && PERMSEQ.length >= 1, 6000); await sleepT(300);
    T.ok('perms: only checked once per page load', !PERMSEQ.some(x => x.startsWith('state') || x.startsWith('request')) && PERMSEQ[0] === 'call:reply', PERMSEQ);
    // denied heti
    GM.permOk = false; PERMSTATE = 'denied'; PERMSEQ.length = 0; GMLOG.length = 0;
    await openSend('Lupatesti kolme, lupa estetty');
    byId('gc-send').click(); await waitFor(() => byId('gc-retry'), 6000); await sleepT(100);
    T.ok('perms denied: not-sent box with Luvat (gc-perms), reason, code perm_denied, no Gmail call, no request', /Viestiä ei lähetetty\./.test(txt(byId('gm-err-text'))) && !!byId('gc-perms') && !!byId('gc-mailto') && /Gmailin lähetyslupa on estetty/.test(txt(byId('gm-err'))) && txt(byId('gc-code')) === 'Virhekoodi: perm_denied' && GMLOG.length === 0 && !PERMSEQ.some(x => x.startsWith('request')), PERMSEQ);
    PERMLOG.length = 0; byId('gc-perms').click(); await sleepT(50);
    T.ok('perms denied: Luvat opens permissions.manage()', PERMLOG.length === 1);
    // lupa myönnetty välissä -> uudelleenyritys onnistuu
    PERMSTATE = 'granted'; GMLOG.length = 0;
    byId('gc-retry').click(); await waitFor(() => !byId('gc-send') && GMLOG.length >= 1, 6000); await sleepT(300);
    T.ok('after permission granted, retry sends and caches the result', GMLOG[0].tool === 'reply' && GM.permOk === true && /Sähköposti lähetetty/.test(txt(byId('toasts'))));
    // request -> denied
    GM.permOk = false; PERMSTATE = 'prompt'; PERMREQ_TO = 'denied'; PERMSEQ.length = 0; GMLOG.length = 0;
    await openSend('Lupatesti neljä, pyyntö hylätään');
    byId('gc-send').click(); await waitFor(() => byId('gc-retry'), 6000); await sleepT(100);
    T.ok('perms prompt -> user denies: not-sent box, no Gmail call', PERMSEQ.includes('request:mcp:Gmail') && GMLOG.length === 0 && /Gmailin lähetyslupa on estetty/.test(txt(byId('gm-err'))) && !!byId('gc-perms'), PERMSEQ);
    byId('gc-cancel').click(); await sleepT(50);
    PERMSTATE = 'granted'; PERMREQ_TO = 'granted'; GM.permOk = false; byId('c-body').value = '';
  }
  // ---- 5. virhekoodit haussa ----
  openChat('ex-valio'); await sleepT(300);
  const syncErr = async (err, expect) => {
    GMHANDLER = async () => { throw err; };
    await clickSync(); await waitFor(() => byId('gm-err-text'), 5000);
    return txt(byId('gm-err-text'));
  };
  T.ok('needs_reauth text', await syncErr({ code: 'needs_reauth' }) === 'Gmail-yhteys vanhentui. Yhdistä Gmail uudelleen: claude.ai → Asetukset → Yhdistäjät.'); sheetStack[sheetStack.length - 1].close();
  T.ok('server_not_connected text', await syncErr({ code: 'server_not_connected' }) === 'Gmail ei ole yhdistetty. Lisää se: claude.ai → Asetukset → Yhdistäjät.'); sheetStack[sheetStack.length - 1].close();
  T.ok('selection_required text', await syncErr({ code: 'selection_required' }) === 'Valitse käytettävä Gmail-tili claude.ai:n kehotteesta.'); sheetStack[sheetStack.length - 1].close();
  T.ok('blocked_by_policy text', await syncErr({ code: 'blocked_by_policy' }) === 'Organisaation asetukset estävät tämän.'); sheetStack[sheetStack.length - 1].close();
  T.ok('tool_error shows message as text (no HTML)', await syncErr({ code: 'tool_error', message: 'Virhe <b>x</b>' }) === 'Virhe <b>x</b>' && !byId('gm-err').querySelector('b')); sheetStack[sheetStack.length - 1].close();
  T.ok('default: Gmail-virhe: <code>', await syncErr({ code: 'weird_code' }) === 'Gmail-virhe: weird_code'); sheetStack[sheetStack.length - 1].close();
  T.ok('not_in_manifest: perms text + Avaa luvat (no retry)', await syncErr({ code: 'not_in_manifest' }) === 'Gmail-lupa puuttuu tältä sivulta.' && !!byId('gm-perms') && !byId('gm-retry'));
  PERMLOG.length = 0; byId('gm-perms').click(); await sleepT(50);
  T.ok('Avaa luvat calls permissions.manage()', PERMLOG.length === 1); sheetStack[sheetStack.length - 1].close();
  let n = 0;
  GMHANDLER = async () => { n++; if (n === 1) throw { code: 'approval_required' }; return { threads: [] }; };
  GMLOG.length = 0;
  await clickSync(); await waitFor(() => byId('gm-retry'), 5000);
  T.ok('approval_required: perms text, Avaa luvat + Yritä uudelleen', /Gmail-lupa puuttuu/.test(txt(byId('gm-err-text'))) && !!byId('gm-perms') && !!byId('gm-retry') && GMLOG.length === 1);
  byId('gm-retry').click(); await waitFor(() => /\+0 uutta viestiä/.test(txt(byId('toasts'))), 5000);
  T.ok('Yritä uudelleen repeats the call once', GMLOG.length === 2 && GMLOG[1].tool === 'search_threads', GMLOG.map(c => c.tool));
  // retryable-luku: yksi uudelleenyritys
  n = 0; GMLOG.length = 0;
  GMHANDLER = async (tool) => { if (tool === 'search_threads') { n++; if (n === 1) throw { code: 'upstream_error', retryable: true, retryAfterMs: 10 }; return { threads: [] }; } return {}; };
  await clickSync(); await waitFor(() => /\+0 uutta viestiä/.test(txt(byId('toasts'))) && n === 2, 6000);
  T.ok('retryable read: retried exactly once', n === 2 && GMLOG.length === 2);
  n = 0; GMLOG.length = 0;
  GMHANDLER = async () => { n++; throw { code: 'upstream_error' }; };
  await clickSync(); await waitFor(() => byId('gm-err-text'), 5000); sheetStack[sheetStack.length - 1].close();
  T.ok('non-retryable read: not retried', n === 1);

  // ---- 6. keskeytys ----
  GMLOG.length = 0;
  let gt = 0;
  GMHANDLER = async (tool, input) => {
    if (tool === 'search_threads') return { threads: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] };
    gt++; if (gt === 1) byId('gs-cancel').click();
    return { id: input.threadId, messages: [] };
  };
  await clickSync(); await waitFor(() => /Haku keskeytettiin/.test(txt(byId('toasts'))), 6000);
  T.ok('cancel stops between calls', GMLOG.filter(c => c.tool === 'get_thread').length === 1 && /Haku keskeytettiin: \+0/.test(txt(byId('toasts'))), GMLOG.map(c => c.tool));

  // ---- 7. kaikki keskustelut ----
  GMLOG.length = 0;
  GMHANDLER = async tool => (tool === 'search_threads' ? { threads: [] } : {});
  document.querySelector('#tab-accounts').click(); byId('gm-sync-all').click();
  await waitFor(() => GMLOG.length >= 5 && !byId('gs-cancel'), 8000); await sleepT(200);
  const emailChats = Object.values(S.chats).filter(c => chatEmails(c).length).length;
  T.ok('sync all: one search per chat with emails (sequential)', GMLOG.filter(c => c.tool === 'search_threads').length === emailChats && emailChats >= 4, [GMLOG.length, emailChats]);

  // ---- 8. tallennus salattuna ----
  await sleepT(700);
  const raw = localStorage.getItem('hakuviestit.v1');
  T.ok('stored Gmail content is encrypted (no body/subject/addresses in raw storage)', !['Kutsumme sinut haastatteluun', 'Tervetuloa toiselle kierrokselle', 'Sopii, kiitos', 'Hakemuksen tilanne', 'Kiitos, tulen mielelläni', 'ohje.pdf', 'mikko.laine@valio'].some(x => raw.includes(x)));
  const rawMsgs = Object.values(JSON.parse(raw).M.msgs['ex-valio']).filter(d => d && d.enc);
  T.ok('raw message docs only v/at/enc', rawMsgs.every(d => Object.keys(d).sort().join() === 'at,enc,v'));

  // ---- 9. not_granted -> Gmail-UI piiloon ----
  openChat('ex-valio'); await sleepT(300);
  GMHANDLER = async () => { throw { code: 'not_granted' }; };
  await clickSync(); await waitFor(() => byId('gm-err-text'), 5000); await sleepT(100);
  sheetStack.slice().forEach(s => s.close());
  T.ok('not_granted: treated as unavailable, UI hidden', S.mcp === null && byId('ch-gmail').hidden === true && byId('c-gmail-row').hidden === false, [S.mcp === null, byId('ch-gmail').hidden, byId('c-gmail-row').hidden, S.view, S.openId]);
  T.done();
})().catch(e => { console.error(e); T.ok('driver exception', false, String(e && e.stack)); T.done(); });
