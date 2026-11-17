/* ===== Tietosuoja: salasana, salaus, lukitus ===== */
const SEC = { inner: null, wstore: null, meta: null, metaRaw: null, key: null, unsubs: [], last: Date.now(), hiddenAt: 0, timer: null, waitTimer: null };
// Uusissa asetuksissa automaattinen lukitus on 2 min (meta.lm = 2). Vanhoilla käyttäjillä (ei lm-kenttää) oletus pysyy 5 min eikä tallennettuja valintoja muuteta.
const DEFAULT_SETTINGS = { lockMin: 2, hidePreview: false, gmailDirect: false };
function settings() {
  const lm = SEC.meta ? (SEC.meta.lm || 5) : DEFAULT_SETTINGS.lockMin;
  return Object.assign({}, DEFAULT_SETTINGS, { lockMin: lm }, (S.profile && S.profile.settings) || {});
}
S.locked = true;

/* ----- Epäonnistuneet yritykset: laskuri muistissa ja localStoragessa (voi heittää -> try/catch) ----- */
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { /* ei localStoragea */ } };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { /* ei localStoragea */ } };
const FAIL = { n: 0, until: 0 };
function failState() {
  return { n: Math.max(FAIL.n, +(lsGet('hv-fails') || 0) || 0), until: Math.max(FAIL.until, +(lsGet('hv-until') || 0) || 0) };
}
function recordFail() {
  const n = failState().n + 1, d = unlockDelayMs(n);   // 5 virhettä ilmaiseksi, sitten 30 s, 60 s, 120 s ... enintään 15 min
  FAIL.n = n; FAIL.until = d ? Date.now() + d : 0;
  lsSet('hv-fails', n); if (d) lsSet('hv-until', FAIL.until); else lsDel('hv-until');
}
function clearFails() { FAIL.n = 0; FAIL.until = 0; lsDel('hv-fails'); lsDel('hv-until'); }
const fmtWait = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return pad2(Math.floor(t / 60)) + ':' + pad2(t % 60); };
const bioUA = () => (typeof navigator !== 'undefined' && navigator.userAgent) || '';
/* ----- Natiivikuori (Capacitor, iPhone-sovellus): Face ID Keychainin kautta, tiedostot jakamisvalikon kautta ----- */
const isNativeApp = () => {
  try { const C = typeof window !== 'undefined' && window.Capacitor; return !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform()); }
  catch (e) { return false; }
};
// Capacitor-liitännäinen ilman bundleria: registerPlugin jos olemassa, muuten Plugins-kokoelma tai suoraan natiivisilta (nativePromise)
const nativePlugin = name => {
  try {
    const C = window.Capacitor;
    if (!C) return null;
    if (typeof C.registerPlugin === 'function') return C.registerPlugin(name) || null;
    if (C.Plugins && C.Plugins[name]) return C.Plugins[name];
    if (typeof C.nativePromise === 'function') return new Proxy({}, { get: (t, m) => (typeof m === 'string' && m !== 'then' ? (opts => C.nativePromise(name, m, opts || {})) : undefined) });
  } catch (e) { /* ei liitännäistä */ }
  return null;
};
const BS = () => bioStrings(bioUA(), isNativeApp());
// Alustava tuki: lopullisen tuen ratkaisee yritys (selain voi silti kieltäytyä; natiivissa isAvailable ennen käyttöönottoa)
const bioSupported = () => {
  if (isNativeApp()) return !!nativePlugin('NativeBiometric');
  try { return !!(typeof window !== 'undefined' && window.PublicKeyCredential && navigator.credentials && typeof location !== 'undefined' && location.hostname && window.isSecureContext !== false); }
  catch (e) { return false; }
};
/* Natiivi biometria: salasana on vain iOS Keychainin suojatussa kohteessa (biometryAny), jonka Face ID avaa. Muualle sitä ei tallenneta. */
const NB_KEY = 'hv-pw';
const nbCode = e => (e && e.code != null ? String(e.code) : '');
const nbGone = e => nbCode(e) === '21' || /No protected data/i.test(String((e && e.message) || ''));   // kohdetta ei ole tai se on mitätöity
const nbCancelled = e => nbCode(e) === '16' || /cancel/i.test(String((e && e.message) || ''));
async function nativeBioAvailable() {
  const nb = nativePlugin('NativeBiometric');
  if (!nb) return false;
  try { const r = await nb.isAvailable(); return !!(r && r.isAvailable); } catch (e) { return false; }
}
// Palauttaa tallennetun salasanan merkkijonona (Face ID -kysely tulee Keychainista) tai heittää
async function nativeBioFetch() {
  const nb = nativePlugin('NativeBiometric');
  if (!nb) throw { code: 'unavailable' };
  const r = await nb.getSecureData({ key: NB_KEY, reason: 'Avaa Hakuviestit' });
  return r && typeof r.value === 'string' ? r.value : null;
}
// Poistaa Keychain-kohteen; virheet ohitetaan
async function nativeBioClear() {
  if (!isNativeApp()) return;
  try { const nb = nativePlugin('NativeBiometric'); if (nb) await nb.deleteData({ key: NB_KEY }); } catch (e) { /* ei väliä */ }
}
const bioMetaUsable = b => !!b && (b.native === true ? isNativeApp() : (!isNativeApp() && !!b.credId));
const stable = o => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)) ? Object.keys(v).sort().reduce((a, x) => { a[x] = v[x]; return a; }, {}) : v);

