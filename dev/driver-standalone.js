(async () => {
  const txt = el => el ? el.textContent : null;
  const byId = id => document.querySelector('#' + id);
  await doSetup();
  T.ok('standalone flag', STANDALONE === true);
  T.ok('local mode + idb backend', S.mode === 'local' && S.store.backend === 'idb', [S.mode, S.store && S.store.backend]);
  T.ok('claude.use never called (window.claude undefined)', window.claude === undefined);
  T.ok('no preview banner; example notice', !byId('banner').hidden && /Esimerkkitiedot/.test(txt(byId('banner'))) && !/Esikatselu/.test(txt(byId('banner'))), txt(byId('banner')));
  T.ok('5 chats seeded', Object.keys(S.chats).length === 5);
  await sleepT(600);
  T.ok('idb docs persisted (36 + meta/crypto)', IDB_DATA.docs.size === 37 && IDB_DATA.meta.get('seeded') === true && IDB_DATA.docs.has('meta/crypto'), IDB_DATA.docs.size);
  const idbStr = JSON.stringify([...IDB_DATA.docs.entries()]);
  T.ok('idb holds no plaintext', !SECRET_NAMES.some(n => idbStr.includes(n)), SECRET_NAMES.filter(n => idbStr.includes(n)));
  T.ok('idb docs encrypted (except crypto)', [...IDB_DATA.docs.entries()].filter(([k]) => k !== 'meta/crypto').every(([k, v]) => v.enc && v.enc.iv && v.enc.ct));
  T.ok('localStorage not used', localStorage.getItem('hakuviestit.v1') === null);
  document.querySelector('#tab-import').click();
  T.ok('standalone: #imp-mail-na visible (claude.ai-versiossa), #imp-files open', byId('imp-mail-na').hidden === false && /Suora haku toimii claude.ai-versiossa/.test(txt(byId('imp-mail-na'))) && byId('imp-files').open === true && byId('imp-mail-controls').hidden === true);
  T.ok('standalone: no AI import card, no "Claude lukee"', !imp.ui.aiCard && !imp.ui.saCard && !/Claude lukee/.test(txt(byId('v-import'))));
  document.querySelector('#tab-accounts').click();
  T.ok('backup button visible in standalone', byId('acc-download').hidden === false);
  // varmuuskopio: share ei saatavilla -> a[download]
  let anchor = null;
  const origAppend = document.body.append.bind(document.body);
  document.body.append = (...k) => { k.forEach(x => { if (x.tagName === 'A') anchor = x; }); origAppend(...k); };
  await exportBackup();
  T.ok('backup via anchor download', anchor && /^hakuviestit-varmuuskopio-\d{4}-\d{2}-\d{2}\.json$/.test(anchor.attrs.download) && /^blob:/.test(anchor.attrs.href), anchor && anchor.attrs);
  // sähköpostin kirjoitus ilman Gmailia: mailto-polku
  document.querySelector('#tab-chats').click(); byId('chat-ex-valio').click(); await sleepT(300);
  T.ok('standalone: composer email toggle visible, no Gmail header button', byId('c-gmail-row').hidden === false && byId('ch-gmail').hidden === true);
  byId('c-gmail').checked = true; byId('c-gmail').dispatchEvent({ type: 'change', target: byId('c-gmail') });
  byId('c-body').value = 'Hei, kiitos!'; byId('c-form').dispatchEvent({ type: 'submit' }); await waitFor(() => byId('gc-open'), 3000);
  T.ok('standalone: compose sheet has mailto gc-open, no gc-send', /^mailto:[^?]+\?subject=.*&body=Hei%2C%20kiitos!$/.test(byId('gc-open').getAttribute('href')) && !byId('gc-send') && byId('gc-to').value.includes('@'), byId('gc-open').getAttribute('href'));
  byId('gc-open').click(); await sleepT(600);
  T.ok('standalone: pending message saved', (await S.store.listMessages('ex-valio')).some(m => m.pending === true && m.body === 'Hei, kiitos!'));
  // esimerkkien poisto ja uudelleenkäynnistys
  byId('acc-example').click(); await sleepT(50); byId('cf-ok').click(); await sleepT(800);
  T.ok('examples removed', Object.keys(S.chats).length === 0 && byId('banner').hidden === true, [Object.keys(S.chats), byId('banner').hidden]);
  T.ok('idb emptied of chats', [...IDB_DATA.docs.keys()].every(k => !k.startsWith('chats/')), [...IDB_DATA.docs.keys()]);
  const b2 = await makeIdbBackend();
  const st2 = await makeLocalStore(b2);
  T.ok('reload does not reseed', st2.isSeeded() === true && Object.keys(await new Promise(r => st2.watchChats(r))).length === 0);
  // oma sisältö säilyy uudelleenkäynnistyksen yli
  await S.store.set('chats/ctest', { name: 'Oma', company: '', status: 'muu', notes: '', members: [], createdAt: nowIso(), updatedAt: nowIso(), stats: computeStats([]) });
  await sleepT(700);
  const st3 = await makeLocalStore(await makeIdbBackend());
  T.ok('own data survives reload', Object.keys(await new Promise(r => st3.watchChats(r))).join() === 'ctest');
  T.done();
})().catch(e => { console.error(e); T.ok('driver exception', false, String(e && e.stack)); T.done(); });
