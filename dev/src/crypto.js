//#CRYPTO-START
/* ===== Salaus (WebCrypto): PBKDF2-SHA256 600 000 kierrosta + AES-GCM-256 ===== */
const PBKDF2_ITER = 600000;
const CHECK_TEXT = 'hakuviestit-check-v1';
const clone = x => JSON.parse(JSON.stringify(x));
function mergeDeep(a, b) {
  const o = Object.assign({}, a);
  for (const k of Object.keys(b)) {
    const v = b[k];
    o[k] = (v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) ? mergeDeep(o[k], v) : v;
  }
  return o;
}
function b64e(u8) {
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}
function b64d(s) {
  const bin = atob(s), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
const _te = new TextEncoder(), _td = new TextDecoder();
const _subtle = () => globalThis.crypto.subtle;
const _rand = n => globalThis.crypto.getRandomValues(new Uint8Array(n));
// Avain on non-extractable eikä sitä tallenneta minnekään
async function deriveKey(password, salt, iter) {
  const base = await _subtle().importKey('raw', _te.encode(String(password)), 'PBKDF2', false, ['deriveKey']);
  return _subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
// Uusi satunnainen 12 tavun IV joka kirjoituksella; aad sitoo salatekstin polkuun
async function encBytes(key, bytes, aad) {
  const iv = _rand(12);
  const ct = new Uint8Array(await _subtle().encrypt({ name: 'AES-GCM', iv, additionalData: _te.encode(aad) }, key, bytes));
  return { iv: b64e(iv), ct: b64e(ct) };
}
async function decBytes(key, enc, aad) {
  return new Uint8Array(await _subtle().decrypt({ name: 'AES-GCM', iv: b64d(enc.iv), additionalData: _te.encode(aad) }, key, b64d(enc.ct)));
}
const encObj = (key, obj, aad) => encBytes(key, _te.encode(JSON.stringify(obj)), aad);
const decObj = async (key, enc, aad) => JSON.parse(_td.decode(await decBytes(key, enc, aad)));
// Uusi salasana: satunnainen 16 tavun suola + tarkistusarvo
async function createCrypto(password, iter) {
  iter = iter || PBKDF2_ITER;
  const salt = _rand(16);
  const key = await deriveKey(password, salt, iter);
  const check = await encBytes(key, _te.encode(CHECK_TEXT), 'check');
  return { key, meta: { v: 1, kdf: 'PBKDF2-SHA256', iter, salt: b64e(salt), check } };
}
// Palauttaa avaimen tai null (väärä salasana tai viallinen meta)
async function openCrypto(password, meta) {
  try {
    if (!meta || meta.v !== 1 || meta.kdf !== 'PBKDF2-SHA256' || !(meta.iter >= 1 && meta.iter <= 10000000) || !meta.check) return null;
    const key = await deriveKey(password, b64d(meta.salt), meta.iter);
    const t = _td.decode(await decBytes(key, meta.check, 'check'));
    return t === CHECK_TEXT ? key : null;
  } catch (e) { return null; }
}
/* ----- Biometrinen avaus (WebAuthn PRF): salasana salataan PRF-salaisuudesta johdetulla avaimella ----- */
const BIO_INFO = 'hakuviestit-bio-v1';
async function bioKey(prf) {
  const base = await _subtle().importKey('raw', new Uint8Array(prf), 'HKDF', false, ['deriveKey']);
  return _subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: _te.encode(BIO_INFO) }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
// prf: 32 tavua (WebAuthn PRF -tulos). Palauttaa {iv, ct} (base64)
async function bioWrap(prf, password) {
  const key = await bioKey(prf), iv = _rand(12);
  const ct = new Uint8Array(await _subtle().encrypt({ name: 'AES-GCM', iv, additionalData: _te.encode('bio') }, key, _te.encode(String(password))));
  return { iv: b64e(iv), ct: b64e(ct) };
}
// Palauttaa salasanan tai null (väärä PRF tai muokattu salateksti)
async function bioUnwrap(prf, bio) {
  try {
    if (!bio || !bio.iv || !bio.ct) return null;
    const key = await bioKey(prf);
    return _td.decode(await _subtle().decrypt({ name: 'AES-GCM', iv: b64d(bio.iv), additionalData: _te.encode('bio') }, key, b64d(bio.ct)));
  } catch (e) { return null; }
}
const isEncDoc = d => !!(d && d.enc && d.enc.iv && d.enc.ct);
function docKind(path) {
  const p = String(path).split('/');
  if (p[0] === 'meta' && p[1] === 'crypto' && p.length === 2) return 'crypto';
  if (p[0] === 'meta' && p[1] === 'profile' && p.length === 2) return 'profile';
  if (p[0] === 'chats' && p.length === 2) return 'chat';
  if (p[0] === 'chats' && p[2] === 'messages' && p.length === 4) return 'msg';
  if (p[0] === 'unsorted' && p.length === 2) return 'uns';
  return null;
}
// Selväkieliset polut (allow-list): vain kehittäjän diagnostiikka, ei koskaan viestien sisältöä
const isPlainPath = path => String(path).startsWith('diag/') && /^[A-Za-z0-9_-]{1,40}$/.test(String(path).slice(5));
// Viesteissä (ja lajittelemattomissa) vain `at` jää selväkieliseksi järjestystä varten
async function encDoc(key, path, data) {
  const k = docKind(path);
  if (!k && !isPlainPath(path)) throw { code: 'invalid_argument', message: 'tuntematon polku' };
  if (!k || k === 'crypto') return data;
  if (k === 'msg' || k === 'uns') {
    const rest = Object.assign({}, data); delete rest.at;
    return { v: 1, at: data.at, enc: await encObj(key, rest, path) };
  }
  return { v: 1, enc: await encObj(key, data, path) };
}
async function decDoc(key, path, raw) {
  if (!raw) return null;
  if (!raw.enc) return raw;
  const o = await decObj(key, raw.enc, path);
  if (raw.at !== undefined) o.at = raw.at;
  return o;
}
// Salaava kääre tallennusadapterin ympärille: muu sovellus näkee selväkielisen datan
function makeCryptoStore(inner, key) {
  let closed = false;
  const cache = new Map(), plainByPath = new Map(), unsubs = new Set();
  const dec = async (path, raw) => {
    if (!raw) return null;
    if (!raw.enc) return raw;
    const ck = path + '|' + raw.enc.ct;
    if (cache.has(ck)) return cache.get(ck);
    const o = await decDoc(key, path, raw);
    cache.set(ck, o);
    return o;
  };
  const safe = async (path, raw) => { try { return await dec(path, raw); } catch (e) { return undefined; } };
  const strip = r => { const x = Object.assign({}, r); delete x.id; return x; };
  const track = (unsub) => { unsubs.add(unsub); return () => { unsubs.delete(unsub); unsub(); }; };
  const store = {
    mode: inner.mode, backend: inner.backend,
    watchProfile(cb, err) {
      let gen = 0;
      return track(inner.watchProfile(async raw => {
        const my = ++gen; const o = raw ? await safe('meta/profile', raw) : null;
        if (my !== gen || closed) return;
        if (o) plainByPath.set('meta/profile', o);
        cb(o || null);
      }, err));
    },
    watchChats(cb, err) {
      let gen = 0;
      return track(inner.watchChats(async rawMap => {
        const my = ++gen; const out = {};
        await Promise.all(Object.keys(rawMap).map(async id => { const o = await safe('chats/' + id, rawMap[id]); if (o) { out[id] = o; plainByPath.set('chats/' + id, o); } }));
        if (my !== gen || closed) return;
        cb(out);
      }, err));
    },
    watchMessages(cid, cb, err) {
      let gen = 0;
      return track(inner.watchMessages(cid, async list => {
        const my = ++gen;
        const out = (await Promise.all(list.map(async r => { const o = await safe('chats/' + cid + '/messages/' + r.id, strip(r)); return o ? Object.assign({ id: r.id }, o) : null; }))).filter(Boolean);
        if (my !== gen || closed) return;
        cb(out);
      }, err));
    },
    watchUnsorted(cb, err) {
      let gen = 0;
      return track(inner.watchUnsorted(async list => {
        const my = ++gen;
        const out = (await Promise.all(list.map(async r => { const o = await safe('unsorted/' + r.id, strip(r)); return o ? Object.assign({ id: r.id }, o) : null; }))).filter(Boolean);
        if (my !== gen || closed) return;
        cb(out);
      }, err));
    },
    async listMessages(cid) {
      const list = await inner.listMessages(cid);
      return (await Promise.all(list.map(async r => { const o = await safe('chats/' + cid + '/messages/' + r.id, strip(r)); return o ? Object.assign({ id: r.id }, o) : null; }))).filter(Boolean);
    },
    async set(path, data) {
      if (closed) throw { code: 'revoked', message: 'lukittu' };
      const doc = await encDoc(key, path, data);
      const k = docKind(path);
      if (k && k !== 'msg' && k !== 'uns' && k !== 'crypto') plainByPath.set(path, clone(data));
      return inner.set(path, doc);
    },
    async update(path, data) {
      let cur = plainByPath.get(path);
      if (!cur) {
        const raw = await inner.getDoc(path);
        if (!raw) throw { code: 'invalid_argument', message: 'ei dokumenttia' };
        cur = await dec(path, raw);
      }
      return store.set(path, mergeDeep(cur, clone(data)));
    },
    del(path) { plainByPath.delete(path); return inner.del(path); },
    close() { closed = true; cache.clear(); plainByPath.clear(); unsubs.forEach(u => { try { u(); } catch (e) { /* ok */ } }); unsubs.clear(); }
  };
  return store;
}
// Salasanan vahvuus (0-3) ja selite
function passwordStrength(pw) {
  pw = String(pw || '');
  let pool = 0;
  if (/[a-zäöå]/.test(pw)) pool += 26;
  if (/[A-ZÄÖÅ]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9äöåÄÖÅ]/.test(pw)) pool += 32;
  const uniq = new Set(pw).size;
  const per = Math.log2(Math.max(pool, 2));
  let bits = Math.min(pw.length, uniq * 1.5) * per;
  if (/^(.)\1+$/.test(pw) || /^(0123|1234|abcd|qwer|password|salasana)/i.test(pw)) bits = Math.min(bits, 20);
  const score = !pw ? 0 : bits < 40 ? 0 : bits < 58 ? 1 : bits < 80 ? 2 : 3;
  return { score, bits: Math.round(bits), label: ['Heikko', 'Välttävä', 'Hyvä', 'Vahva'][score] };
}
//#CRYPTO-END
