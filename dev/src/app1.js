/* ===== Sovellus: perusrakenteet ===== */
const STORE_KEY = 'hakuviestit.v1';
const EXAMPLE_DATA = buildExampleDocs();

/* ----- DOM-apurit (kaikki teksti textContentilla) ----- */
const $ = (s, r) => (r || document).querySelector(s);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  const add = k => {
    if (k == null || k === false) return;
    if (Array.isArray(k)) k.forEach(add);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  };
  kids.forEach(add);
  return el;
}
const NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  mail: ['M4 6h16v12H4z', 'M4 7.5l8 6 8-6'],
  sms: ['M4 5h16v11H9.5L5 20v-4H4z'],
  whatsapp: ['M12 3.5a8.5 8.5 0 0 0-7.3 12.9L3.5 20.5l4.2-1.1A8.5 8.5 0 1 0 12 3.5z', 'M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .9c-1-.4-1.9-1.3-2.3-2.3l.9-1-1-2z'],
  call: ['M5.5 4h3.3l1.6 4-2 1.3a10 10 0 0 0 4.3 4.3l1.3-2 4 1.6v3.3a1.8 1.8 0 0 1-1.9 1.8A14.5 14.5 0 0 1 3.7 5.9 1.8 1.8 0 0 1 5.5 4z'],
  meeting: ['M4 6h16v14H4z', 'M4 10.5h16', 'M8 3.5v4', 'M16 3.5v4'],
  other: ['M6 12h.01', 'M12 12h.01', 'M18 12h.01'],
  out: ['M7 17L17 7', 'M9 7h8v8'],
  in: ['M17 7L7 17', 'M7 9v8h8'],
  back: ['M15 5l-7 7 7 7'],
  plus: ['M12 5v14', 'M5 12h14'],
  send: ['M21 3L10 14', 'M21 3l-7 18-4-7-7-4z'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  chats: ['M3.5 5h11v8H8l-3.5 3v-3h-1z', 'M17.5 9h3v8h-1v3l-3.5-3H11v-2'],
  summary: ['M5 20V11', 'M12 20V4', 'M19 20v-6'],
  import: ['M12 4v11', 'M7.5 10.5L12 15l4.5-4.5', 'M5 20h14'],
  accounts: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4.5 20.5a7.5 7.5 0 0 1 15 0'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M16.5 16.5L21 21'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  copy: ['M9 9h11v11H9z', 'M5 15V4h11'],
  trash: ['M4.5 7h15', 'M9.5 7V4h5v3', 'M6.5 7l1 13h9l1-13'],
  edit: ['M4 20l1-4L16 5l3 3L8 19z'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v6', 'M12 7.5h.01'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  move: ['M4 12h14', 'M13 7l5 5-5 5'],
  file: ['M6 3h8l4 4v14H6z', 'M14 3v4h4'],
  lock: ['M6 11h12v9H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3', 'M12 15v2'],
  shield: ['M12 3l7 3v5.5c0 4.3-2.9 7.7-7 9.5-4.1-1.8-7-5.2-7-9.5V6z', 'M9 12l2.2 2.2L15.5 10'],
  refresh: ['M20 11a8 8 0 0 0-14.5-4.5L4 8', 'M4 4v4h4', 'M4 13a8 8 0 0 0 14.5 4.5L20 16', 'M20 20v-4h-4']
};
ICONS.email = ICONS.mail; // kanava-avain on "email"
const DOTICONS = { more: 1, other: 1 };
function ico(name, size, sw) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size || 20); s.setAttribute('height', size || 20);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', sw || (DOTICONS[name] ? 3.2 : 1.8));
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  for (const d of (ICONS[name] || [])) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); s.appendChild(p); }
  return s;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();
