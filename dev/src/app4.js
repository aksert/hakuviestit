/* ===== Tuonti ===== */
const STANDALONE = window.HAKUVIESTIT_STANDALONE === true;
const imp = { busy: false, ui: {} };

function impStatus(label, frac) {
  const box = $('#imp-status');
  if (label == null) { box.hidden = true; return; }
  box.hidden = false;
  $('#imp-status-l').textContent = label;
  $('#imp-status-b').style.width = Math.round(100 * Math.min(1, Math.max(0, frac || 0))) + '%';
}
function impError(msg) {
  const e = $('#imp-err');
  e.textContent = msg || ''; e.hidden = !msg;
}
function importCard(title, text, ...rest) {
  return h('div', { class: 'card' }, h('h3', { text: title }), h('p', { text }), ...rest);
}
function updateImportCaps() {
  if (!imp.ui.mailControls) return;
  updateMailCard();
}
function updateMailCard() {
  const u = imp.ui;
  if (!u.mailControls) return;
  const on = gmailAvailable();
  u.mailControls.hidden = !on;
  u.mailNa.hidden = on;
  const rest = gmailRestCapable();
  u.mailNa.textContent = rest ? 'Yhdistä Gmail kirjautumalla Googleen, niin sovellus hakee työviestit suoraan tähän puhelimeen. Voit myös tuoda viestit tiedostoina alta.' : STANDALONE ? 'Suora haku toimii claude.ai-versiossa, kun Gmail on yhdistetty. Voit tuoda viestit tiedostoina alta.' : 'Yhdistä Gmail claude.ai:n asetuksissa (Yhdistäjät), niin haku toimii. Voit myös tuoda viestit tiedostoina alta.';
  u.mailConnect.hidden = on || !rest;
  u.mailConnect.textContent = gmailClientId() ? 'Yhdistä Gmail' : 'Ota Gmail-yhteys käyttöön';
  if (!on && !rest) u.files.open = true;
  if (on && !u.mailIn.value) u.mailIn.value = myEmail();
  u.mailGo.disabled = !!(DISC.busy || GM.busy);
}
async function startMailSearch() {
  const u = imp.ui;
  if (DISC.busy || GM.busy) return;
  const r = readIdentity('email', u.mailIn.value, '');
  if (r.err) { u.mailErr.textContent = r.err; u.mailErr.hidden = false; return; }
  u.mailErr.hidden = true;
  const ids = ((S.profile && S.profile.identities) || []).slice();
  if (!ids.some(i => i.type === 'email' && normEmail(i.value) === r.it.value)) await saveIdentities(ids.concat([r.it]), { noPrompt: true });
  startDiscovery(u.mailPeriod.value, r.it.value);
  setTimeout(updateMailCard, 0);
}
function buildImportView() {
  const root = h('section', { class: 'view', id: 'v-import' }, pageHeader('Tuo'));
  const home = h('div', { id: 'imp-home' });
  const review = h('div', { id: 'imp-review', hidden: true });
  const status = h('div', { class: 'card', id: 'imp-status', hidden: true }, h('p', { id: 'imp-status-l', 'aria-live': 'polite', style: 'margin:0' }), h('div', { class: 'prog' }, h('i', { id: 'imp-status-b' })));
  const err = h('p', { class: 'err', id: 'imp-err', role: 'alert', hidden: true });
  const emlF = fileField('imp-eml', 'Tiedostot', { multiple: true, accept: '.eml,.mbox,.txt,message/rfc822', btn: 'Valitse tiedostot', onFiles: f => startEml(f) });
  const waF = fileField('imp-wa', 'Tiedosto', { accept: '.txt,text/plain', btn: 'Valitse tiedosto', onFiles: f => startWa(f[0]) });
  const mailIn = h('input', { id: 'imp-mail', type: 'email', autocomplete: 'email', inputmode: 'email', autocapitalize: 'off', spellcheck: 'false', placeholder: 'nimi@gmail.com', onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); startMailSearch(); } } });
  const mailPeriod = h('select', { id: 'imp-mail-period' }, PERIODS.map(([v, l]) => h('option', { value: v, text: l, selected: v === '2y' })));
  const mailGo = h('button', { class: 'btn primary block', type: 'button', id: 'imp-mail-go', text: 'Hae työpaikkakeskustelut', onclick: () => startMailSearch() });
  const mailErr = h('p', { class: 'err', id: 'imp-mail-err', role: 'alert', hidden: true });
  const mailControls = h('div', { id: 'imp-mail-controls' }, field('imp-mail', 'Sähköpostiosoite', mailIn), field('imp-mail-period', 'Aikaväli', mailPeriod), mailErr, mailGo,
    h('p', { class: 'hint', text: 'Haku toimii Gmail-tileille. Outlook-postin voit tuoda tiedostoina.', style: 'margin:8px 0 0' }));
  const mailNa = h('p', { class: 'hint', id: 'imp-mail-na', hidden: true });
  const mailConnect = h('button', { class: 'btn primary block', type: 'button', id: 'imp-mail-connect', hidden: true, style: 'margin-top:10px', onclick: () => { if (gmailClientId()) gmailConnect('discover'); else { showView('accounts'); setTimeout(() => { const d = $('#gm-howto'); if (d) d.open = true; const c = $('#gm-card'); if (c && c.scrollIntoView) c.scrollIntoView(); }, 50); } } });
  const mailCard = importCard('Hae sähköpostista', 'Kirjoita oma sähköpostiosoitteesi. Sovellus käy läpi työnhakuun liittyvät viestit, tekee jokaisesta työnantajasta nimetyn keskustelun ja lisää vanhat viestit niihin. Mitään ei lähetetä.', mailControls, mailNa, mailConnect);
  mailCard.setAttribute('id', 'imp-mail-card');
  const files = h('details', { class: 'card fold', id: 'imp-files' }, h('summary', { text: 'Tuo tiedostoista (.eml, .mbox)' }),
    h('p', { text: 'Gmail: avaa viesti → ⋮ → Lataa viesti (.eml). Kaikki kerralla: takeout.google.com → Mail (.mbox). Outlook: tallenna viesti tiedostoon.' }), emlF.el);
  home.append(status, err, mailCard, files,
    importCard('WhatsApp-keskustelu (.txt)', 'WhatsApp → keskustelu → ⋮ → Lisää → Vie keskustelu → Ilman mediaa.', waF.el));
  root.append(home, review);
  Object.assign(imp.ui, { mailControls, mailNa, mailConnect, mailIn, mailPeriod, mailGo, mailErr, files, home, review });
  views.import = { root, onShow: updateImportCaps };
  return root;
}
async function withBusy(fn) {
  if (imp.busy) return;
  imp.busy = true; impError('');
  try { await fn(); } catch (e) { console.error(e); impError('Tuonti epäonnistui: ' + (e && e.message ? e.message : 'tuntematon virhe')); }
  imp.busy = false; impStatus(null);
}
const fmtMB = n => (n / 1048576).toFixed(n > 10485760 ? 0 : 1).replace('.', ',') + ' Mt';
async function readMbox(file, onBytes, push) {
  let skipped = 0, pos = 0, lastYield = performance.now();
  const sp = createMboxSplitter((raw, d) => {
    try { const m = parseEml(raw, { fallbackAt: d || undefined, source: 'mbox' }); if (m.from || m.body) push(m); } catch (e) { skipped++; }
  });
  const feed = async u8 => { pos += u8.length; sp.push(bytesToLatin1(u8)); onBytes(pos); if (performance.now() - lastYield > 60) { await sleep(0); lastYield = performance.now(); } };
  if (file.stream) {
    const rd = file.stream().getReader();
    for (;;) { const r = await rd.read(); if (r.done) break; await feed(r.value); }
  } else {
    const CH = 4 * 1048576;
    while (pos < file.size) await feed(new Uint8Array(await file.slice(pos, pos + CH).arrayBuffer()));
  }
  sp.end();
  return skipped;
}
function startEml(files) {
  return withBusy(async () => {
    const out = []; let doneBytes = 0, skipped = 0;
    const total = files.reduce((n, f) => n + f.size, 0) || 1;
    if (files.some(f => f.size > 300 * 1048576)) impError('Tiedosto on yli 300 Mt. Lukeminen voi kestää pitkään, mutta se onnistuu.');
    for (const f of files) {
      const head = await f.slice(0, 2048).text();
      if (/\.mbox$/i.test(f.name) || looksLikeMbox(head)) {
        skipped += await readMbox(f, pos => impStatus('Luetaan ' + f.name + ': ' + fmtMB(doneBytes + pos) + ' / ' + fmtMB(total) + ' · ' + out.length + ' viestiä', (doneBytes + pos) / total), m => out.push(m));
      } else {
        const raw = bytesToLatin1(new Uint8Array(await f.arrayBuffer()));
        const m = parseEml(raw, { fallbackAt: new Date(f.lastModified || Date.now()).toISOString(), source: 'eml' });
        if (m.from || m.body) out.push(m); else skipped++;
        impStatus('Luetaan ' + f.name, (doneBytes + f.size) / total);
      }
      doneBytes += f.size;
    }
    if (!out.length) { impError('Tiedostoista ei löytynyt sähköpostiviestejä. Valitse .eml- tai .mbox-tiedostoja.'); return; }
    if (skipped) toast(skipped + ' viestiä ohitettiin, koska niitä ei voitu lukea');
    impStatus(null);
    if (!await ensureOwnIdentity(out)) return;
    beginReview(out, out.length === 1 ? 'eml' : 'mbox');
  });
}
function startWa(file) {
  return withBusy(async () => {
    impStatus('Luetaan ' + file.name, 0.5);
    const r = parseWhatsApp(await file.text());
    impStatus(null);
    if (!r.messages.length) { impError('Tiedostosta ei löytynyt WhatsApp-viestejä. Valitse keskustelun vientitiedosto (.txt).'); return; }
    const me = await pickMe(r);
    if (!me) return;
    const others = r.names.filter(n => n !== me), main = others[0] || '';
    const myPhone = ownAddr('phone');
    const keyOf = n => { const p = normPhone(n); return isPhone(p) ? p : n; };
    const msgs = r.messages.map(x => {
      const out = x.fromName === me;
      return {
        at: x.at, dir: out ? 'out' : 'in', dirLocked: true, channel: 'whatsapp',
        from: out ? (myPhone || me) : keyOf(x.fromName), fromName: out ? me : x.fromName,
        to: out ? (main ? [keyOf(main)] : []) : [myPhone || me], _toNames: out ? [main] : [me], subject: '', body: x.body, source: 'whatsapp'
      };
    });
    beginReview(msgs, 'whatsapp', { ownExtra: ['n:' + me.toLowerCase().replace(/\s+/g, ' ')], waGroup: others.length > 1 });
  });
}
function pickMe(r) {
  return new Promise(resolve => {
    let picked = null;
    openSheet('Kumpi nimi olet sinä?', (body, api) => {
      body.append(h('p', { class: 'hint', style: 'margin-bottom:8px', text: 'Valitse omasi, niin sovellus tietää mitkä viestit sinä lähetit.' }));
      r.names.forEach((n, i) => body.append(h('button', { class: 'act', type: 'button', id: 'wa-me-' + i, onclick: () => { picked = n; api.close(); } },
        ico('accounts', 20), h('span', { style: 'flex:1', text: n }), h('span', { class: 'hint', text: r.counts[n] + ' viestiä' }))));
    }, { onClose: () => resolve(picked) });
  });
}
function ensureOwnIdentity(msgs) {
  if (S.own.size) return Promise.resolve(true);
  return new Promise(resolve => {
    const cnt = new Map();
    msgs.forEach(m => [m.from].concat(m.to || []).forEach(a => { const k = addrKey(a); if (k && k[0] !== 'n') cnt.set(k, (cnt.get(k) || 0) + 1); }));
    const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    let done = false;
    openSheet('Mikä on oma osoitteesi?', (body, api) => {
      const val = h('input', { id: 'own-value', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'nimi@gmail.com tai 040 123 4567', value: top[0] ? top[0][0].slice(2) : '' });
      const lab = h('input', { id: 'own-label', type: 'text', autocomplete: 'off', placeholder: 'esim. Gmail' });
      const err = h('p', { class: 'err', role: 'alert', hidden: true });
      body.append(h('p', { class: 'hint', style: 'margin-bottom:10px', text: 'Jotta sovellus tietää kumpi viesteistä on sinun lähettämiäsi, tarvitaan oma sähköpostiosoitteesi tai numerosi.' }));
      if (top.length) {
        body.append(h('p', { class: 'lbl', text: 'Yleisimmät osoitteet tiedostossa' }));
        top.forEach(([k, n], i) => body.append(h('button', { class: 'act', type: 'button', id: 'own-cand-' + i, onclick: () => { val.value = k.slice(2); } },
          ico(k[0] === 'e' ? 'mail' : 'call', 18), h('span', { class: 'mono', style: 'flex:1;overflow-wrap:anywhere', text: k.slice(2) }), h('span', { class: 'hint', text: n + ' viestissä' }))));
      }
      const form = h('form', { id: 'own-form', novalidate: true, style: 'margin-top:12px', onsubmit: async e => {
        e.preventDefault();
        const v = val.value.trim();
        const r = readIdentity(v.includes('@') ? 'email' : 'phone', v, lab.value);
        if (r.err) { err.textContent = r.err; err.hidden = false; return; }
        const ok = await saveIdentities(((S.profile && S.profile.identities) || []).concat([r.it]));
        if (ok) { done = true; api.close(); }
      } }, field('own-value', 'Oma osoite tai numero', val), field('own-label', 'Nimilappu (valinnainen)', lab), err,
        h('button', { class: 'btn primary block', type: 'submit', id: 'own-save', text: 'Tallenna ja jatka' }));
      body.append(form);
    }, { onClose: () => resolve(done) });
  });
}