/* ----- Lukitus- ja asetusnäkymät ----- */
function showLockLayer() {
  if (SEC.unlockDispose) { try { SEC.unlockDispose(); } catch (e) { /* ok */ } }   // edellisen lukitusnäkymän automaattikäynnistys pois
  SEC.unlockInst = null;
  const el = $('#lock');
  el.hidden = false; el.replaceChildren();
  $('#app').hidden = true; $('#fabwrap').hidden = true; $('#tabbar').hidden = true; $('#lockfab').hidden = true;
  document.documentElement.classList.add('locked');
  return el;
}
function lockCard(title, ...kids) {
  return h('div', { class: 'lock-card' }, h('div', { class: 'lock-ico' }, ico('lock', 30, 1.6)), h('div', { class: 'lock-brand', text: 'Hakuviestit' }), h('h1', { text: title }), ...kids);
}
function showLoadingLock() { const el = showLockLayer(); el.append(lockCard('Ladataan…')); }
function showSecurityError(msg) {
  const el = showLockLayer();
  el.append(lockCard('Tallennus ei vastaa', h('p', { class: 'hint', text: msg }), h('button', { class: 'btn primary block', type: 'button', id: 'sec-retry', text: 'Yritä uudelleen', onclick: () => bootSecurity() })));
}
function pwToggle(inputs) {
  return h('button', { type: 'button', class: 'small-btn', id: 'sec-show', text: 'Näytä salasana', onclick: e => {
    const on = inputs[0].type === 'password';
    inputs.forEach(i => { i.type = on ? 'text' : 'password'; });
    e.currentTarget.textContent = on ? 'Piilota salasana' : 'Näytä salasana';
  } });
}
async function migratePlain(w, key) {
  const raws = (await SEC.inner.rawList()).filter(d => docKind(d.path) && d.path !== 'meta/crypto' && !isEncDoc(d.data));
  if (!raws.length) return 0;
  const pg = showProgress('Salataan tietoja', raws.length);
  try {
    const ops = raws.map(d => ({ fn: async () => {
      await w.set(d.path, d.data);                                   // salaa ja korvaa selväkielisen
      const back = await SEC.inner.getDoc(d.path);                   // tarkista lukemalla takaisin
      const plain = isEncDoc(back) ? await decDoc(key, d.path, back) : null;
      if (!plain || stable(plain) !== stable(d.data)) throw { code: 'integrity', message: 'salauksen tarkistus epäonnistui' };
    } }));
    const r = await runWrites(ops, { onProgress: n => pg.set(n, 'Salataan') });
    if (r.error) throw r.error;
  } finally { pg.close(); }
  return raws.length;
}
function showSetup() {
  const el = showLockLayer();
  const pw1 = h('input', { id: 'sec-pw1', type: 'password', autocomplete: 'new-password', placeholder: 'Vähintään 10 merkkiä', autocapitalize: 'off', spellcheck: 'false' });
  const pw2 = h('input', { id: 'sec-pw2', type: 'password', autocomplete: 'new-password', autocapitalize: 'off', spellcheck: 'false' });
  const bar = h('i', { id: 'sec-meter-bar' }), lbl = h('span', { id: 'sec-meter-label', class: 'hint', text: ' ' });
  pw1.addEventListener('input', () => {
    const st = passwordStrength(pw1.value);
    bar.style.width = pw1.value ? (st.score + 1) * 25 + '%' : '0%'; bar.className = 'm' + st.score;
    lbl.textContent = pw1.value ? 'Vahvuus: ' + st.label : ' ';
  });
  const err = h('p', { class: 'err', id: 'sec-err', role: 'alert', hidden: true });
  const btn = h('button', { class: 'btn primary block', type: 'submit', id: 'sec-go', text: 'Suojaa ja jatka' });
  const form = h('form', { id: 'sec-setup-form', novalidate: true, onsubmit: async e => {
    e.preventDefault();
    const fail = m => { err.textContent = m; err.hidden = false; };
    if (pw1.value.length < 10) return fail('Salasanan pitää olla vähintään 10 merkkiä.');
    if (pw1.value !== pw2.value) return fail('Salasanat eivät täsmää. Kirjoita sama salasana kahdesti.');
    err.hidden = true; btn.disabled = true; btn.textContent = 'Suojataan…';
    try {
      const { key, meta } = await createCrypto(pw1.value);
      meta.lm = DEFAULT_SETTINGS.lockMin;                    // uusi asennus: oletuslukitus 2 min
      await SEC.inner.set('meta/crypto', meta);              // ensin avainmeta, sitten salaus (ei tietojen menetystä jos keskeytyy)
      const w = makeCryptoStore(SEC.inner, key);
      const migrated = await migratePlain(w, key);
      if (!SEC.inner.isSeeded()) {                           // esimerkkidata (vain paikallinen tila) tallennetaan salattuna
        if (!migrated && SEC.inner.mode === 'local') for (const d of EXAMPLE_DATA) await w.set(d.path, d.data);
        SEC.inner.markSeeded();
      }
      SEC.metaRaw = meta;
      const typed = pw1.value;
      pw1.value = ''; pw2.value = '';
      enterApp(key, meta, w);
      offerBio(typed);
    } catch (ex) {
      btn.disabled = false; btn.textContent = 'Suojaa ja jatka';
      fail('Salaus epäonnistui: ' + errText(ex));
    }
  } },
    h('div', { class: 'field' }, h('label', { for: 'sec-pw1', text: 'Salasana' }), pw1,
      h('div', { class: 'meter', 'aria-hidden': 'true' }, bar), lbl),
    h('div', { class: 'field' }, h('label', { for: 'sec-pw2', text: 'Kirjoita salasana uudelleen' }), pw2),
    pwToggle([pw1, pw2]),
    h('p', { class: 'warnbox', id: 'sec-warn', text: 'Jos unohdat salasanan, tietoja ei voi palauttaa kukaan – ei edes sovelluksen tekijä.' }),
    err, btn);
  el.append(lockCard('Suojaa tietosi',
    h('p', { class: 'hint', style: 'margin-bottom:14px', text: 'Tiedot salataan tällä laitteella ennen tallennusta, ja vain salasanan tietävä näkee ne. Salasanaa ei tallenneta mihinkään.' }), form));
  setTimeout(() => { try { pw1.focus(); } catch (e) { /* ok */ } }, 50);
}
// Avaa salasanalla: palauttaa {key, meta} tai null
async function openWithPassword(password) {
  const raw = SEC.metaRaw;
  let key = await openCrypto(password, raw), meta = raw;
  if (!key && raw && raw.next) {                          // keskeneräinen salasanan vaihto
    const alt = Object.assign({ v: 1, kdf: raw.kdf, lm: raw.lm }, raw.next);
    key = await openCrypto(password, alt); if (key) meta = alt;
  }
  return key ? { key, meta } : null;
}
const pageVisible = () => typeof document.visibilityState === 'string' ? document.visibilityState === 'visible' : !document.hidden;
const u8of = x => new Uint8Array(x.buffer ? x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength) : x);
// WebAuthn PRF: palauttaa 32 tavua tai null
async function bioGetPrf(bio) {
  const cred = await navigator.credentials.get({ publicKey: {
    challenge: _rand(32), rpId: location.hostname, allowCredentials: [{ type: 'public-key', id: b64d(bio.credId) }],
    userVerification: 'required', timeout: 60000, extensions: { prf: { eval: { first: b64d(bio.salt) } } }
  } });
  const ext = cred && cred.getClientExtensionResults ? cred.getClientExtensionResults() : null;
  const first = ext && ext.prf && ext.prf.results && ext.prf.results.first;
  return first ? u8of(first) : null;
}
function showUnlock() {
  if (SEC.waitTimer) { clearInterval(SEC.waitTimer); SEC.waitTimer = null; }
  const el = showLockLayer();
  const bs = BS();
  const pw = h('input', { id: 'lock-pw', type: 'password', autocomplete: 'current-password', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Salasana' });
  const err = h('p', { class: 'err', id: 'lock-err', role: 'alert', hidden: true });
  const waitEl = h('p', { class: 'err', id: 'unlock-wait', role: 'status', hidden: true });
  const btn = h('button', { class: 'btn primary block', type: 'submit', id: 'lock-go', text: 'Avaa' });
  const bio = SEC.metaRaw && bioMetaUsable(SEC.metaRaw.bio) ? SEC.metaRaw.bio : null;
  const bioBtn = bio ? h('button', { class: 'btn primary block', type: 'button', id: 'unlock-bio', style: 'margin-bottom:14px', text: bs.unlock }) : null;
  const hintEl = h('p', { class: 'hint', id: 'unlock-hint', role: 'status', hidden: true, style: 'margin:-6px 0 12px' });
  const inst = SEC.unlockInst = {};                        // tämän lukitusnäkymän tunniste: vanhentunut yritys ei saa avata mitään
  const wait = () => {
    const ms = failState().until - Date.now();
    if (ms > 0) {
      btn.disabled = true; if (bioBtn) bioBtn.disabled = true;
      waitEl.hidden = false; waitEl.textContent = 'Liian monta yritystä. Yritä uudelleen ' + fmtWait(ms) + ' kuluttua.';
      return true;
    }
    if (SEC.waitTimer) { clearInterval(SEC.waitTimer); SEC.waitTimer = null; }
    waitEl.hidden = true; btn.disabled = false; if (bioBtn) bioBtn.disabled = false; return false;
  };
  const startWait = () => { if (wait() && !SEC.waitTimer) SEC.waitTimer = setInterval(wait, 1000); };
  let busy = false;
  const form = h('form', { id: 'lock-form', novalidate: true, onsubmit: async e => {
    e.preventDefault();
    if (busy || wait()) return;
    if (!pw.value) { err.hidden = false; err.textContent = 'Kirjoita salasana.'; return; }
    busy = true; btn.disabled = true; btn.textContent = 'Avataan…';
    const r = await openWithPassword(pw.value);
    btn.textContent = 'Avaa'; busy = false;
    if (!r) {
      recordFail(); pw.value = '';
      err.hidden = false; err.textContent = 'Salasana ei kelpaa.';
      btn.disabled = false; startWait(); pw.focus(); return;
    }
    const typed = pw.value;
    clearFails(); pw.value = '';
    enterApp(r.key, r.meta, null);
    offerBio(typed);
  } }, field('lock-pw', 'Salasana', pw), err, btn);
  // Biometrinen avaus. auto = käynnistyi itsestään (ei käyttäjän napautusta): poikkeus ei ole virhe eikä kasvata epäonnistumislaskuria.
  // Epäonnistumiseksi lasketaan vain tilanne, jossa salasana saadaan käsiin mutta se ei avaa tietoja (natiivissa: Keychain luovuttaa salasanan, mutta se on väärä).
  // Peruutus (natiivi, koodi 16) ei koskaan laske epäonnistumista eikä näytä punaista virhettä.
  const tryBio = async auto => {
    if (busy || wait() || SEC.unlockInst !== inst) return;
    busy = true; bioBtn.disabled = true; err.hidden = true; hintEl.hidden = true;
    let password = null, state = 'ok';                    // ok | fail | cancel | gone
    if (bio.native) {
      try { password = await nativeBioFetch(); if (password == null) state = 'fail'; }
      catch (e) { password = null; state = nbGone(e) ? 'gone' : nbCancelled(e) ? 'cancel' : 'fail'; }
    } else {
      let prf = null;
      try { prf = await bioGetPrf(bio); } catch (e) { prf = null; }
      if (SEC.unlockInst !== inst) return;                 // lukitusnäkymä ehdittiin vaihtaa (esim. salasanalla sisään)
      if (!prf) state = 'fail';
      else { try { password = await bioUnwrap(prf, bio); } catch (e) { password = null; } }
    }
    if (SEC.unlockInst !== inst) { password = null; return; }
    if (state !== 'ok') {
      busy = false; bioBtn.disabled = false;
      if (state === 'gone') {                              // Keychain-kohde puuttuu tai on mitätöity: biometria pois, salasana toimii
        bioBtn.hidden = true;
        hintEl.hidden = false; hintEl.textContent = bs.invalidated;
        try { await nativeBioClear(); await saveBioMeta(null); } catch (e) { /* meta poistuu viimeistään seuraavalla kerralla */ }
        try { pw.focus(); } catch (e) { /* ok */ }
      } else if (auto) { hintEl.hidden = false; hintEl.textContent = 'Napauta “' + bs.unlock + '” tai kirjoita salasana.'; }
      else if (state === 'cancel') { try { pw.focus(); } catch (e) { /* ok */ } }
      else { err.hidden = false; err.textContent = bs.fail; try { pw.focus(); } catch (e) { /* ok */ } }
      return;
    }
    const r = password == null ? null : await openWithPassword(password);
    password = null;
    if (SEC.unlockInst !== inst) return;
    busy = false; bioBtn.disabled = false;
    if (!r) {
      recordFail();
      err.hidden = false; err.textContent = bs.fail;
      startWait(); try { pw.focus(); } catch (e) { /* ok */ } return;
    }
    clearFails(); pw.value = '';
    enterApp(r.key, r.meta, null);
  };
  if (bioBtn) bioBtn.onclick = () => tryBio(false);        // käyttäjän napautus
  el.append(lockCard('Hakuviestit on lukittu', bioBtn, hintEl, waitEl, form,
    h('button', { class: 'small-btn', type: 'button', id: 'lock-forgot', style: 'margin-top:12px', text: 'Unohdin salasanan → Aloita alusta', onclick: openReset })));
  startWait();
  if (!bio) setTimeout(() => { try { pw.focus(); } catch (e) { /* ok */ } }, 50);
  else if (!(typeof window !== 'undefined' && window.HV_NO_AUTO_BIO)) {
    // Automaattinen käynnistys kerran per lukitusnäkymä; piilotettu sivu odottaa näkyviin tuloa
    let started = false;
    const onVis = () => { if (pageVisible()) fire(); };
    const fire = () => { if (started) return; started = true; SEC.unlockDispose && SEC.unlockDispose(); tryBio(true); };
    SEC.unlockDispose = () => { document.removeEventListener('visibilitychange', onVis); SEC.unlockDispose = null; };
    if (pageVisible()) fire(); else document.addEventListener('visibilitychange', onVis);
  }
}
function openReset() {
  openSheet('Aloita alusta', (body, api) => {
    const word = h('input', { id: 'sec-reset-word', type: 'text', autocomplete: 'off', autocapitalize: 'characters', placeholder: 'POISTA' });
    const go = h('button', { class: 'btn dangerfill block', type: 'button', id: 'sec-reset-go', text: 'Poista kaikki', disabled: true, onclick: () => { api.close(); wipeAll(); } });
    word.addEventListener('input', () => { go.disabled = word.value !== 'POISTA'; });
    body.append(h('p', { style: 'font-size:15px;margin-bottom:12px', text: 'Tämä poistaa kaikki tiedot (keskustelut, viestit, omat osoitteet ja salasanan) tästä sovelluksesta pysyvästi. Tietoja ei voi palauttaa. Kirjoita POISTA vahvistukseksi.' }),
      field('sec-reset-word', 'Vahvistus', word), go);
  });
}
async function wipeAll() {
  const pg = showProgress('Poistetaan kaikki', 1);
  try {
    if (SEC.inner.wipe) await SEC.inner.wipe();
    else {
      for (let round = 0; round < 40; round++) {                 // viestit ensin, jotta ne eivät jää orvoiksi
        const list = (await SEC.inner.rawList()).filter(d => ['msg', 'uns'].includes(docKind(d.path)));
        if (!list.length) break;
        pg.setTotal(list.length);
        const r = await runWrites(list.map(d => ({ fn: () => SEC.inner.del(d.path) })), { onProgress: n => pg.set(n, 'Poistetaan') });
        if (r.error) throw r.error;
      }
      const rest = (await SEC.inner.rawList()).filter(d => d.path !== 'meta/crypto');
      const r2 = await runWrites(rest.map(d => ({ fn: () => SEC.inner.del(d.path) })), {});
      if (r2.error) throw r2.error;
      await SEC.inner.del('meta/crypto');
    }
  } catch (e) { pg.close(); toast(errText(e), 'bad'); return; }
  await nativeBioClear();                                      // natiivi: tallennettu salasana pois Keychainista
  pg.close(); clearFails(); SEC.metaRaw = null;
  showSetup();
}

/* ----- Sovellukseen siirtyminen ja lukitus ----- */
function startData() {
  const errH = e => toast(errText(e), 'bad');
  SEC.unsubs = [
    S.store.watchProfile(p => { S.profile = p; rebuildIndexes(); onData(); }, errH),
    S.store.watchChats(map => { S.chats = map; S.chatsReady = true; rebuildIndexes(); onData(); }, errH),
    S.store.watchUnsorted(list => { S.unsorted = list; S.unsortedReady = true; onData(); }, errH)
  ];
}
function stopData() {
  SEC.unsubs.forEach(u => { try { u(); } catch (e) { /* ok */ } });
  SEC.unsubs = [];
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
}
function enterApp(key, meta, w) {
  if (SEC.unlockDispose) { try { SEC.unlockDispose(); } catch (e) { /* ok */ } }
  SEC.unlockInst = null;
  SEC.key = key; SEC.meta = meta;
  SEC.wstore = w || makeCryptoStore(SEC.inner, key);
  S.store = SEC.wstore; S.locked = false;
  $('#lock').hidden = true; $('#lock').replaceChildren();
  $('#app').hidden = false; $('#lockfab').hidden = false;
  document.documentElement.classList.remove('locked');
  buildAll(); applyDevice(); watchDevice(); loadDeviceInfo();
  showView('chats'); renderChatList();
  startData();
  SEC.last = Date.now(); SEC.hiddenAt = 0;
  clearInterval(SEC.timer);
  SEC.timer = setInterval(() => { if (!S.locked && Date.now() - SEC.last > settings().lockMin * 60000) lockNow(); }, 5000);
  updateImportCaps(); renderAccounts();
  if (SEC.inner.mode === 'local') migratePlain(SEC.wstore, key).catch(() => { /* seuraava avaus yrittää uudelleen */ });
}
// Lukitus: avain, puretut tiedot, tilaukset ja koko käyttöliittymän sisältö nollataan muistista
function lockNow() {
  if (S.locked || !SEC.inner) return;
  S.locked = true;
  clearInterval(SEC.timer); SEC.timer = null;
  stopStick(); stopData();
  sheetStack.slice().forEach(s => { try { s.close(); } catch (e) { /* ok */ } });
  if (SEC.wstore) SEC.wstore.close();
  SEC.wstore = null; SEC.key = null; SEC.meta = null; S.store = null;
  Object.assign(S, {
    profile: null, chats: {}, chatsReady: false, unsorted: [], unsortedReady: false, messages: [], msgsReady: false, openId: null,
    expanded: new Set(), own: new Set(), idx: new Map(), imp: null, visibleIds: [], q: '', filter: 'all', view: 'chats', tab: 'chats', split: false
  });
  S.sum = { sig: '', sent: null, loading: false };
  imp.busy = false; imp.ui = {};
  teardownUi();
  showUnlock();
}
function teardownUi() {
  $('#toasts').replaceChildren(); $('#layers').replaceChildren();
  Object.keys(views).forEach(k => { try { views[k].root.remove(); } catch (e) { /* ok */ } delete views[k]; });
  const tb = $('#tabbar'); tb.replaceChildren();
  if (tb.parentNode !== document.body) document.body.insertBefore(tb, $('#layers'));
  $('#left-list').replaceChildren(); $('#main').replaceChildren();
  $('#split').hidden = true; $('#main').hidden = false; $('#right-empty').hidden = true;
  const b = $('#banner'); b.textContent = ''; b.hidden = true;
  const f = $('#fab'); if (f) f.replaceChildren();
  document.documentElement.classList.remove('noscroll');
}
function lockButtonsInit() {
  const a = $('#lockfab'), b = $('#lock-left');
  a.replaceChildren(ico('lock', 20)); b.replaceChildren(ico('lock', 20));
  a.addEventListener('click', lockNow); b.addEventListener('click', lockNow);
}
// Yksityisyysnäkymä: kun sivu piilotetaan (sovellusvaihtaja / viimeisimmät), sisältö peitetään niin ettei esikatselukuva paljasta viestejä
document.addEventListener('visibilitychange', () => {
  const de = document.documentElement;
  if (document.hidden) { if (SEC.metaRaw || SEC.meta) de.classList.add('privacy-blur'); }
  else de.classList.remove('privacy-blur');
});
(function activityInit() {
  const act = () => { if (!S.locked) SEC.last = Date.now(); };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(t => window.addEventListener(t, act, { passive: true, capture: true }));
  document.addEventListener('visibilitychange', () => {
    if (S.locked) return;
    if (document.hidden) { SEC.hiddenAt = Date.now(); return; }
    const hiddenFor = SEC.hiddenAt ? Date.now() - SEC.hiddenAt : 0;
    SEC.hiddenAt = 0;
    if (hiddenFor > 60000 || Date.now() - SEC.last > settings().lockMin * 60000) lockNow();
  });
})();

/* ----- Asetukset ja Tietosuoja-osio ----- */
async function saveSettings(patch) {
  const cur = S.profile || { identities: [] };
  const data = Object.assign({}, cur, { settings: Object.assign({}, settings(), patch), updatedAt: nowIso() });
  if (!await doWrites([{ t: 'set', path: 'meta/profile', data }])) return false;
  S.profile = data; rebuildIndexes(); renderChatList(); updateImportCaps(); renderAccounts();
  return true;
}
function privacySection() {
  const lockSel = h('select', { id: 'sec-lockmin', 'aria-label': 'Automaattinen lukitus', onchange: e => saveSettings({ lockMin: +e.target.value }) },
    [1, 2, 5, 15].map(m => h('option', { value: String(m), text: m + ' min' })));
  const prev = h('input', { id: 'sec-hideprev', type: 'checkbox', onchange: e => saveSettings({ hidePreview: e.target.checked }) });
  return h('div', { class: 'sec', id: 'sec-privacy' }, h('h2', { text: 'Tietosuoja' }),
    h('div', { class: 'card' },
      h('ul', { class: 'privlist' },
        h('li', { text: 'Tiedot salataan laitteellasi ennen tallennusta. Tallennettua sisältöä ei voi lukea ilman salasanaasi.' }),
        h('li', { text: 'Gmail-haku kulkee claude.ai:n Gmail-yhdistäjän kautta: haetut viestit kulkevat sen läpi, mutta ne tallennetaan vain salattuina.' }),
        h('li', { text: 'Mitään ei lähetetä Claudelle tai tekoälylle. Tiedot näkyvät vain sinulle.' }),
        h('li', { text: 'Jaettu linkki ei näytä tietojasi muille: tiedot ovat vain sinun tililläsi ja salattuja.' })),
      h('div', { class: 'privstat mono', id: 'sec-status' }),
      field('sec-lockmin', 'Automaattinen lukitus toimettomuuden jälkeen', lockSel, 'Sovellus lukitaan myös, kun sivu on ollut piilossa yli minuutin.'),
      h('label', { class: 'check', for: 'sec-hideprev' }, prev, h('span', { text: 'Piilota viestien esikatselu listassa' })),
      h('div', { class: 'btn-row', style: 'margin-top:12px' },
        h('button', { class: 'btn', type: 'button', id: 'sec-lock-now', onclick: lockNow }, ico('lock', 18), 'Lukitse nyt'),
        h('button', { class: 'btn', type: 'button', id: 'sec-change', text: 'Vaihda salasana', onclick: openChangePassword })),
      h('div', { id: 'sec-bio', style: 'margin-top:12px' },
        h('button', { class: 'btn block', type: 'button', id: 'sec-bio-on', hidden: true, onclick: openBioEnable }),
        h('button', { class: 'btn block', type: 'button', id: 'sec-bio-off', hidden: true, onclick: () => bioDisable(false) }),
        h('p', { class: 'hint', id: 'sec-bio-hint', style: 'margin-top:6px', hidden: true }))),
    h('div', { class: 'card', id: 'sec-device', style: 'margin-top:12px' }, h('h3', { class: 'tips-h', text: 'Laitteen tila' }), h('div', { id: 'sec-device-body' })),
    h('div', { class: 'card', id: 'sec-tips', style: 'margin-top:12px' }, h('h3', { class: 'tips-h', text: 'Suojausvinkit puhelimeen' }),
      ...secTips(bioUA()).map(g => h('div', { class: 'tips-g' }, g.title ? h('h4', { class: 'tips-sub', text: g.title }) : null, h('ul', { class: 'privlist' }, g.items.map(t => h('li', { text: t })))))));
}
function renderPrivacy() {
  const st = $('#sec-status'); if (!st) return;
  const s = settings();
  st.textContent = 'Salaus: päällä · Automaattinen lukitus: ' + s.lockMin + ' min';
  $('#sec-lockmin').value = String(s.lockMin);
  $('#sec-hideprev').checked = !!s.hidePreview;
  renderDevice();
  const bs = BS(), has = !!(SEC.meta && SEC.meta.bio), on = $('#sec-bio-on'), off = $('#sec-bio-off'), hint = $('#sec-bio-hint');
  if (on) { on.textContent = bs.on; on.hidden = has || !SEC.meta || !bioSupported(); }
  if (off) { off.textContent = bs.off; off.hidden = !has; }
  if (hint) { hint.textContent = bs.hint; hint.hidden = !(has || (on && !on.hidden)); }
}
/* ----- Laitteen tila ----- */
const DEVB = { dismissed: false };
const touchPoints = () => { try { return (typeof navigator !== 'undefined' && navigator.maxTouchPoints) || 0; } catch (e) { return 0; } };
const devInfoNow = () => S.devInfo || detectDeviceInfo({ ua: bioUA(), maxTouchPoints: touchPoints() });
function renderDevice() {
  const box = $('#sec-device-body');
  const st = deviceStatus(devInfoNow(), SEC_MIN);
  if (box) {
    box.replaceChildren(
      h('p', { class: 'dev-level l-' + st.level, id: 'dev-level', text: { ok: 'Ajan tasalla', update: 'Päivitys suositeltu', unknown: 'Tila tuntematon' }[st.level] }),
      h('ul', { class: 'privlist', id: 'dev-lines' }, st.lines.map(l => h('li', { text: l }))),
      h('p', { class: 'hint', style: 'margin:0', text: 'Vertailuarvot tarkistettu ' + SEC_MIN.checked + '.' }));
  }
  renderDevBanner(st);
}
// Ilmoitus Keskustelut-näkymässä kerran istunnossa, jos päivitys on suositeltu
function renderDevBanner(st) {
  const slot = $('#dev-banner-slot'); if (!slot) return;
  slot.replaceChildren();
  st = st || deviceStatus(devInfoNow(), SEC_MIN);
  if (st.level !== 'update' || DEVB.dismissed) return;
  const line = st.lines.find(l => /päivitys suositeltu/.test(l)) || st.lines[0];
  slot.append(h('div', { class: 'dev-banner', id: 'dev-update-banner', role: 'status' },
    h('span', { class: 'dev-banner-t', text: 'Laitteesi päivitys on suositeltu. ' + line }),
    h('button', { class: 'small-btn', type: 'button', id: 'dev-banner-close', text: 'Sulje', onclick: () => { DEVB.dismissed = true; slot.replaceChildren(); } })));
}
async function loadDeviceInfo() {
  S.devInfo = null; renderDevice();
  try {
    const ud = navigator.userAgentData;
    if (ud && ud.getHighEntropyValues && /Android/i.test(bioUA())) {   // Chromen supistettu UA ei kerro Androidin versiota
      const v = await ud.getHighEntropyValues(['platformVersion']);
      S.devInfo = detectDeviceInfo({ ua: bioUA(), maxTouchPoints: touchPoints(), platformVersion: v && v.platformVersion });
      if (!S.locked) renderDevice();
    }
  } catch (e) { /* ei tukea: UA riittää */ }
}
// Tallentaa (tai poistaa) biometrisen avauksen tiedot lukituksen metaan (luettavissa ennen avausta)
// Toimii myös lukittuna (SEC.meta on silloin null: pohjana lukitusmeta SEC.metaRaw)
async function saveBioMeta(bio) {
  const next = Object.assign({}, SEC.meta || SEC.metaRaw);
  if (bio) next.bio = bio; else delete next.bio;
  await SEC.inner.set('meta/crypto', next);
  if (SEC.meta) SEC.meta = next;
  SEC.metaRaw = next;
  renderPrivacy();
}
async function bioDisable(silent) {
  await nativeBioClear();                                   // natiivi: Keychain-kohde pois ensin (virheet ohitetaan)
  try { await saveBioMeta(null); } catch (e) { toast(errText(e), 'bad'); return; }
  if (!silent) toast(BS().disabled);
}
// Luo pääsyavaimen ja PRF-salaisuuden, joka suojaa salasanan. Palauttaa {credId, prf, salt} tai heittää 'unsupported'
async function bioEnroll() {
  const salt = _rand(32);
  const cred = await navigator.credentials.create({ publicKey: {
    rp: { name: 'Hakuviestit', id: location.hostname },
    user: { id: _rand(16), name: 'hakuviestit', displayName: 'Hakuviestit' },
    challenge: _rand(32),
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
    extensions: { prf: { eval: { first: salt } } }
  } });
  if (!cred || !cred.rawId) throw new Error('unsupported');
  const credId = b64e(new Uint8Array(cred.rawId));
  const ext = cred.getClientExtensionResults ? cred.getClientExtensionResults() : {};
  let first = ext && ext.prf && ext.prf.results && ext.prf.results.first;
  if (!first) {                                           // iOS palauttaa PRF-tuloksen vasta get-kutsulla
    const got = await navigator.credentials.get({ publicKey: {
      challenge: _rand(32), rpId: location.hostname, allowCredentials: [{ type: 'public-key', id: b64d(credId) }],
      userVerification: 'required', timeout: 60000, extensions: { prf: { eval: { first: salt } } }
    } });
    const e2 = got && got.getClientExtensionResults ? got.getClientExtensionResults() : {};
    first = e2 && e2.prf && e2.prf.results && e2.prf.results.first;
  }
  if (!first) throw new Error('unsupported');
  return { credId, salt: b64e(salt), prf: u8of(first) };
}
// Ottaa biometrisen avauksen käyttöön annetulla (jo tarkistetulla) salasanalla. Heittää, jos ei onnistu.
async function bioEnrollSave(password) {
  if (isNativeApp()) {
    if (!await nativeBioAvailable()) throw { code: 'native_unavailable' };
    const nb = nativePlugin('NativeBiometric');
    await nb.setData({ key: NB_KEY, value: password, accessControl: 2 });   // 2 = BIOMETRY_ANY
    try { await saveBioMeta({ v: 1, native: true }); }
    catch (e) { await nativeBioClear(); throw e; }
    return;
  }
  const r = await bioEnroll();
  const w = await bioWrap(r.prf, password);
  await saveBioMeta({ v: 1, credId: r.credId, salt: r.salt, iv: w.iv, ct: w.ct });
}
function openBioEnable() {
  const bs = BS();
  openSheet(bs.on, (body, api) => {
    const err = h('p', { class: 'err', id: 'bio-err', role: 'alert', hidden: true });
    const showErr = m => { err.textContent = m; err.hidden = false; };
    const pw = h('input', { id: 'bio-pw', type: 'password', autocomplete: 'current-password', autocapitalize: 'off' });
    let password = null;
    const info = h('p', { class: 'hint', id: 'bio-info', style: 'margin-bottom:10px', text: 'Kirjoita nykyinen salasana. Se suojataan laitteen omalla tunnistuksella (' + bs.label + ') eikä tallenneta selväkielisenä.' });
    const go = h('button', { class: 'btn primary block', type: 'button', id: 'bio-go', text: 'Jatka: ' + bs.label, hidden: true });
    const check = h('button', { class: 'btn primary block', type: 'submit', id: 'bio-check', text: 'Tarkista salasana' });
    const form = h('form', { id: 'bio-form', novalidate: true, onsubmit: async e => {
      e.preventDefault();
      if (!pw.value) return showErr('Kirjoita salasana.');
      check.disabled = true;
      const key = await openCrypto(pw.value, SEC.meta);
      check.disabled = false;
      if (!key) { pw.value = ''; return showErr('Salasana ei kelpaa.'); }
      password = pw.value; pw.value = ''; err.hidden = true;
      form.hidden = true; go.hidden = false; info.textContent = 'Salasana tarkistettu. Vahvista seuraavaksi laitteen omalla tunnistuksella (' + bs.label + ').';
    } }, field('bio-pw', 'Salasana', pw), check);
    go.onclick = async () => {                           // erillinen napautus: WebAuthn vaatii käyttäjän eleen
      go.disabled = true; err.hidden = true;
      try {
        await bioEnrollSave(password);
        password = null; lsDel('hv-bio-offer'); api.close(); toast(bs.enabled);
      } catch (ex) {
        go.disabled = false;
        showErr(ex && ['quota_exceeded', 'resource_exhausted', 'revoked', 'unavailable'].includes(ex.code) ? errText(ex) : bs.unsupported);   // WebAuthn-virheet (NotAllowed, Security, NotSupported) = ei käytettävissä tässä näkymässä
      }
    };
    body.append(info, form, go, err);
  });
}
// Tarjous biometrisen avauksen käyttöönotosta salasanalla sisäänkirjautumisen jälkeen. Salasana vain tämän sivun elinajan paikallisessa muuttujassa.
function offerBio(password) {
  const bs = BS();
  let skip = true;
  try { skip = !password || !bioSupported() || !SEC.meta || !!SEC.meta.bio || lsGet('hv-bio-offer') === 'no'; } catch (e) { skip = true; }
  if (skip) return;
  let pwd = password; password = null;
  const present = () => openSheet(bs.offerTitle, (body, api) => {
    const err = h('p', { class: 'err', id: 'bio-offer-err', role: 'alert', hidden: true });
    const go = h('button', { class: 'btn primary block', type: 'button', id: 'bio-offer-go', text: 'Ota käyttöön' });
    const no = h('button', { class: 'btn block', type: 'button', id: 'bio-offer-no', style: 'margin-top:8px', text: 'Ei nyt' });
    no.onclick = () => { lsSet('hv-bio-offer', 'no'); api.close(); };
    go.onclick = async () => {                           // enrollaus suoraan napautuksesta: WebAuthn vaatii käyttäjän eleen
      go.disabled = true; no.disabled = true; err.hidden = true;
      try {
        await bioEnrollSave(pwd);
        pwd = null; lsDel('hv-bio-offer'); api.close(); toast(bs.enabled);
      } catch (ex) {
        no.disabled = false; go.hidden = true; no.textContent = 'Sulje';
        const quota = ex && ['quota_exceeded', 'resource_exhausted', 'revoked', 'unavailable'].includes(ex.code);
        err.textContent = quota ? errText(ex) : bs.unsupported; err.hidden = false;
        if (!quota) lsSet('hv-bio-offer', 'no');         // ei toimi tässä näkymässä: ei kysytä uudelleen
      }
    };
    body.append(h('p', { id: 'bio-offer-text', style: 'font-size:15px;margin-bottom:14px', text: bs.offerText }), go, no, err);
  }, { onClose: () => { pwd = null; } });             // salasana pois muistista, kun ikkuna suljetaan
  if (!isNativeApp()) { present(); return; }
  // Natiivi: tarjous vain jos Face ID on käytettävissä (muuten ei turhaa tarjousta; asetuksista saa selitteen)
  nativeBioAvailable().then(ok => { if (ok && !S.locked && SEC.meta && !SEC.meta.bio && pwd) present(); else pwd = null; });
}
function askPassword(title, text) {
  return new Promise(resolve => {
    let val = null;
    openSheet(title, (body, api) => {
      const pw = h('input', { id: 'ask-pw', type: 'password', autocomplete: 'current-password', autocapitalize: 'off' });
      const err = h('p', { class: 'err', hidden: true });
      const form = h('form', { id: 'ask-form', novalidate: true, onsubmit: e => { e.preventDefault(); if (!pw.value) { err.textContent = 'Kirjoita salasana.'; err.hidden = false; return; } val = pw.value; api.close(); } },
        h('p', { class: 'hint', style: 'margin-bottom:10px', text: text }), field('ask-pw', 'Salasana', pw), err,
        h('button', { class: 'btn primary block', type: 'submit', id: 'ask-go', text: 'Jatka' }));
      body.append(form);
    }, { onClose: () => resolve(val) });
  });
}
function openChangePassword() {
  openSheet('Vaihda salasana', (body, api) => {
    const o = h('input', { id: 'cp-old', type: 'password', autocomplete: 'current-password', autocapitalize: 'off' });
    const n1 = h('input', { id: 'cp-new1', type: 'password', autocomplete: 'new-password', autocapitalize: 'off' });
    const n2 = h('input', { id: 'cp-new2', type: 'password', autocomplete: 'new-password', autocapitalize: 'off' });
    const bar = h('i', { id: 'cp-meter-bar' }), lbl = h('span', { class: 'hint', id: 'cp-meter-label', text: ' ' });
    n1.addEventListener('input', () => { const st = passwordStrength(n1.value); bar.style.width = n1.value ? (st.score + 1) * 25 + '%' : '0%'; bar.className = 'm' + st.score; lbl.textContent = n1.value ? 'Vahvuus: ' + st.label : ' '; });
    const err = h('p', { class: 'err', id: 'cp-err', role: 'alert', hidden: true });
    const go = h('button', { class: 'btn primary block', type: 'submit', id: 'cp-go', text: 'Vaihda salasana' });
    const form = h('form', { id: 'cp-form', novalidate: true, onsubmit: async e => {
      e.preventDefault();
      const fail = m => { err.textContent = m; err.hidden = false; };
      if (n1.value.length < 10) return fail('Uuden salasanan pitää olla vähintään 10 merkkiä.');
      if (n1.value !== n2.value) return fail('Uudet salasanat eivät täsmää.');
      go.disabled = true; go.textContent = 'Tarkistetaan…';
      const oldKey = await openCrypto(o.value, SEC.meta);
      if (!oldKey) { go.disabled = false; go.textContent = 'Vaihda salasana'; return fail('Vanha salasana ei kelpaa.'); }
      err.hidden = true; api.close();
      await changePassword(oldKey, n1.value);
    } }, h('p', { class: 'warnbox', text: 'Jos unohdat uuden salasanan, tietoja ei voi palauttaa kukaan. Älä sulje sovellusta vaihdon aikana.' }),
      field('cp-old', 'Vanha salasana', o), h('div', { class: 'field' }, h('label', { for: 'cp-new1', text: 'Uusi salasana' }), n1, h('div', { class: 'meter', 'aria-hidden': 'true' }, bar), lbl),
      field('cp-new2', 'Uusi salasana uudelleen', n2), err, go);
    body.append(form);
  });
}
// Salaa kaiken uudelleen uudella avaimella; meta/crypto vaihtuu viimeisenä (next-kenttä suojaa keskeytykseltä)
async function changePassword(oldKey, newPw) {
  const pg = showProgress('Salataan uudelleen', 1);
  try {
    const { key: newKey, meta: newMeta } = await createCrypto(newPw);
    if (SEC.meta && SEC.meta.lm) newMeta.lm = SEC.meta.lm;      // säilytä oletuslukitus
    const hadBio = !!(SEC.meta && SEC.meta.bio);                 // vanha salasana ei enää kelpaa: biometrinen avaus poistuu
    const raws = (await SEC.inner.rawList()).filter(d => docKind(d.path) && d.path !== 'meta/crypto');
    pg.setTotal(raws.length + 1);
    await SEC.inner.set('meta/crypto', Object.assign({}, SEC.meta, { next: { kdf: newMeta.kdf, iter: newMeta.iter, salt: newMeta.salt, check: newMeta.check } }));
    const ops = raws.map(d => ({ fn: async () => {
      let plain = null;
      try { plain = await decDoc(oldKey, d.path, d.data); } catch (e) { plain = null; }
      if (plain === null) {                                            // jo uudella avaimella tai korruptoitunut
        try { await decDoc(newKey, d.path, d.data); return; } catch (e) { return; }
      }
      const enc = await encDoc(newKey, d.path, plain);
      const verify = await decDoc(newKey, d.path, enc);
      if (stable(verify) !== stable(plain)) throw { code: 'integrity', message: 'tarkistus epäonnistui' };
      await SEC.inner.set(d.path, enc);
    } }));
    const r = await runWrites(ops, { onProgress: n => pg.set(n, 'Salataan uudelleen') });
    if (r.error) throw r.error;
    await SEC.inner.set('meta/crypto', newMeta);
    if (hadBio) await nativeBioClear();                          // natiivi: vanha salasana pois Keychainista
    // vaihda käyttöön uusi avain ja käynnistä tilaukset uudelleen
    const reopen = S.openId;
    stopData(); SEC.wstore.close();
    SEC.key = newKey; SEC.meta = newMeta; SEC.metaRaw = newMeta;
    SEC.wstore = makeCryptoStore(SEC.inner, newKey); S.store = SEC.wstore;
    startData();
    if (reopen) setTimeout(() => { if (S.chats[reopen]) openChat(reopen); }, 100);
    pg.close(); renderPrivacy(); toast('Salasana vaihdettu');
    if (hadBio) setTimeout(() => toast(BS().resetHint), 2700);
  } catch (e) { pg.close(); toast('Salasanan vaihto epäonnistui: ' + errText(e) + ' Yritä uudelleen samoilla salasanoilla.', 'bad'); }
}

/* ----- Käynnistys: onko salaus jo asetettu? ----- */
async function bootSecurity() {
  showLoadingLock();
  let raw = null;
  try { raw = await SEC.inner.getDoc('meta/crypto'); }
  catch (e) { showSecurityError('Tietojen lukeminen epäonnistui. Tarkista yhteys ja yritä uudelleen.'); return; }
  SEC.metaRaw = raw;
  if (!raw) showSetup(); else showUnlock();
}