const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const newChatId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const byAt = (a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0) || (a.id < b.id ? -1 : 1);
function initials(name) {
  const base = String(name || '').split(/\s[–—-]\s/)[0];
  const w = base.split(/\s+/).map(x => x.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  if (!w.length) return '?';
  if (w.length === 1) return Array.from(w[0]).slice(0, 2).join('').toUpperCase();
  return (Array.from(w[0])[0] + Array.from(w[1])[0]).toUpperCase();
}
function avatar(name, size, color) {
  let idx = fnv32(String(name || '?')) % 6;
  const m = /^av([1-6])$/.exec(color || '');
  if (m) idx = +m[1] - 1;
  return h('span', { class: 'avatar av' + idx, style: size ? '--sz:' + size + 'px' : null, 'aria-hidden': 'true', text: initials(name) });
}
// Arkaluonteisen keskustelun nimi listoissa: henkilön nimeltä näyttävä nimi lyhennetään nimikirjaimiksi (A. V.)
function listTitle(c) { return isSensitive(c) && looksLikePersonName(c.name) ? dottedInitials(c.name) : c.name; }
function shieldBadge() { return h('span', { class: 'shield', role: 'img', 'aria-label': 'Arkaluonteinen', title: 'Arkaluonteinen' }, ico('shield', 14)); }
function pill(status) { return h('span', { class: 'pill s-' + status, text: STATUS_LABEL[status] || STATUS_LABEL.muu }); }
function chIcon(ch, size) { return ico(CHANNELS.includes(ch) ? ch : 'other', size || 16); }

/* ----- Tila ----- */
const S = {
  mode: 'loading', store: null, owner: true, ready: false,
  profile: null, chats: {}, chatsReady: false, unsorted: [], unsortedReady: false,
  messages: [], msgsReady: false, openId: null, expanded: new Set(),
  view: 'chats', tab: 'chats', filter: 'all', q: '', device: 'mobile', input: 'touch', split: false, visibleIds: [],
  own: new Set(), idx: new Map(), imp: null,
  downloads: null, devInfo: null, sum: { sig: '', sent: null, loading: false }
};
const refreshers = new Set();
function notifyRefresh() { refreshers.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }

/* ----- Tallennusadapterit ----- */
function makeDbStore(db) {
  const chains = new Map();
  const serial = (path, fn) => {
    const prev = chains.get(path) || Promise.resolve();
    const p = prev.catch(() => { }).then(fn);
    chains.set(path, p);
    p.catch(() => { }).then(() => { if (chains.get(path) === p) chains.delete(path); });
    return p;
  };
  const snapDocs = q => q.docs.map(d => Object.assign({ id: d.id }, d.data()));
  return {
    mode: 'db',
    watchProfile(cb, err) { return db.doc('meta/profile').onSnapshot(s => cb(s.exists ? s.data() : null), err); },
    watchChats(cb, err) {
      return db.collection('chats').limit(1000).onSnapshot(q => { const o = {}; q.docs.forEach(d => { o[d.id] = d.data(); }); cb(o); }, err);
    },
    watchMessages(cid, cb, err) {
      return db.collection('chats/' + cid + '/messages').orderBy('at', 'desc').limit(1000).onSnapshot(q => cb(snapDocs(q)), err);
    },
    watchUnsorted(cb, err) { return db.collection('unsorted').limit(1000).onSnapshot(q => cb(snapDocs(q)), err); },
    async listMessages(cid) { return snapDocs(await db.collection('chats/' + cid + '/messages').orderBy('at', 'desc').limit(1000).get()); },
    async getDoc(path) { const s = await db.doc(path).get(); return s.exists ? s.data() : null; },
    // Kaikki raakadokumentit (migraatio, salasanan vaihto, tyhjennys). Viestejä haetaan enintään 1000 / keskustelu.
    async rawList() {
      const out = [];
      for (const p of ['meta/crypto', 'meta/profile']) { const s = await db.doc(p).get(); if (s.exists) out.push({ path: p, data: s.data() }); }
      const chats = await db.collection('chats').limit(1000).get();
      for (const d of chats.docs) {
        out.push({ path: 'chats/' + d.id, data: d.data() });
        const ms = await db.collection('chats/' + d.id + '/messages').orderBy('at', 'desc').limit(1000).get();
        ms.docs.forEach(m => out.push({ path: 'chats/' + d.id + '/messages/' + m.id, data: m.data() }));
      }
      const un = await db.collection('unsorted').limit(1000).get();
      un.docs.forEach(d => out.push({ path: 'unsorted/' + d.id, data: d.data() }));
      return out;
    },
    isSeeded() { return true; }, markSeeded() { },
    set(path, data) { return serial(path, () => db.doc(path).set(data)); },
    update(path, data) { return serial(path, () => db.doc(path).update(data)); },
    del(path) { return serial(path, () => db.doc(path).delete()); }
  };
}
/* Pysyvyyskerrokset paikalliselle tallennukselle: localStorage (esikatselu) ja IndexedDB (itsenäinen tila) */
const lsBackend = {
  kind: 'ls',
  async load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) { const o = JSON.parse(raw); if (o && o.v === 1 && o.M) return { M: o.M, seeded: o.seeded !== false }; }
    } catch (e) { /* ei localStoragea */ }
    return { docs: [], seeded: false };
  },
  async flush(dirty, M, seeded) { localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, M, seeded: !!seeded })); }
};
const idbReq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbTx = tx => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('abort')); });
async function makeIdbBackend() {
  if (!window.indexedDB) throw new Error('ei IndexedDB:tä');
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('hakuviestit', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('docs'); r.result.createObjectStore('meta'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked'));
  });
  return {
    kind: 'idb',
    async load() {
      const tx = db.transaction(['docs', 'meta'], 'readonly');
      const ds = tx.objectStore('docs');
      const keys = await idbReq(ds.getAllKeys()), vals = await idbReq(ds.getAll());
      const seeded = await idbReq(tx.objectStore('meta').get('seeded'));
      return { docs: keys.map((k, i) => ({ path: k, data: vals[i] })), seeded: !!seeded };
    },
    async flush(dirty, M, seeded) {
      const tx = db.transaction(['docs', 'meta'], 'readwrite');
      const ds = tx.objectStore('docs');
      dirty.forEach((v, p) => { if (v === undefined) ds.delete(p); else ds.put(v, p); });
      tx.objectStore('meta').put(!!seeded, 'seeded');
      await idbTx(tx);
    }
  };
}
async function makeLocalStore(backend) {
  let M = { profile: null, crypto: null, chats: {}, msgs: {}, unsorted: {}, diag: {} };
  const dirty = new Map();
  const loaded = await backend.load();
  let seeded = loaded.seeded;
  const watchers = new Set();
  let emitT = null, persistT = null, flushing = false;
  const emit = () => {
    if (emitT) return;
    emitT = setTimeout(() => { emitT = null; watchers.forEach(w => { try { w(); } catch (e) { console.error(e); } }); }, 30);
  };
  const persist = () => {
    clearTimeout(persistT);
    persistT = setTimeout(async function run() {
      if (flushing) { persistT = setTimeout(run, 200); return; }
      flushing = true;
      const batch = new Map(dirty); dirty.clear();
      try { await backend.flush(batch, M, seeded); }
      catch (e) { batch.forEach((v, p) => { if (!dirty.has(p)) dirty.set(p, v); }); window.dispatchEvent(new Event('hv-storage-full')); }
      flushing = false;
    }, 400);
  };
  const parse = path => {
    const p = path.split('/');
    if (p[0] === 'meta' && p[1] === 'profile' && p.length === 2) return { k: 'profile' };
    if (p[0] === 'meta' && p[1] === 'crypto' && p.length === 2) return { k: 'crypto' };
    if (p[0] === 'chats' && p.length === 2) return { k: 'chat', cid: p[1] };
    if (p[0] === 'chats' && p[2] === 'messages' && p.length === 4) return { k: 'msg', cid: p[1], mid: p[3] };
    if (p[0] === 'unsorted' && p.length === 2) return { k: 'uns', mid: p[1] };
    if (p[0] === 'diag' && p.length === 2) return { k: 'diag', mid: p[1] };
    return null;
  };
  const get = pp => pp.k === 'profile' ? M.profile : pp.k === 'crypto' ? M.crypto : pp.k === 'chat' ? M.chats[pp.cid] : pp.k === 'msg' ? (M.msgs[pp.cid] || {})[pp.mid] : pp.k === 'diag' ? M.diag[pp.mid] : M.unsorted[pp.mid];
  const put = (pp, v) => {
    if (pp.k === 'profile') M.profile = v;
    else if (pp.k === 'crypto') M.crypto = v === undefined ? null : v;
    else if (pp.k === 'chat') { if (v === undefined) delete M.chats[pp.cid]; else M.chats[pp.cid] = v; }
    else if (pp.k === 'msg') { const b = M.msgs[pp.cid] || (M.msgs[pp.cid] = {}); if (v === undefined) delete b[pp.mid]; else b[pp.mid] = v; }
    else if (pp.k === 'diag') { if (v === undefined) delete M.diag[pp.mid]; else M.diag[pp.mid] = v; }
    else if (v === undefined) delete M.unsorted[pp.mid]; else M.unsorted[pp.mid] = v;
  };
  const w = (fn, cb) => { const f = () => cb(fn()); watchers.add(f); setTimeout(f, 0); return () => watchers.delete(f); };
  const list = o => Object.keys(o || {}).map(id => Object.assign({ id }, o[id]));
  const putDoc = (path, data) => { const pp = parse(path); if (pp) { put(pp, data); dirty.set(path, data); } };
  if (loaded.M) { M = loaded.M; if (!('crypto' in M)) M.crypto = null; if (!M.diag) M.diag = {}; }
  else (loaded.docs || []).forEach(d => { const pp = parse(d.path); if (pp) put(pp, d.data); });
  const store = {
    mode: 'local', backend: backend.kind,
    // Esimerkkidata ladataan vain kerran, ja vasta salasanan asettamisen jälkeen (salattuna)
    isSeeded() { return seeded; },
    markSeeded() { seeded = true; persist(); },
    async getDoc(path) { const pp = parse(path); const v = pp && get(pp); return v ? clone(v) : null; },
    async rawList() {
      const out = [];
      if (M.crypto) out.push({ path: 'meta/crypto', data: M.crypto });
      if (M.profile) out.push({ path: 'meta/profile', data: M.profile });
      Object.keys(M.chats).forEach(id => out.push({ path: 'chats/' + id, data: M.chats[id] }));
      Object.keys(M.msgs).forEach(cid => Object.keys(M.msgs[cid]).forEach(mid => out.push({ path: 'chats/' + cid + '/messages/' + mid, data: M.msgs[cid][mid] })));
      Object.keys(M.unsorted).forEach(id => out.push({ path: 'unsorted/' + id, data: M.unsorted[id] }));
      Object.keys(M.diag).forEach(id => out.push({ path: 'diag/' + id, data: M.diag[id] }));
      return out;
    },
    // "Unohdin salasanan": poistaa kaiken ja nollaa esimerkkilipun
    async wipe() {
      const paths = (await store.rawList()).map(d => d.path);
      M = { profile: null, crypto: null, chats: {}, msgs: {}, unsorted: {}, diag: {} };
      paths.forEach(p => dirty.set(p, undefined));
      seeded = false; emit(); persist();
    },
    watchProfile(cb) { return w(() => M.profile, cb); },
    watchChats(cb) { return w(() => Object.assign({}, M.chats), cb); },
    watchMessages(cid, cb) { return w(() => list(M.msgs[cid]), cb); },
    watchUnsorted(cb) { return w(() => list(M.unsorted), cb); },
    async listMessages(cid) { return list(M.msgs[cid]); },
    set(path, data) {
      const pp = parse(path); if (!pp) return Promise.reject({ code: 'invalid_argument', message: path });
      putDoc(path, clone(data)); emit(); persist(); return Promise.resolve();
    },
    update(path, data) {
      const pp = parse(path); const cur = pp && get(pp);
      if (!cur) return Promise.reject({ code: 'invalid_argument', message: 'ei dokumenttia' });
      putDoc(path, mergeDeep(cur, clone(data))); emit(); persist(); return Promise.resolve();
    },
    del(path) {
      const pp = parse(path); if (pp) { put(pp, undefined); dirty.set(path, undefined); } emit(); persist(); return Promise.resolve();
    }
  };
  return store;
}