/* ----- Ryhmittely ja tarkistus ----- */
function beginReview(msgs, source, opts) {
  opts = opts || {};
  const own = new Set(S.own); (opts.ownExtra || []).forEach(k => own.add(k));
  const st = { source, msgs, own, groups: [], tmp: [], saveSkipped: false, filter: '', shown: 150, noParty: 0, result: null, running: false, waGroup: !!opts.waGroup };
  const map = new Map();
  for (const m of msgs) {
    if (!m.dirLocked) m.dir = own.has(addrKey(m.from)) ? 'out' : 'in';
    const ps = partiesOf(m, own);
    if (!ps.length) { st.noParty++; continue; }
    const p = ps.find(x => S.idx.has(x.key)) || ps[0];
    let g = map.get(p.key);
    if (!g) { g = { key: p.key, name: p.name, email: p.email, phone: p.phone, count: 0, lastAt: '', msgs: [], known: S.idx.get(p.key) || null, choice: 'skip', extraPhone: '' }; map.set(p.key, g); }
    if (!g.name && p.name) g.name = p.name;
    g.count++; g.msgs.push(m);
    if (!g.lastAt || Date.parse(m.at) > Date.parse(g.lastAt)) g.lastAt = m.at;
  }
  st.groups = [...map.values()].sort((a, b) => (b.known ? 1 : 0) - (a.known ? 1 : 0) || b.count - a.count);
  st.groups.forEach((g, i) => { g.i = i; if (g.known) { g.choice = 'chat:' + g.known; if (!g.name && S.chats[g.known]) g.name = S.chats[g.known].name; } });
  S.imp = st;
  buildReviewUi();
  imp.ui.home.hidden = true; imp.ui.review.hidden = false;
  window.scrollTo(0, 0);
}
function leaveReview() { S.imp = null; imp.ui.review.replaceChildren(); imp.ui.review.hidden = true; imp.ui.home.hidden = false; }
function cleanupTmp() {
  const used = new Set(S.imp.groups.map(g => g.choice));
  S.imp.tmp = S.imp.tmp.filter(t => used.has('tmp:' + t.id));
}
function groupSelect(g) {
  const st = S.imp;
  const label = g.name || g.email || g.phone || 'Tuntematon';
  const sel = h('select', { id: 'imp-sel-' + g.i, 'aria-label': 'Mihin keskusteluun henkilön ' + label + ' viestit tuodaan', onchange: e => {
    const v = e.target.value;
    if (v === 'new') {
      const t = { id: uid(), name: g.name || g.email || g.phone || 'Uusi keskustelu', company: g.email ? companyFromEmail(g.email) : '' };
      st.tmp.push(t); g.choice = 'tmp:' + t.id;
    } else g.choice = v;
    cleanupTmp(); renderGroups(); const again = $('#imp-sel-' + g.i); if (again) again.focus();
  } });
  sel.append(h('option', { value: 'skip', text: 'Ohita', selected: g.choice === 'skip' }), h('option', { value: 'new', text: 'Uusi keskustelu' }));
  if (st.tmp.length) sel.append(h('optgroup', { label: 'Uudet tässä tuonnissa' }, st.tmp.map(t => h('option', { value: 'tmp:' + t.id, text: 'Uusi: ' + t.name, selected: g.choice === 'tmp:' + t.id }))));
  const chats = chatList().sort((a, b) => String(a.name).localeCompare(String(b.name), 'fi'));
  if (chats.length) sel.append(h('optgroup', { label: 'Olemassa olevat' }, chats.map(c => h('option', { value: 'chat:' + c.id, text: listTitle(c), selected: g.choice === 'chat:' + c.id }))));
  return sel;
}
function groupCard(g) {
  const label = g.name || g.email || g.phone || 'Tuntematon';
  const known = g.known && S.chats[g.known];
  const last = fmtListDate(g.lastAt, new Date());
  const target = [groupSelect(g)];
  if (!g.email && !g.phone && g.choice !== 'skip') {
    target.push(h('div', { class: 'field', style: 'margin:8px 0 0' }, h('label', { for: 'imp-ph-' + g.i, text: 'Puhelinnumero (valinnainen)' }),
      h('input', { id: 'imp-ph-' + g.i, type: 'tel', inputmode: 'tel', placeholder: '040 123 4567', value: g.extraPhone, oninput: e => { g.extraPhone = e.target.value; } })));
  }
  return h('div', { class: 'grp row5', id: 'imp-g-' + g.i },
    h('div', { class: 'c-name' }, avatar(label, 40), h('div', { style: 'min-width:0;flex:1' }, h('div', { class: 'nm', text: label }), known ? h('div', { class: 'known', text: '→ ' + known.name }) : null)),
    h('div', { class: 'c-addr mono', text: g.email || g.phone || '' }),
    h('div', { class: 'c-meta' },
      h('span', { class: 'c-cnt' }, h('span', { class: 'mtxt', text: g.count + ' viestiä' }), h('span', { class: 'dtxt', text: String(g.count) })),
      h('span', { class: 'c-last' }, h('span', { class: 'mtxt', text: ' · viimeisin ' + last }), h('span', { class: 'dtxt', text: last }))),
    h('div', { class: 'c-target' }, ...target));
}
function importCount() {
  const st = S.imp;
  return st.groups.reduce((n, g) => n + (g.choice !== 'skip' || st.saveSkipped ? g.count : 0), 0);
}
function renderGroups() {
  const st = S.imp, box = $('#imp-groups'); if (!box) return;
  box.replaceChildren();
  const f = st.filter.trim().toLowerCase();
  const list = st.groups.filter(g => !f || (g.name + ' ' + g.email + ' ' + g.phone).toLowerCase().includes(f));
  list.slice(0, st.shown).forEach(g => box.append(groupCard(g)));
  if (list.length > st.shown) box.append(h('button', { class: 'btn block', type: 'button', id: 'imp-more', text: 'Näytä lisää (' + (list.length - st.shown) + ')', onclick: () => { st.shown += 150; renderGroups(); } }));
  if (!list.length) box.append(h('p', { class: 'hint', text: 'Ei osumia.' }));
  const n = importCount(), b = $('#imp-go');
  b.textContent = 'Tuo ' + n + ' viestiä'; b.disabled = n === 0 || st.running;
}
function buildReviewUi() {
  const st = S.imp, box = imp.ui.review;
  box.replaceChildren();
  const filter = h('input', { id: 'imp-filter', type: 'search', placeholder: 'Suodata henkilöitä…', autocomplete: 'off', 'aria-label': 'Suodata henkilöitä', oninput: e => { st.filter = e.target.value; st.shown = 150; renderGroups(); } });
  const skipChk = h('input', { id: 'imp-keep', type: 'checkbox', onchange: e => { st.saveSkipped = e.target.checked; renderGroups(); } });
  box.append(
    h('div', { class: 'card' }, h('h3', { id: 'imp-found', text: 'Löytyi ' + st.msgs.length + ' viestiä, ' + st.groups.length + ' henkilöä' }),
      h('p', { style: 'margin:0', text: 'Tunnetut osoitteet on valittu automaattisesti. Valitse muille henkilöille keskustelu tai jätä ohitetuksi.' +
        (st.noParty ? ' ' + st.noParty + ' viestiä ohitettiin, koska vastapuolta ei löytynyt.' : '') +
        (st.waGroup ? ' Ryhmäkeskustelussa omat viestit liitetään eniten kirjoittaneeseen toiseen osapuoleen.' : '') })),
    filter,
    h('div', { class: 'grp-head', 'aria-hidden': 'true' }, h('span', { text: 'Nimi' }), h('span', { text: 'Osoite' }), h('span', { text: 'Viestejä' }), h('span', { text: 'Viimeisin' }), h('span', { text: 'Kohde' })),
    h('div', { id: 'imp-groups', style: 'margin-top:10px' }),
    h('label', { class: 'check', for: 'imp-keep' }, skipChk, h('span', { text: 'Tallenna ohitetut lajittelemattomiin' })),
    h('div', { class: 'imp-bar' }, h('div', { class: 'btn-row' },
      h('button', { class: 'btn', type: 'button', id: 'imp-cancel', text: 'Peruuta', onclick: leaveReview }),
      h('button', { class: 'btn primary', type: 'button', id: 'imp-go', text: 'Tuo viestejä', onclick: executeImport }))));
  renderGroups();
}
async function executeImport() {
  const st = S.imp; if (!st || st.running) return;
  st.running = true; $('#imp-go').disabled = true;
  const tmpIds = {}; st.tmp.forEach(t => { tmpIds[t.id] = newChatId(); });
  const targetOf = g => g.choice.startsWith('tmp:') ? tmpIds[g.choice.slice(4)] : g.choice.slice(5);
  const perChat = new Map(), skippedGroups = [];
  for (const g of st.groups) {
    if (g.choice === 'skip') { if (st.saveSkipped) skippedGroups.push(g); continue; }
    const cid = targetOf(g); if (!cid) continue;
    if (!perChat.has(cid)) perChat.set(cid, []);
    perChat.get(cid).push(g);
  }
  const finalize = m => {
    const at = m.at && !isNaN(Date.parse(m.at)) ? new Date(m.at).toISOString() : nowIso();
    const data = toMsgDoc(Object.assign({}, m, { at, source: m.source || st.source, createdAt: nowIso() }));
    const id = msgIdOf({ messageId: m.messageId, from: data.from, at: data.at, subject: data.subject, body: data.body });
    return { id, data };
  };
  const phoneOf = g => { if (g.phone) return g.phone; const p = normPhone(g.extraPhone || ''); return isPhone(p) ? p : ''; };
  const ops = [], statOps = [], imported = new Set(); let msgCount = 0, now = nowIso();
  for (const [cid, gs] of perChat) {
    const docMap = new Map();
    gs.forEach(g => g.msgs.forEach(m => { const d = finalize(m); docMap.set(d.id, d); }));
    const docs = [...docMap.values()];
    const tmp = st.tmp.find(t => tmpIds[t.id] === cid);
    if (tmp) {
      const members = [];
      gs.forEach(g => ensureMember(members, { name: g.name, email: g.email, phone: phoneOf(g) }, uid));
      ops.push({ t: 'set', path: 'chats/' + cid, data: {
        name: tmp.name, company: tmp.company, status: 'haettu', notes: '', color: 'av' + (fnv32(tmp.name) % 6 + 1), members,
        createdAt: now, updatedAt: now, stats: computeStats(docs.map(d => d.data))
      } });
    } else {
      const chat = S.chats[cid]; if (!chat) continue;
      const members = clone(chat.members || []);
      gs.forEach(g => ensureMember(members, { name: g.name, email: g.email, phone: phoneOf(g) }, uid));
      if (JSON.stringify(members) !== JSON.stringify(chat.members || [])) ops.push({ t: 'update', path: 'chats/' + cid, data: { members, updatedAt: now } });
      statOps.push(statsOp(cid, docs.map(d => Object.assign({ id: d.id }, d.data)), []));
    }
    docs.forEach(d => { ops.push({ t: 'set', path: 'chats/' + cid + '/messages/' + d.id, data: d.data }); imported.add(d.id); msgCount++; });
  }
  // Lajittelemattomat: poista tuodut, lisää ohitetut, rajaa 400:aan
  const keepExisting = S.unsorted.filter(u => !imported.has(u.id));
  S.unsorted.filter(u => imported.has(u.id)).forEach(u => ops.push({ t: 'del', path: 'unsorted/' + u.id }));
  const newUns = new Map();
  skippedGroups.forEach(g => g.msgs.forEach(m => { const d = finalize(m); if (!imported.has(d.id)) newUns.set(d.id, { id: d.id, data: Object.assign(d.data, { suggestedName: g.name || g.email || g.phone || '' }) }); }));
  const all = keepExisting.map(u => ({ id: u.id, at: u.at, old: true })).concat([...newUns.values()].map(u => ({ id: u.id, at: u.data.at, old: false })));
  all.sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0));
  const drop = new Set(all.slice(0, Math.max(0, all.length - MAX_UNSORTED)).map(x => x.id));
  keepExisting.forEach(u => { if (drop.has(u.id)) ops.push({ t: 'del', path: 'unsorted/' + u.id }); });
  newUns.forEach(u => { if (!drop.has(u.id)) ops.push({ t: 'set', path: 'unsorted/' + u.id, data: u.data }); });
  const unsCount = [...newUns.keys()].filter(id => !drop.has(id)).length;
  const total = ops.length + statOps.length;
  if (!total) { st.running = false; toast('Ei tuotavaa'); renderGroups(); return; }
  const pg = showProgress('Tuodaan viestejä', total);
  const r1 = await runWrites(ops, { onProgress: n => pg.set(n) });
  let err = r1.error;
  if (!err) { const r2 = await runWrites(statOps, { offset: ops.length, onProgress: n => pg.set(n) }); err = r2.error; }
  pg.close();
  st.running = false;
  S.sum.sig = '';
  if (err) { toast(errText(err), 'bad'); renderGroups(); return; }
  st.result = { msgs: msgCount, chats: perChat.size, uns: unsCount };
  renderResult();
}
function renderResult() {
  const r = S.imp.result, box = imp.ui.review;
  box.replaceChildren(h('div', { class: 'card', id: 'imp-result' },
    h('h3', { text: 'Tuotiin ' + r.msgs + ' viestiä ' + r.chats + ' keskusteluun' }),
    h('p', { text: (r.uns ? r.uns + ' viestiä tallennettiin lajittelemattomiin. ' : '') + 'Sama viesti ei tuplaannu, vaikka tuot saman tiedoston uudelleen.' }),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary', type: 'button', id: 'imp-open', text: 'Avaa keskustelut', onclick: () => { leaveReview(); showView('chats'); } }),
      h('button', { class: 'btn', type: 'button', id: 'imp-again', text: 'Tuo lisää', onclick: leaveReview }))));
}

