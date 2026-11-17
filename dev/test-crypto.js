// Salauksen yksikkötestit (Node WebCrypto). Käyttö: node test-crypto.js <hakuviestit.html>
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8');
const sec = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); if (i < 0 || j < 0) throw new Error('marker ' + a); return html.slice(i, j + b.length); };
const code = sec('//#PURE-START', '//#PURE-END') + '\n' + sec('//#CRYPTO-START', '//#CRYPTO-END') + '\n' + sec('//#EXAMPLE-START', '//#EXAMPLE-END');
const names = 'createCrypto openCrypto deriveKey encObj decObj encBytes decBytes encDoc decDoc isEncDoc docKind makeCryptoStore passwordStrength bioWrap bioUnwrap isPlainPath b64e b64d buildExampleDocs PBKDF2_ITER clone'.split(' ');
const ctx = { TextDecoder, TextEncoder, atob, btoa, console, crypto: globalThis.crypto, Math, Date, Uint8Array, JSON, Promise, setTimeout };
vm.createContext(ctx);
vm.runInContext(code + '\nglobalThis.__x={' + names.join(',') + '};', ctx);
const X = ctx.__x;
let pass = 0, fail = 0;
const ok = (n, c, i) => { if (c) pass++; else { fail++; console.log('FAIL', n, i === undefined ? '' : JSON.stringify(i)); } };
const throws = async (n, fn) => { try { await fn(); fail++; console.log('FAIL (ei heittänyt)', n); } catch (e) { pass++; } };

// Fake raakatallennus (sama rajapinta kuin DbStore/LocalStore)
function fakeInner() {
  const docs = new Map(), watchers = new Set();
  const emit = () => watchers.forEach(f => f());
  const parse = p => { const s = p.split('/'); return s; };
  const list = pred => [...docs.keys()].filter(pred).map(k => Object.assign({ id: k.split('/').pop() }, docs.get(k)));
  const w = (fn, cb) => { const f = () => cb(fn()); watchers.add(f); setTimeout(f, 0); return () => watchers.delete(f); };
  return {
    mode: 'local', docs,
    watchProfile: cb => w(() => docs.get('meta/profile') || null, cb),
    watchChats: cb => w(() => { const o = {}; [...docs.keys()].filter(k => /^chats\/[^/]+$/.test(k)).forEach(k => { o[k.split('/')[1]] = docs.get(k); }); return o; }, cb),
    watchMessages: (cid, cb) => w(() => list(k => k.startsWith('chats/' + cid + '/messages/')), cb),
    watchUnsorted: cb => w(() => list(k => /^unsorted\/[^/]+$/.test(k)), cb),
    listMessages: async cid => list(k => k.startsWith('chats/' + cid + '/messages/')),
    getDoc: async p => (docs.has(p) ? JSON.parse(JSON.stringify(docs.get(p))) : null),
    set: async (p, d) => { docs.set(p, JSON.parse(JSON.stringify(d))); emit(); },
    del: async p => { docs.delete(p); emit(); },
    rawList: async () => [...docs.keys()].map(k => ({ path: k, data: docs.get(k) }))
  };
}
const once = (reg) => new Promise(res => { let un; un = reg(v => { res(v); }); });
const SECRETS = ['Valio', 'Kesko', 'Fazer', 'Posti', 'Mäkinen', 'Heli', 'Mikko', 'Sari', 'Pekka', 'example.fi', 'oma.esimerkki', '+3585', '+3584', 'Hakemus', 'haastattelu', 'tarjous', 'odottaa', 'hylatty', 'rekry@', 'Terveisin', 'lastPreview', 'subject', 'body', 'members', 'identities', 'Gmail', 'Esimerkki'];