/* ----- Virheet ja kirjoitusjono ----- */
function errText(e) {
  const c = e && e.code;
  if (c === 'quota_exceeded') return 'Tallennustila täynnä – poista vanhoja keskusteluja';
  if (c === 'resource_exhausted') return 'Liikaa pyyntöjä, yritä hetken päästä uudelleen';
  if (c === 'revoked') return 'Käyttöoikeus tähän sovellukseen päättyi. Lataa sivu uudelleen.';
  if (c === 'unavailable') return 'Tallennus ei onnistunut juuri nyt. Yritä uudelleen.';
  return 'Tallennus epäonnistui' + (e && e.message ? ' (' + e.message + ')' : '');
}
async function writeOp(op) {
  const st = S.store;
  for (let attempt = 0; ; attempt++) {
    try {
      if (op.fn) return await op.fn();
      if (op.t === 'set') return await st.set(op.path, op.data);
      if (op.t === 'update') return await st.update(op.path, op.data);
      if (op.t === 'del') return await st.del(op.path);
      return;
    } catch (e) {
      const c = e && e.code;
      if (attempt === 0 && (c === 'resource_exhausted' || c === 'unavailable')) { await sleep(1000 + Math.random() * 2000); continue; }
      throw e;
    }
  }
}
async function runWrites(ops, o) {
  o = o || {};
  let i = 0, done = o.offset || 0, error = null;
  async function worker() {
    while (i < ops.length && !error) {
      const op = ops[i++];
      try { await writeOp(op); } catch (e) { if (!error) error = e; return; }
      done++;
      if (o.onProgress) o.onProgress(done);
    }
  }
  await Promise.all(Array.from({ length: Math.min(o.concurrency || 3, ops.length) }, worker));
  return { done, error };
}
// Yksinkertainen kirjoitus: ilmoittaa virheestä, palauttaa true onnistuessa
async function doWrites(ops, title) {
  if (!ops.length) return true;
  let pg = null;
  if (ops.length > 3) pg = showProgress(title || 'Tallennetaan', ops.length);
  const r = await runWrites(ops, { onProgress: n => pg && pg.set(n) });
  if (pg) pg.close();
  if (r.error) { toast(errText(r.error), 'bad'); return false; }
  return true;
}
async function recomputeStats(cid, extra, removedIds) {
  const chat = S.chats[cid];
  if (!chat) return;
  const list = await S.store.listMessages(cid);
  const map = new Map(list.map(m => [m.id, m]));
  (extra || []).forEach(m => map.set(m.id, m));
  (removedIds || []).forEach(id => map.delete(id));
  const stats = computeStats([...map.values()]);
  if (list.length >= 1000 && chat.stats) { stats.sent = Math.max(stats.sent, chat.stats.sent || 0); stats.received = Math.max(stats.received, chat.stats.received || 0); }
  await S.store.update('chats/' + cid, { stats, updatedAt: nowIso() });
}
function statsOp(cid, extra, removed) { return { fn: () => recomputeStats(cid, extra, removed) }; }