/* ===== Laitetunnistus ja asettelu ===== */
const mm = q => { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; } };
// mobile < 700 px, tablet 700-1099 px, desktop >= 1100 px. Kosketuslaite ilman hoveria ei muutu desktopiksi.
function detectDevice() {
  const w = window.innerWidth || 390;
  let d = w < 700 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop';
  const touchOnly = mm('(pointer: coarse)') && !mm('(hover: hover)');
  let uaMobile = null;
  try { uaMobile = navigator.userAgentData && navigator.userAgentData.mobile; } catch (e) { /* ei tukea */ }
  if (d === 'desktop' && (touchOnly || uaMobile === true)) d = 'tablet';
  return d;
}
function detectInput() { return (mm('(pointer: coarse)') && !mm('(hover: hover)')) ? 'touch' : 'mouse'; }
const DEVICE_LABEL = { mobile: 'Puhelin', tablet: 'Tabletti', desktop: 'Tietokone' };
function updateDeviceLine() {
  const el = $('#acc-device'); if (!el) return;
  el.textContent = 'Laite: ' + DEVICE_LABEL[S.device] + ' · ' + (S.input === 'touch' ? 'kosketus' : 'hiiri');
}
function setLayout(split) {
  document.documentElement.dataset.layout = split ? 'split' : 'single';
  if (split === S.split) return;
  S.split = split;
  const main = $('#main'), sp = $('#split'), tb = $('#tabbar');
  if (!sp) return;
  if (split) {
    $('#left-list').append(views.chats.root);
    ['chat', 'summary', 'import', 'accounts', 'unsorted'].forEach(k => $('#right').append(views[k].root));
    $('#left-nav').append(tb);
    sp.hidden = false; main.hidden = true;
  } else {
    Object.keys(views).forEach(k => main.append(views[k].root));
    document.body.insertBefore(tb, $('#layers'));
    sp.hidden = true; main.hidden = false;
  }
  showView(S.view, true);
  if (S.openId && stick.on) setTimeout(progScroll, 0);
}
function applyDevice() {
  const d = detectDevice(), inp = detectInput();
  S.device = d; S.input = inp;
  document.documentElement.dataset.device = d;
  document.documentElement.dataset.input = inp;
  setLayout(d !== 'mobile');
  updateDeviceLine();
}
function watchDevice() {
  if (watchDevice.done) return; watchDevice.done = true;
  let t = null;
  const later = () => { clearTimeout(t); t = setTimeout(() => applyDevice(), 150); };
  window.addEventListener('resize', later);
  window.addEventListener('orientationchange', later);
  ['(pointer: coarse)', '(hover: hover)'].forEach(q => {
    try {
      const m = window.matchMedia(q);
      if (m.addEventListener) m.addEventListener('change', later); else if (m.addListener) m.addListener(later);
    } catch (e) { /* ei matchMediaa */ }
  });
}
function stepChat(dir) {
  const ids = S.visibleIds; if (!ids.length) return;
  const i = ids.indexOf(S.openId);
  const n = i < 0 ? (dir > 0 ? 0 : ids.length - 1) : Math.min(ids.length - 1, Math.max(0, i + dir));
  if (ids[n] === S.openId) return;
  openChat(ids[n]);
  const r = $('#chat-' + ids[n]); if (r && r.scrollIntoView) r.scrollIntoView({ block: 'nearest' });
}
// Pikanäppäimet (vain tietokone); sheetit hoitavat Escin itse
function desktopKeys(e) {
  if (S.device !== 'desktop') return;
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault(); const q = $('#q'); if (q) { q.focus(); if (q.select) q.select(); } return;
  }
  if (e.key === 'Escape') {
    const a = document.activeElement;
    if (a && a.id === 'q' && a.value) { a.value = ''; S.q = ''; renderChatList(); return; }
    if (a && a.blur && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT')) a.blur();
    if (S.openId) closeChat();
    return;
  }
  if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); stepChat(e.key === 'ArrowDown' ? 1 : -1); }
}

