// Natiivikuoren (Capacitor / WKWebView) testit: Face ID Keychainin kautta, varmuuskopio jakamisvalikon kautta. Liitännäiset ovat valeita (test-dom.js, NBX / FSX / SHX).
(async () => {
  const txt = el => el ? el.textContent : null;
  const byId = id => document.querySelector('#' + id);
  const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
  const CREDLOG = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: IOS_UA, maxTouchPoints: 5,
    credentials: { create: async () => { CREDLOG.push('create'); throw new Error('WebAuthn ei saa kutsua natiivissa'); }, get: async () => { CREDLOG.push('get'); throw new Error('WebAuthn ei saa kutsua natiivissa'); } } } });
  const storedCrypto = () => IDB_DATA.docs.get('meta/crypto');
  const closeSheets = () => sheetStack.slice().forEach(x => x.close());
  const submitPw = async (id, formId, pw) => { byId(id).value = pw; byId(formId).dispatchEvent({ type: 'submit' }); };
  const kids = () => [...document.querySelector('.lock-card').children].map(c => c.id);
  const NB_BAD = 'vaara-salasana-99';
  const PWN = 'uusi-salasana-77';

  // ---------- käyttöönotto tarjouksesta (ensimmäisen salasanan jälkeen) ----------
  T.ok('native: detected', isNativeApp() === true && bioSupported() === true);
  await doSetup();
  T.ok('native offer: shown after first password setup (isAvailable checked first)', await waitFor(() => !!byId('bio-offer-go'), 4000) && NBX.log[0] === 'isAvailable' && /Face ID käyttöön\?/.test(txt(byId('layers'))), [NBX.log, txt(byId('layers'))]);
  T.ok('native offer: no Safari / Koti-valikko wording, nothing stored yet', !/Safari|Koti-valikko/.test(txt(byId('layers'))) && NBX.setCalls.length === 0 && !SEC.meta.bio);
  byId('bio-offer-go').click(); await waitFor(() => SEC.meta.bio, 4000); await sleepT(900);
  T.ok('native enroll: setData once with key hv-pw, accessControl 2, value = typed password', NBX.setCalls.length === 1 && NBX.setCalls[0].key === 'hv-pw' && NBX.setCalls[0].accessControl === 2 && NBX.setCalls[0].value === PW, NBX.setCalls.map(c => Object.assign({}, c, { value: '(…)' })));
  T.ok('native enroll: meta.bio = {v:1, native:true} in memory and stored', JSON.stringify(SEC.meta.bio) === '{"v":1,"native":true}' && JSON.stringify(storedCrypto().bio) === '{"v":1,"native":true}', [SEC.meta.bio, storedCrypto().bio]);
  T.ok('native enroll: toast, sheet closed, offer flag clear', /Face ID otettu käyttöön/.test(txt(byId('toasts'))) && sheetStack.length === 0 && localStorage.getItem('hv-bio-offer') === null);
  const allStored = JSON.stringify([...IDB_DATA.docs.entries()]);
  T.ok('native enroll: password nowhere in app storage (IDB docs + meta)', !allStored.includes(PW) && !JSON.stringify([...IDB_DATA.meta.entries()]).includes(PW) && !JSON.stringify(SEC.meta).includes(PW));
  T.ok('native enroll: WebAuthn never called', CREDLOG.length === 0);

  // ---------- asetusnäkymä ----------
  document.querySelector('#tab-accounts').click(); await sleepT(100);
  T.ok('native settings: off button visible, on hidden', byId('sec-bio-off').hidden === false && byId('sec-bio-on').hidden === true && txt(byId('sec-bio-off')) === 'Poista Face ID käytöstä');

  // ---------- lukitusnäkymä: automaattinen Face ID ----------
  const g0 = NBX.getCalls.length;
  lockNow(); await waitFor(() => !S.locked, 4000); await sleepT(300);
  T.ok('native lock: auto getSecureData exactly once, unlocks without tap', NBX.getCalls.length === g0 + 1 && S.locked === false && failState().n === 0 && Object.keys(S.chats).length === 5, [NBX.getCalls.length - g0, S.locked]);
  T.ok('native lock: getSecureData asks key hv-pw with a reason', NBX.getCalls[g0].key === 'hv-pw' && typeof NBX.getCalls[g0].reason === 'string' && NBX.getCalls[g0].reason.length > 3, NBX.getCalls[g0]);

  // ---------- peruutus: ei virhettä, ei laskuria ----------
  NBX.getErr = { message: 'User canceled biometric authentication', code: '16' };
  const g1 = NBX.getCalls.length;
  lockNow(); await waitFor(() => NBX.getCalls.length > g1 && !byId('unlock-hint').hidden, 4000); await sleepT(100);
  T.ok('native auto cancel: one call, no hv-fails, no red error, quiet hint, still locked', NBX.getCalls.length === g1 + 1 && S.locked && localStorage.getItem('hv-fails') === null && byId('lock-err').hidden === true && /Napauta/.test(txt(byId('unlock-hint'))) && !!byId('unlock-bio'), [NBX.getCalls.length - g1, byId('lock-err').hidden, txt(byId('unlock-hint'))]);
  T.ok('native lock screen: unlock-bio above password form', kids().indexOf('unlock-bio') < kids().indexOf('lock-form') && txt(byId('unlock-bio')) === 'Avaa Face ID:llä', kids());
  byId('unlock-bio').click(); await waitFor(() => NBX.getCalls.length > g1 + 1 && byId('unlock-bio').disabled === false, 4000); await sleepT(50);
  T.ok('native manual cancel: no hv-fails, no red error, password field focused', NBX.getCalls.length === g1 + 2 && localStorage.getItem('hv-fails') === null && byId('lock-err').hidden === true && !!document.activeElement && document.activeElement.id === 'lock-pw', [localStorage.getItem('hv-fails'), byId('lock-err').hidden]);
  NBX.getErr = { message: 'Biometric authentication failed', code: '10' };
  byId('unlock-bio').click(); await waitFor(() => !byId('lock-err').hidden, 4000);
  T.ok('native manual failure (not retrieved): fail text, still no hv-fails count', txt(byId('lock-err')) === 'Face ID -avaus epäonnistui. Kirjoita salasana.' && localStorage.getItem('hv-fails') === null && S.locked, txt(byId('lock-err')));

  // ---------- väärä (haettu) salasana lasketaan ----------
  NBX.getErr = null; NBX.override = NB_BAD;
  byId('unlock-bio').click(); await waitFor(() => failState().n === 1, 6000); await sleepT(50);
  T.ok('native: retrieved-but-wrong password counts one failure + fail text', failState().n === 1 && localStorage.getItem('hv-fails') === '1' && txt(byId('lock-err')) === 'Face ID -avaus epäonnistui. Kirjoita salasana.' && S.locked, [failState(), txt(byId('lock-err'))]);
  NBX.override = null;
  byId('unlock-bio').click(); await waitFor(() => !S.locked, 6000); await sleepT(400);
  T.ok('native: correct stored password unlocks and clears fails', S.locked === false && failState().n === 0 && localStorage.getItem('hv-fails') === null);

  // ---------- Keychain-kohde puuttuu / mitätöity (koodi 21) ----------
  NBX.getErr = { message: 'No protected data found for key', code: '21' };
  const g2 = NBX.getCalls.length;
  lockNow(); await waitFor(() => !storedCrypto().bio && !byId('unlock-hint').hidden, 4000); await sleepT(200);
  T.ok('native code 21: bio meta removed from storage + memory, calm hint, unlock-bio gone, no hv-fails', NBX.getCalls.length === g2 + 1 && !storedCrypto().bio && !SEC.metaRaw.bio && /Face ID -avaus ei ole enää käytössä\. Avaa salasanalla ja ota Face ID uudelleen käyttöön Tietosuoja-osiossa\./.test(txt(byId('unlock-hint'))) && (!byId('unlock-bio') || byId('unlock-bio').hidden === true) && localStorage.getItem('hv-fails') === null && byId('lock-err').hidden === true, [storedCrypto().bio, txt(byId('unlock-hint'))]);
  T.ok('native code 21: lock meta stays intact (check/salt/kdf kept)', !!storedCrypto().check && !!storedCrypto().salt && storedCrypto().v === 1, Object.keys(storedCrypto()));
  NBX.getErr = null; NBX.stored = null;
  // numeerinen koodi 21 + viesti tunnistetaan myös (toinen kierros alla); salasanalla sisään
  T.ok('native code 21: password still unlocks', await doUnlock(PW) && Object.keys(S.chats).length === 5);
  T.ok('native: offer returns after password unlock (bio off, no "no" flag)', await waitFor(() => !!byId('bio-offer-go'), 4000));
  // ---------- tarjous: Face ID ei käytettävissä -> ei tarjousta ----------
  closeSheets(); NBX.avail = false;
  lockNow(); await sleepT(300);
  T.ok('native: no bio button when meta has no bio', !byId('unlock-bio') && !!byId('lock-pw'));
  const sc0 = NBX.setCalls.length;
  T.ok('native unavailable: password unlock ok, no offer sheet', await doUnlock(PW) && (await sleepT(400), !byId('bio-offer-go')) && sheetStack.length === 0);
  // asetuksista käyttöönotto, kun Face ID ei ole käytettävissä
  document.querySelector('#tab-accounts').click(); await sleepT(100);
  T.ok('native unavailable: settings still offers the button (plugin present)', byId('sec-bio-on').hidden === false);
  byId('sec-bio-on').click(); await sleepT(50);
  await submitPw('bio-pw', 'bio-form', PW); await waitFor(() => byId('bio-go') && !byId('bio-go').hidden, 4000);
  byId('bio-go').click(); await waitFor(() => !byId('bio-err').hidden, 4000);
  T.ok('native unavailable: native-specific text, no Safari/Koti-valikko, nothing stored', txt(byId('bio-err')) === 'Face ID ei ole käytettävissä. Ota Face ID käyttöön iPhonen asetuksista (Asetukset → Face ID ja pääsykoodi).' && NBX.setCalls.length === sc0 && !SEC.meta.bio && !storedCrypto().bio, txt(byId('bio-err')));
  closeSheets(); NBX.avail = true;

  // ---------- asetuksista käyttöönotto: väärä salasana ei tallenna mitään ----------
  byId('sec-bio-on').click(); await sleepT(50);
  await submitPw('bio-pw', 'bio-form', NB_BAD); await waitFor(() => !byId('bio-err').hidden, 4000);
  T.ok('native settings enroll: wrong password rejected, setData not called', /Salasana ei kelpaa/.test(txt(byId('bio-err'))) && NBX.setCalls.length === sc0 && !SEC.meta.bio);
  await submitPw('bio-pw', 'bio-form', PW); await waitFor(() => byId('bio-go') && !byId('bio-go').hidden, 4000);
  T.ok('native settings enroll: password checked, setData waits for the tap', NBX.setCalls.length === sc0);
  byId('bio-go').click(); await waitFor(() => SEC.meta.bio, 4000); await sleepT(900);
  T.ok('native settings enroll: setData(hv-pw, accessControl 2, password), meta {v:1,native:true}', NBX.setCalls.length === sc0 + 1 && NBX.setCalls[sc0].key === 'hv-pw' && NBX.setCalls[sc0].accessControl === 2 && NBX.setCalls[sc0].value === PW && JSON.stringify(storedCrypto().bio) === '{"v":1,"native":true}' && byId('sec-bio-off').hidden === false, NBX.setCalls[sc0] && NBX.setCalls[sc0].key);
  // setData epäonnistuu (esim. pääsykoodia ei ole asetettu)
  byId('sec-bio-off').click(); await waitFor(() => !SEC.meta.bio, 4000); await sleepT(900);
  T.ok('native disable: deleteData({key:hv-pw}) called, meta.bio removed (memory + storage), toast, on button back', NBX.delCalls.length >= 1 && NBX.delCalls[NBX.delCalls.length - 1].key === 'hv-pw' && !SEC.meta.bio && !storedCrypto().bio && NBX.stored === null && /Face ID poistettu käytöstä/.test(txt(byId('toasts'))) && byId('sec-bio-on').hidden === false && byId('sec-bio-off').hidden === true, NBX.delCalls);
  NBX.setErr = { message: 'Failed to store', code: '0' };
  byId('sec-bio-on').click(); await sleepT(50);
  await submitPw('bio-pw', 'bio-form', PW); await waitFor(() => byId('bio-go') && !byId('bio-go').hidden, 4000);
  byId('bio-go').click(); await waitFor(() => !byId('bio-err').hidden, 4000);
  T.ok('native: setData failure -> unsupported text, no bio meta', /^Face ID ei ole käytettävissä\./.test(txt(byId('bio-err'))) && !SEC.meta.bio && !storedCrypto().bio);
  closeSheets(); NBX.setErr = null;

  // ---------- numeerinen koodi 21 tai pelkkä viesti tunnistetaan ----------
  byId('sec-bio-on').click(); await sleepT(50);
  await submitPw('bio-pw', 'bio-form', PW); await waitFor(() => byId('bio-go') && !byId('bio-go').hidden, 4000);
  byId('bio-go').click(); await waitFor(() => SEC.meta.bio, 4000); await sleepT(900);
  NBX.getErr = { message: 'No protected data found for key' };
  lockNow(); await waitFor(() => !storedCrypto().bio, 4000); await sleepT(100);
  T.ok('native: error recognised by message "No protected data" alone', !storedCrypto().bio && S.locked && !!byId('lock-pw'));
  NBX.getErr = null;
  await doUnlock(PW); closeSheets();

  // ---------- varmuuskopio: Filesystem.writeFile + Share.share, ei ankkurilatausta ----------
  localStorage.setItem('hv-bio-offer', 'no');
  document.querySelector('#tab-accounts').click(); await sleepT(100);
  let anchor = null;
  const origAppend = document.body.append.bind(document.body);
  document.body.append = (...k) => { k.forEach(x => { if (x.tagName === 'A') anchor = x; }); origAppend(...k); };
  await exportBackup(); await sleepT(100);
  const wr = FSX.written[0], sh = SHX.shared[0];
  T.ok('backup native: writeFile CACHE utf8 with dated filename', FSX.written.length === 1 && /^hakuviestit-varmuuskopio-\d{4}-\d{2}-\d{2}\.json$/.test(wr.path) && wr.directory === 'CACHE' && wr.encoding === 'utf8' && typeof wr.data === 'string', wr && Object.assign({}, wr, { data: '(…)' }));
  const bk = JSON.parse(wr.data);
  T.ok('backup native: content is the encrypted backup (no plaintext names)', bk.app === 'hakuviestit' && bk.encrypted === true && !!bk.enc && !SECRET_NAMES.some(n => wr.data.includes(n)));
  T.ok('backup native: share called with title, file uri and dialogTitle', SHX.shared.length === 1 && sh.title === wr.path && sh.url === 'file:///cache/' + wr.path && sh.dialogTitle === 'Tallenna varmuuskopio', sh);
  T.ok('backup native: temp file deleted after share (order write, share, delete), directory CACHE', SHX.order.join() === 'writeFile,share,deleteFile' && FSX.deleted.length === 1 && FSX.deleted[0].path === wr.path && FSX.deleted[0].directory === 'CACHE', SHX.order);
  T.ok('backup native: no anchor download, success toast', anchor === null && /Varmuuskopio valmis/.test(txt(byId('toasts'))), [anchor && anchor.attrs, txt(byId('toasts'))]);
  // käyttäjä sulkee jakamisvalikon
  byId('toasts').replaceChildren(); SHX.err = { message: 'Share canceled' };
  await exportBackup(); await sleepT(100);
  T.ok('backup native: share canceled -> silent (no ready/failure toast), temp file still deleted', SHX.shared.length === 2 && FSX.deleted.length === 2 && !/Varmuuskopio valmis|ei onnistunut/.test(txt(byId('toasts'))), txt(byId('toasts')));
  // kirjoitus epäonnistuu
  SHX.err = null; FSX.failWrite = true; byId('toasts').replaceChildren();
  await exportBackup(); await sleepT(100);
  T.ok('backup native: write failure -> error toast, share not called', /Latauksen aloitus ei onnistunut/.test(txt(byId('toasts'))) && SHX.shared.length === 2, txt(byId('toasts')));
  FSX.failWrite = false;
  document.body.append = origAppend;

  // ---------- varmuuskopion palautus: tiedostovalitsin toimii kuten ennenkin (restoreF) ----------
  T.ok('restore: file input exists in accounts view', !!document.querySelector('#acc-restore') || document.querySelectorAll('input').some(i => i.attrs.type === 'file'));

  // ---------- liitännäisen haku ilman registerPlugin-funktiota (pelkkä natiivisilta) ----------
  {
    const saved = globalThis.Capacitor, calls = [];
    globalThis.Capacitor = { isNativePlatform: () => true, nativePromise: async (p, m, o) => { calls.push([p, m, o]); return { isAvailable: true }; } };
    const nb = nativePlugin('NativeBiometric');
    const r = await nb.isAvailable();
    T.ok('nativePlugin fallback via Capacitor.nativePromise (no registerPlugin)', r.isAvailable === true && calls.length === 1 && calls[0][0] === 'NativeBiometric' && calls[0][1] === 'isAvailable' && nb.then === undefined && bioSupported() === true, calls);
    globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { NativeBiometric: { marker: 1 } } };
    T.ok('nativePlugin fallback via Capacitor.Plugins', nativePlugin('NativeBiometric').marker === 1);
    globalThis.Capacitor = { isNativePlatform: () => false, registerPlugin: () => ({}) };
    T.ok('isNativeApp false when isNativePlatform() is false (web path)', isNativeApp() === false);
    delete globalThis.Capacitor;
    T.ok('isNativeApp false without Capacitor', isNativeApp() === false);
    globalThis.Capacitor = saved;
  }

  // ---------- salasanan vaihto poistaa Keychain-kohteen ----------
  closeSheets();
  document.querySelector('#tab-accounts').click(); await sleepT(100);
  byId('sec-bio-on').click(); await sleepT(50);
  await submitPw('bio-pw', 'bio-form', PW); await waitFor(() => byId('bio-go') && !byId('bio-go').hidden, 4000);
  byId('bio-go').click(); await waitFor(() => SEC.meta.bio, 4000); await sleepT(900);
  T.ok('native: bio enabled before password change', !!SEC.meta.bio && NBX.stored === PW);
  const d0 = NBX.delCalls.length; byId('toasts').replaceChildren();
  byId('sec-change').click(); await sleepT(50);
  byId('cp-old').value = PW; byId('cp-new1').value = PWN; byId('cp-new2').value = PWN; byId('cp-form').dispatchEvent({ type: 'submit' });
  await waitFor(() => /Salasana vaihdettu/.test(txt(byId('toasts'))), 15000); await waitFor(() => /vaihdon vuoksi/.test(txt(byId('toasts'))), 6000); await sleepT(900);
  T.ok('native password change: deleteData called, stored secret gone, meta.bio cleared, hint toast', NBX.delCalls.length === d0 + 1 && NBX.delCalls[d0].key === 'hv-pw' && NBX.stored === null && !SEC.meta.bio && !storedCrypto().bio && /Face ID poistettiin käytöstä salasanan vaihdon vuoksi/.test(txt(byId('toasts'))), [NBX.delCalls.length - d0, txt(byId('toasts'))]);
  lockNow(); await sleepT(300);
  T.ok('after password change: no bio button, new password unlocks', !byId('unlock-bio') && await doUnlock(PWN));
  closeSheets();

  // ---------- Aloita alusta tyhjentää Keychain-kohteen ----------
  NBX.stored = 'jaannos';
  const d1 = NBX.delCalls.length;
  lockNow(); await sleepT(200);
  byId('lock-forgot').click(); await sleepT(50);
  const w = byId('sec-reset-word'); w.value = 'POISTA'; w.dispatchEvent({ type: 'input', target: w });
  byId("sec-reset-go").click(); await waitFor(() => byId("sec-setup-form"), 6000); await sleepT(900);
  T.ok('native reset: deleteData called, setup screen shown, data gone', NBX.delCalls.length === d1 + 1 && NBX.delCalls[d1].key === 'hv-pw' && NBX.stored === null && !!byId('sec-setup-form') && [...IDB_DATA.docs.keys()].length === 0, [NBX.delCalls.length - d1, [...IDB_DATA.docs.keys()]]);

  // ---------- WebAuthn ei koskaan natiivissa ----------
  T.ok('WebAuthn (navigator.credentials) never called during the whole native run', CREDLOG.length === 0, CREDLOG);
  T.done();
})().catch(e => { console.error(e); T.ok('driver exception', false, String(e && e.stack)); T.done(); });