/* ----- Ilmoitukset, sheetit ----- */
function toast(msg, kind) {
  const t = h('div', { class: 'toast' + (kind ? ' ' + kind : ''), text: msg });
  $('#toasts').append(t);
  setTimeout(() => t.remove(), kind === 'bad' ? 5000 : 2600);
}
const sheetStack = [];
function openSheet(title, build, opts) {
  opts = opts || {};
  const prevFocus = document.activeElement;
  const body = h('div', { class: 'sheet-b' });
  const closeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Sulje', onclick: () => api.close() }, ico('x', 22));
  const titleEl = h('h2', { class: 'sheet-t', text: title });
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1' },
    h('div', { class: 'sheet-h' }, titleEl, opts.persistent ? null : closeBtn), body);
  const scrim = h('div', { class: 'scrim', onclick: () => { if (!opts.persistent) api.close(); } });
  const layer = h('div', { class: 'layer' + (opts.side ? ' side' : '') }, scrim, sheet);
  const api = {
    body, layer, closed: false, persistent: !!opts.persistent, refresh: null,
    setTitle(t) { titleEl.textContent = t; sheet.setAttribute('aria-label', t); },
    close(result) {
      if (api.closed) return;
      api.closed = true;
      if (api.refresh) refreshers.delete(api.refresh);
      layer.remove();
      const i = sheetStack.indexOf(api); if (i >= 0) sheetStack.splice(i, 1);
      if (!sheetStack.length) document.documentElement.classList.remove('noscroll');
      if (opts.onClose) opts.onClose(result);
      if (prevFocus && prevFocus.focus && document.contains(prevFocus)) { try { prevFocus.focus(); } catch (e) { } }
    },
    onRefresh(fn) { api.refresh = fn; refreshers.add(fn); }
  };
  $('#layers').append(layer);
  sheetStack.push(api);
  document.documentElement.classList.add('noscroll');
  build(body, api);
  const first = body.querySelector('input:not([type=hidden]),select,textarea,button.btn') || sheet;
  try { first.focus({ preventScroll: true }); } catch (e) { }
  return api;
}
document.addEventListener('keydown', e => {
  if (S.device === 'desktop' && !S.locked && (e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); lockNow(); return; }
  const top = sheetStack[sheetStack.length - 1];
  if (!top) { desktopKeys(e); return; }
  if (e.key === 'Escape' && !top.persistent) { top.close(); return; }
  if (e.key === 'Tab') {
    const f = [...top.layer.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(x => !x.disabled && !x.hidden && x.offsetParent !== null);
    if (!f.length) return;
    const a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }
});
function confirmSheet(o) {
  return new Promise(resolve => {
    let res = false;
    openSheet(o.title, (body, api) => {
      body.append(
        h('p', { class: 'hint', style: 'font-size:15px;color:var(--ink);margin-bottom:14px', text: o.text }),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', type: 'button', id: 'cf-cancel', text: 'Peruuta', onclick: () => api.close() }),
          h('button', { class: 'btn ' + (o.danger ? 'dangerfill' : 'primary'), type: 'button', id: 'cf-ok', text: o.ok || 'Vahvista', onclick: () => { res = true; api.close(); } })));
    }, { onClose: () => resolve(res) });
  });
}
function showProgress(title, total) {
  const bar = h('i'), lbl = h('p', { class: 'hint', 'aria-live': 'polite' });
  const sh = openSheet(title, body => { body.append(h('div', { class: 'prog' }, bar), lbl); }, { persistent: true });
  let tot = total;
  const api = {
    setTotal(t) { tot = t; },
    set(n, label) {
      bar.style.width = Math.min(100, Math.round(100 * n / Math.max(1, tot))) + '%';
      lbl.textContent = (label || 'Tallennetaan') + ' ' + n + '/' + tot;
    },
    close() { sh.close(); }
  };
  api.set(0);
  return api;
}
function textFallbackSheet(text) {
  openSheet('Kopioi teksti', body => {
    const ta = h('textarea', { id: 'cp-text', readonly: true, rows: '8', value: text });
    body.append(h('p', { class: 'hint', text: 'Automaattinen kopiointi ei onnistunut. Valitse teksti ja kopioi se.' }), ta);
    setTimeout(() => { try { ta.focus(); ta.select(); } catch (e) { } }, 50);
  });
}
function copyText(text, el) {
  const fail = () => {
    if (el) {
      try { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { }
      toast('Valitse teksti ja kopioi');
    } else textFallbackSheet(text);
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('Kopioitu'), fail);
    } else fail();
  } catch (e) { fail(); }
}
window.addEventListener('hv-storage-full', () => toast('Selaimen tallennustila on täynnä – tiedot eivät tallennu', 'bad'));