/* ===== Käynnistys ===== */
// Natiivikuori (WKWebView): ankkuri/blob-lataus ei toimi. Kirjoitetaan väliaikaistiedosto ja avataan iOS:n jakamisvalikko ("Tallenna tiedostoihin").
// Varmuuskopio on jo salattu (exportBackup), joten tiedosto ei sisällä selväkielistä dataa.
async function nativeSaveFile(req) {
  const FS = nativePlugin('Filesystem'), SH = nativePlugin('Share');
  if (!FS || !SH) throw { code: 'unavailable', message: 'tallennus ei ole käytettävissä' };
  try {
    const r = await FS.writeFile({ path: req.filename, data: req.data, directory: 'CACHE', encoding: 'utf8' });
    if (!r || !r.uri) throw { code: 'unavailable', message: 'tiedoston kirjoitus epäonnistui' };
    await SH.share({ title: req.filename, url: r.uri, dialogTitle: 'Tallenna varmuuskopio' });
    return { status: 'saved' };
  } catch (e) {
    if (e && /cancel/i.test(String(e.message || ''))) throw { code: 'declined', message: 'peruttu' };   // jakamisvalikko suljettiin ("Share canceled")
    throw e;
  } finally {
    try { await FS.deleteFile({ path: req.filename, directory: 'CACHE' }); } catch (e) { /* ei väliä */ }
  }
}
function standaloneDownloads() {
  return {
    async save(req) {
      if (isNativeApp()) return nativeSaveFile(req);
      const blob = new Blob([req.data], { type: 'application/json' });
      try {
        const file = new File([blob], req.filename, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return { status: 'saved' }; }
      } catch (e) {
        if (e && e.name === 'AbortError') throw { code: 'declined', message: 'peruttu' };
      }
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: req.filename, style: 'display:none' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      return { status: 'saved' };
    }
  };
}
function updateBanner() {
  const b = $('#banner');
  let msg = '';
  if (S.mode === 'local' && !STANDALONE) msg = 'Esikatselu: tiedot tallentuvat vain tähän selaimeen';
  else if (STANDALONE && chatList().some(c => c.example)) msg = 'Esimerkkitiedot – poista ne Omat tilit -välilehdeltä';
  b.textContent = msg; b.hidden = !msg;
}
function onData() {
  renderChatList();
  if (S.openId) {
    if (!S.chats[S.openId]) closeChat(); else { renderChatHead(); views.chat.refreshPeople(); }
  }
  if (S.view === 'summary') { renderSummary(); loadSent(); }
  if (S.view === 'unsorted') renderUnsorted();
  if (S.view === 'accounts') renderAccounts();
  updateBanner(); renderPrivacy(); updateImportCaps(); notifyRefresh();
}
function buildAll() {
  const main = $('#main');
  main.replaceChildren(); $('#tabbar').replaceChildren(); $('#fab').replaceChildren(); $('#new-chat-btn').replaceChildren();
  [buildChatsView(), buildChatView(), buildSummaryView(), buildImportView(), buildAccountsView(), buildUnsortedView()].forEach(v => { v.hidden = true; main.append(v); });
  const tb = $('#tabbar');
  [['chats', 'Keskustelut'], ['summary', 'Yhteenveto'], ['import', 'Tuo'], ['accounts', 'Omat tilit']].forEach(([v, l]) => {
    tb.append(h('button', { class: 'tab', type: 'button', id: 'tab-' + v, 'data-v': v, onclick: () => { if (S.openId) closeChat(v); else if (S.view === v) window.scrollTo(0, 0); else showView(v); } }, ico(v, 22), h('span', { text: l })));
  });
  $('#fab').append(ico('plus', 26, 2.2));
  $('#fab').onclick = () => openNewChatSheet();
  $('#new-chat-btn').append(ico('plus', 18, 2.2), ' Uusi keskustelu');
  $('#new-chat-btn').onclick = () => openNewChatSheet();
  $('#email-chat-btn').replaceChildren('Lisää sähköpostilla');
  $('#email-chat-btn').onclick = () => openAddByEmailSheet();
}
async function init() {
  lockButtonsInit();
  showLoadingLock();
  const claude = window.claude;
  const getCap = async n => { try { return claude && claude.use ? await claude.use(n) : null; } catch (e) { return null; } };
  let db = null;
  if (!STANDALONE) {
    const caps = await Promise.all([getCap('user'), getCap('db')]);
    db = caps[1];
    if (caps[0]) {
      try {
        if ((await caps[0].isOwner()) === false) {
          $('#lock').hidden = true;
          $('#app').hidden = false;
          $('#app').replaceChildren(h('div', { class: 'center-msg', text: 'Tämä sovellus näyttää tiedot vain omistajalleen.' }));
          $('#tabbar').hidden = true; $('#fabwrap').hidden = true;
          return;
        }
      } catch (e) { /* jatka */ }
    }
  }
  if (STANDALONE) { S.downloads = standaloneDownloads(); }
  else {
    getCap('downloads').then(d => { S.downloads = d; renderAccounts(); });
    // Gmail: vain capabilityn haku; mitään Gmail-kutsua ei tehdä latauksessa
    getCap('mcp').then(m => { S.mcp = m || null; refreshGmailUi(); });
    getCap('permissions').then(p => { S.perm = p || null; });
  }
  if (db) { S.mode = 'db'; SEC.inner = makeDbStore(db); }
  else {
    S.mode = 'local';
    let backend = lsBackend;
    if (STANDALONE) {
      try { backend = await makeIdbBackend(); } catch (e) { backend = lsBackend; }
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { }); } catch (e) { /* ei tärkeä */ }
    }
    try { SEC.inner = await makeLocalStore(backend); }
    catch (e) { if (backend === lsBackend) throw e; SEC.inner = await makeLocalStore(lsBackend); }
  }
  await bootSecurity();
}
init().catch(e => { console.error(e); toast('Käynnistys epäonnistui: ' + (e && e.message ? e.message : e), 'bad'); });