(async () => {
  const ITER = 2000; // nopeampi testeissä; oletus tarkistetaan erikseen
  ok('oletus 600000', X.PBKDF2_ITER === 600000);

  // --- oikea 600 000 kierroksen meta kerran ---
  const t0 = Date.now();
  const real = await X.createCrypto('salasana-12345');
  const tReal = Date.now() - t0;
  ok('meta-muoto', real.meta.v === 1 && real.meta.kdf === 'PBKDF2-SHA256' && real.meta.iter === 600000 && X.b64d(real.meta.salt).length === 16 && real.meta.check.iv && real.meta.check.ct, real.meta);
  ok('check-iv 12 tavua', X.b64d(real.meta.check.iv).length === 12);
  ok('oikea salasana avaa (600k)', !!(await X.openCrypto('salasana-12345', real.meta)));
  ok('väärä salasana hylätään (600k)', (await X.openCrypto('salasana-12346', real.meta)) === null);
  ok('tyhjä/viallinen meta hylätään', (await X.openCrypto('x', null)) === null && (await X.openCrypto('x', { v: 2 })) === null && (await X.openCrypto('x', Object.assign({}, real.meta, { iter: 0 }))) === null);
  await throws('avain ei ole exportattavissa', () => crypto.subtle.exportKey('raw', real.key));
  ok('avain: AES-GCM 256, extractable=false', real.key.extractable === false && real.key.algorithm.name === 'AES-GCM' && real.key.algorithm.length === 256, real.key.algorithm);
  console.log('  (PBKDF2 600k aika node:ssa: ' + tReal + ' ms)');

  const { key, meta } = await X.createCrypto('testi-salasana-1', ITER);
  const key2 = (await X.createCrypto('toinen-salasana-2', ITER)).key;

  // --- edestakainen ---
  const obj = { name: 'Valio – myyntiassistentti', members: [{ name: 'Heli Ranta', emails: ['rekry@valio.example.fi'] }], n: 5 };
  const enc = await X.encObj(key, obj, 'chats/c1');
  ok('roundtrip', JSON.stringify(await X.decObj(key, enc, 'chats/c1')) === JSON.stringify(obj));
  await throws('väärä avain', () => X.decObj(key2, enc, 'chats/c1'));
  await throws('väärä polku (AAD)', () => X.decObj(key, enc, 'chats/c2'));
  const tam = Object.assign({}, enc, { ct: enc.ct.slice(0, -4) + (enc.ct.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA') });
  await throws('peukaloitu salateksti', () => X.decObj(key, tam, 'chats/c1'));
  ok('ei selväkieltä salatekstissä', !JSON.stringify(enc).includes('Valio') && !JSON.stringify(enc).includes('rekry'));

  // --- IV uniikki ---
  const ivs = new Set(), cts = new Set();
  for (let i = 0; i < 300; i++) { const e = await X.encObj(key, { a: 1 }, 'p'); ivs.add(e.iv); cts.add(e.ct); if (X.b64d(e.iv).length !== 12) fail++; }
  ok('IV eri joka kirjoituksella (300)', ivs.size === 300 && cts.size === 300, [ivs.size, cts.size]);

  // --- dokumenttimuoto ---
  const m = await X.encDoc(key, 'chats/c1/messages/m1', { at: '2026-10-12T10:05:00+03:00', dir: 'in', body: 'Salainen runko', subject: 'Salainen aihe', from: 'a@b.fi' });
  ok('viesti: vain v, at, enc', Object.keys(m).sort().join() === 'at,enc,v' && m.at === '2026-10-12T10:05:00+03:00' && m.v === 1 && X.isEncDoc(m), m);
  const u = await X.encDoc(key, 'unsorted/u1', { at: '2026-10-01T00:00:00Z', body: 'x', suggestedName: 'Joku' });
  ok('unsorted: vain v, at, enc', Object.keys(u).sort().join() === 'at,enc,v');
  const c = await X.encDoc(key, 'chats/c1', { name: 'N', stats: {} });
  ok('chat: vain v, enc', Object.keys(c).sort().join() === 'enc,v');
  const p = await X.encDoc(key, 'meta/profile', { identities: [] });
  ok('profile: vain v, enc', Object.keys(p).sort().join() === 'enc,v');
  const mp = await X.encDoc(key, 'meta/crypto', meta);
  ok('meta/crypto ei salata', mp === meta);
  const back = await X.decDoc(key, 'chats/c1/messages/m1', m);
  ok('viesti purkautuu (at palautuu)', back.at === '2026-10-12T10:05:00+03:00' && back.body === 'Salainen runko' && back.subject === 'Salainen aihe');

  // --- koko esimerkkidata kääreen läpi: raakatallennuksessa ei selväkieltä ---
  const inner = fakeInner();
  const w = X.makeCryptoStore(inner, key);
  const ex = X.buildExampleDocs();
  for (const d of ex) await w.set(d.path, d.data);
  const raw = JSON.stringify([...inner.docs.entries()]);
  const leaks = SECRETS.filter(s => raw.includes(s));
  ok('raakatallennuksessa ei selväkielisiä arvoja (' + ex.length + ' dok.)', leaks.length === 0, leaks);
  const rawKeys = new Set(); inner.docs.forEach(v => Object.keys(v).forEach(k => rawKeys.add(k)));
  ok('raakadokumenttien kentät vain v/at/enc', [...rawKeys].sort().join() === 'at,enc,v', [...rawKeys]);
  ok('kaikki dokumentit salattu', [...inner.docs.values()].every(X.isEncDoc));
  const chats = await once(cb => w.watchChats(cb));
  ok('chats purkautuu', Object.keys(chats).length === 5 && chats['ex-valio'].name.startsWith('Valio') && chats['ex-valio'].stats.sent > 0 && chats['ex-valio'].members.length === 2, Object.keys(chats));
  const msgs = await once(cb => w.watchMessages('ex-valio', cb));
  ok('viestit purkautuvat', msgs.length === 11 && msgs.every(x => x.id && x.at && x.body !== undefined && x.dir) && msgs[0].id.startsWith('m'));
  const lm = await w.listMessages('ex-valio');
  ok('listMessages purkaa', lm.length === 11);
  const prof = await once(cb => w.watchProfile(cb));
  ok('profiili purkautuu', prof.identities.length === 2);
  // update (merge)
  await w.update('chats/ex-valio', { stats: { sent: 99 }, status: 'tarjous' });
  const c2 = await once(cb => w.watchChats(cb));
  ok('update yhdistää ja salaa', c2['ex-valio'].stats.sent === 99 && c2['ex-valio'].stats.received > 0 && c2['ex-valio'].status === 'tarjous' && !JSON.stringify([...inner.docs.entries()]).includes('tarjous'), c2['ex-valio'].stats);
  // eri IV samalle sisällölle
  const a1 = JSON.stringify(inner.docs.get('chats/ex-valio'));
  await w.set('chats/ex-valio', c2['ex-valio']);
  const a2 = JSON.stringify(inner.docs.get('chats/ex-valio'));
  ok('sama sisältö, uusi IV ja salateksti', a1 !== a2 && inner.docs.get('chats/ex-valio').enc.iv !== JSON.parse(a1).enc.iv);
  // väärä avain ei lue mitään
  const wBad = X.makeCryptoStore(inner, key2);
  const bad = await once(cb => wBad.watchChats(cb));
  ok('väärällä avaimella ei saa dataa', Object.keys(bad).length === 0, Object.keys(bad));
  // lukitus: close() lopettaa ja kirjoitus estyy
  w.close();
  await throws('kirjoitus lukitun kääreen läpi estetty', () => w.set('chats/x', { name: 'x' }));

  // --- selväkielinen vanha dokumentti luetaan läpi (migraatiota varten) ---
  const inner2 = fakeInner();
  inner2.docs.set('chats/old', { name: 'Vanha', status: 'muu' });
  const w2 = X.makeCryptoStore(inner2, key);
  const old = await once(cb => w2.watchChats(cb));
  ok('legacy plain luetaan', old.old && old.old.name === 'Vanha');
  // migraatio: salaa uudelleen samalle polulle ja tarkista
  const plain = inner2.docs.get('chats/old');
  await w2.set('chats/old', plain);
  const rawOld = inner2.docs.get('chats/old');
  ok('migraatio korvaa selväkielisen', X.isEncDoc(rawOld) && !JSON.stringify(rawOld).includes('Vanha'));
  ok('migraation tarkistus lukemalla takaisin', JSON.stringify(await X.decDoc(key, 'chats/old', rawOld)) === JSON.stringify(plain));

  // --- salasanan vaihto: uudelleensalaus ---
  const { key: nk } = await X.createCrypto('uusi-salasana-33', ITER);
  const before = new Map(inner.docs);
  const w3src = X.makeCryptoStore(inner, key); // uusi kääre samaan raakaan
  const all = [...inner.docs.keys()];
  for (const pth of all) { const pl = await X.decDoc(key, pth, inner.docs.get(pth)); inner.docs.set(pth, await X.encDoc(nk, pth, pl)); }
  await throws('vanha avain ei avaa vaihdon jälkeen', () => X.decDoc(key, 'chats/ex-kesko', inner.docs.get('chats/ex-kesko')));
  ok('uusi avain avaa kaiken', (await Promise.all(all.map(async pth => (await X.decDoc(nk, pth, inner.docs.get(pth))) !== null))).every(Boolean));
  ok('vaihdon jälkeen ei selväkieltä', SECRETS.filter(s => JSON.stringify([...inner.docs.entries()]).includes(s)).length === 0);
  w3src.close();

  // --- salasanan vahvuus ---
  const S = X.passwordStrength;
  ok('vahvuus: heikko', S('aaaaaaaaaa').score === 0 && S('1234567890').score === 0 && S('salasana12').score <= 1, [S('aaaaaaaaaa'), S('1234567890'), S('salasana12')]);
  ok('vahvuus: vahva', S('Kx7#mQ2!vR9$tLw4').score === 3, S('Kx7#mQ2!vR9$tLw4'));
  ok('vahvuus: kohtalainen välillä', S('kahvikuppi2026').score >= 1 && S('kahvikuppi2026').score <= 2, S('kahvikuppi2026'));
  ok('vahvuus: tyhjä', S('').score === 0 && S('').label === 'Heikko');
  ok('docKind', X.docKind('chats/a') === 'chat' && X.docKind('chats/a/messages/b') === 'msg' && X.docKind('unsorted/x') === 'uns' && X.docKind('meta/profile') === 'profile' && X.docKind('meta/crypto') === 'crypto' && X.docKind('foo/bar') === null);

  
  // --- biometrinen avaus (WebAuthn PRF): kiinteät PRF-tavut ---
  {
    const prf = new Uint8Array(32).map((_, i) => i * 7 + 1), prf2 = new Uint8Array(32).map((_, i) => i * 7 + 2);
    const pw = 'Salasana-Ääkköset-€-1234';
    const w = await X.bioWrap(prf, pw);
    ok('bioWrap: {iv, ct} base64, 12-byte iv', Object.keys(w).sort().join() === 'ct,iv' && X.b64d(w.iv).length === 12 && X.b64d(w.ct).length === Buffer.byteLength(pw) + 16, w);
    ok('bio round trip (unicode password)', (await X.bioUnwrap(prf, w)) === pw);
    ok('bio round trip accepts ArrayBuffer PRF', (await X.bioUnwrap(prf.buffer.slice(0), w)) === pw);
    ok('bio wrong PRF -> null', (await X.bioUnwrap(prf2, w)) === null);
    const flip = (b64, i) => { const u = X.b64d(b64); u[i] ^= 1; return X.b64e(u); };
    ok('bio tampered ciphertext -> null', (await X.bioUnwrap(prf, Object.assign({}, w, { ct: flip(w.ct, 3) }))) === null);
    ok('bio tampered tag -> null', (await X.bioUnwrap(prf, Object.assign({}, w, { ct: flip(w.ct, X.b64d(w.ct).length - 1) }))) === null);
    ok('bio tampered iv -> null', (await X.bioUnwrap(prf, Object.assign({}, w, { iv: flip(w.iv, 0) }))) === null);
    ok('bio missing/garbage fields -> null (no throw)', (await X.bioUnwrap(prf, null)) === null && (await X.bioUnwrap(prf, {})) === null && (await X.bioUnwrap(prf, { iv: '!!', ct: '??' })) === null);
    const w2 = await X.bioWrap(prf, pw);
    ok('bio fresh IV each time', w.iv !== w2.iv && w.ct !== w2.ct);
    ok('bio ciphertext has no plaintext password', !JSON.stringify(w).includes('Salasana') && !Buffer.from(X.b64d(w.ct)).toString('latin1').includes('Salasana'));
  }
  // --- selväkielinen diag/-polku (allow-list) ---
  {
    const innerD = fakeInner(); const { key: dk } = await X.createCrypto('diag-salasana-12', ITER);
    const wd = X.makeCryptoStore(innerD, dk);
    await wd.set('diag/send', { at: 'x', code: 'tool_error', message: 'Virhe <email>' });
    ok('diag/send stored as plaintext, not encrypted', innerD.docs.get('diag/send').code === 'tool_error' && !X.isEncDoc(innerD.docs.get('diag/send')));
    ok('isPlainPath: only diag/<id>', X.isPlainPath('diag/send') && X.isPlainPath('diag/send-reply') && !X.isPlainPath('diag/') && !X.isPlainPath('diag/a/b') && !X.isPlainPath('diagx/send') && !X.isPlainPath('chats/a') && !X.isPlainPath('meta/profile'));
    await throws('unknown path is rejected (no accidental plaintext)', () => wd.set('foo/bar', { body: 'salainen' }));
    await throws('nested diag path rejected', () => wd.set('diag/a/b', { x: 1 }));
    await wd.set('chats/c1', { name: 'Salainen nimi' });
    ok('chats still encrypted next to diag', X.isEncDoc(innerD.docs.get('chats/c1')) && !JSON.stringify(innerD.docs.get('chats/c1')).includes('Salainen'));
    ok('every non-diag doc is encrypted', [...innerD.docs.entries()].filter(([p]) => !p.startsWith('diag/')).every(([, d]) => X.isEncDoc(d)));
    wd.close();
  }

  console.log(`\nSalaus: ${pass} ok, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TESTIVIRHE', e); process.exit(2); });