/* ----- Lomakeapurit ----- */
function field(id, label, control, hint) {
  return h('div', { class: 'field' }, h('label', { for: id, text: label }), control, hint ? h('span', { class: 'hint', text: hint }) : null);
}
// Tyylitelty tiedostonvalinta: label + visuaalisesti piilotettu (ei display:none) input[type=file]
function fileField(id, label, o) {
  o = o || {};
  const input = h('input', { id, type: 'file', class: 'sr-file', multiple: o.multiple, accept: o.accept });
  const fn = h('span', { class: 'fn', text: 'Ei valittua tiedostoa' });
  input.addEventListener('change', () => {
    const f = [...input.files];
    fn.textContent = !f.length ? 'Ei valittua tiedostoa' : f.length === 1 ? f[0].name : f.length + ' tiedostoa';
    if (o.onFiles && f.length) { o.onFiles(f); input.value = ''; }
  });
  const el = h('div', { class: 'field' }, h('span', { class: 'lbl', text: label }),
    h('label', { class: 'filebtn', for: id }, input, h('span', { class: 'fb', text: o.btn || 'Valitse tiedostot' }), fn),
    o.hint ? h('span', { class: 'hint', text: o.hint }) : null);
  return { el, input };
}
function multiField(base, label, type, vals, ph, addLabel) {
  const rows = h('div'); let n = 0;
  const wrap = h('div', { class: 'field' }, h('span', { class: 'lbl', text: label }), rows);
  function addRow(v) {
    const id = base + '-' + (n++);
    const input = h('input', { id, type: type === 'tel' ? 'tel' : 'text', inputmode: type === 'tel' ? 'tel' : 'email', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: ph, value: v || '', 'aria-label': label });
    const rm = h('button', { class: 'icon-btn', type: 'button', id: id + '-rm', 'aria-label': 'Poista rivi', onclick: () => { row.remove(); } }, ico('x', 18));
    const row = h('div', { class: 'multi-row' }, input, rm);
    rows.append(row);
  }
  (vals && vals.length ? vals : ['']).forEach(addRow);
  wrap.append(h('div', null, h('button', { class: 'small-btn', type: 'button', id: base + '-add', text: '+ ' + addLabel, onclick: () => addRow('') })));
  return { el: wrap, values: () => [...rows.querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean) };
}
function personForm(prefix, init) {
  init = init || {};
  const name = h('input', { id: prefix + '-name', type: 'text', autocomplete: 'off', placeholder: 'esim. Maija Meikäläinen', value: init.name || '' });
  const role = h('input', { id: prefix + '-role', type: 'text', autocomplete: 'off', placeholder: 'esim. Rekrytoija', value: init.role || '' });
  const em = multiField(prefix + '-email', 'Sähköpostit', 'email', init.emails, 'nimi@yritys.fi', 'Lisää toinen osoite');
  const ph = multiField(prefix + '-phone', 'Puhelinnumerot', 'tel', init.phones, '040 123 4567', 'Lisää toinen numero');
  const err = h('p', { class: 'err', role: 'alert', hidden: true });
  return {
    els: [field(prefix + '-name', 'Nimi', name), field(prefix + '-role', 'Rooli', role), em.el, ph.el, err],
    read() {
      err.hidden = true;
      const emails = [], phones = [];
      for (const v of em.values()) {
        const e = normEmail(v);
        if (!isEmail(e)) return fail('Tarkista sähköpostiosoite "' + v + '". Kirjoita se muodossa nimi@yritys.fi.');
        if (!emails.includes(e)) emails.push(e);
      }
      for (const v of ph.values()) {
        const p = normPhone(v);
        if (!isPhone(p)) return fail('Tarkista puhelinnumero "' + v + '". Kirjoita se esim. 040 123 4567 tai +358 40 123 4567.');
        if (!phones.includes(p)) phones.push(p);
      }
      return { ok: true, name: name.value.trim(), role: role.value.trim(), emails, phones };
      function fail(msg) { err.textContent = msg; err.hidden = false; return { ok: false }; }
    }
  };
}
function statusSelect(id, value) {
  return h('select', { id }, STATUSES.map(s => h('option', { value: s, selected: s === value, text: STATUS_LABEL[s] })));
}

/* ----- Indeksit ----- */
function rebuildIndexes() {
  S.own = buildOwnSet(S.profile && S.profile.identities);
  S.idx = buildAddrIndex(S.chats);
}
function chatKeys(chat) {
  const set = new Set();
  for (const m of (chat.members || [])) {
    (m.emails || []).forEach(e => set.add('e:' + normEmail(e)));
    (m.phones || []).forEach(p => set.add('p:' + normPhone(p)));
  }
  return set;
}
function ownAddr(kind) {
  const ids = (S.profile && S.profile.identities) || [];
  const f = ids.find(i => i.type === kind) || ids[0];
  return f ? f.value : '';
}
function chatList() {
  return Object.keys(S.chats).map(id => Object.assign({ id }, S.chats[id]));
}
function chatSortKey(c) { return Date.parse((c.stats && c.stats.lastAt) || c.createdAt) || 0; }
