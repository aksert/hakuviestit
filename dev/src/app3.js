/* ===== Näkymät: Yhteenveto, Lajittelemattomat, Omat tilit ===== */
function showView(name, keep) {
  S.view = name;
  const isTab = ['chats', 'summary', 'import', 'accounts'].includes(name);
  if (isTab) S.tab = name;
  const split = S.split;
  Object.keys(views).forEach(k => { views[k].root.hidden = split ? (k === 'chats' ? false : k !== name) : k !== name; });
  const re = $('#right-empty'); if (re) re.hidden = !(split && name === 'chats');
  $('#tabbar').hidden = split ? false : !isTab;
  $('#app').classList.toggle('notabs', !split && !isTab);
  $('#fabwrap').hidden = split || name !== 'chats';
  const cur = isTab ? name : S.tab;
  $('#tabbar').querySelectorAll('.tab').forEach(b => { if (b.dataset.v === (split ? cur : name)) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const r = views[name].root;
  if (!keep && !(split && name === 'chats')) { r.classList.remove('enter'); void r.offsetWidth; r.classList.add('enter'); }
  if (!keep) {
    if (split) { if (name !== 'chat' && name !== 'chats') r.scrollTop = 0; }
    else if (name !== 'chat') window.scrollTo(0, 0);
  }
  if (views[name].onShow) views[name].onShow();
}
function pageHeader(title, back) {
  return h('header', { class: 'top' }, h('div', { class: 'top-row' },
    back ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Takaisin', id: 'back-' + back, onclick: () => showView(back) }, ico('back', 24)) : null,
    h('h1', { text: title })));
}

/* ----- Yhteenveto ----- */
function svgEl(tag, attrs, text) {
  const e = document.createElementNS(NS, tag);
  for (const k of Object.keys(attrs || {})) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  return e;
}
let sumSort = 'sent';
function chartEl(buckets) {
  const W = 360, H = 170, x0 = 34, base = 132, top = 24, slot = 26, bw = 18;
  const maxV = Math.max(4, ...buckets.map(b => b.count));
  const svg = svgEl('svg', { class: 'chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Lähetetyt viestit viikoittain, viimeiset 12 viikkoa' });
  svg.append(svgEl('line', { class: 'axis', x1: x0, x2: W - 4, y1: top, y2: top }), svgEl('line', { class: 'zero', x1: x0, x2: W - 4, y1: base, y2: base }));
  svg.append(svgEl('text', { x: x0 - 6, y: top + 3, 'text-anchor': 'end' }, String(maxV)), svgEl('text', { x: x0 - 6, y: base + 3, 'text-anchor': 'end' }, '0'));
  buckets.forEach((b, i) => {
    const x = x0 + 4 + i * slot, hgt = b.count ? Math.max(3, (b.count / maxV) * (base - top)) : 1.5;
    const end = new Date(b.start.getFullYear(), b.start.getMonth(), b.start.getDate() + 6);
    const label = 'vk ' + b.week + ' (' + fmtDM(b.start, false) + '–' + fmtDM(end, false) + '): ' + b.count + (b.count === 1 ? ' lähetetty viesti' : ' lähetettyä viestiä');
    const r = svgEl('rect', { class: 'bar', x, y: base - hgt, width: bw, height: hgt, rx: 3, tabindex: '0', role: 'button', 'aria-label': label });
    const pick = () => { svg.querySelectorAll('.bar').forEach(el => el.classList.remove('sel')); r.classList.add('sel'); const tip = $('#chart-tip'); if (tip) tip.textContent = label; };
    r.addEventListener('click', pick);
    r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    svg.append(r);
    if (b.count) svg.append(svgEl('text', { x: x + bw / 2, y: base - hgt - 4, 'text-anchor': 'middle' }, String(b.count)));
    if (i % 2 === buckets.length % 2) svg.append(svgEl('text', { x: x + bw / 2, y: base + 16, 'text-anchor': 'middle' }, 'vk ' + b.week));
  });
  return svg;
}
function sumSignature() { return chatList().map(c => c.id + '|' + ((c.stats && c.stats.lastAt) || '') + '|' + ((c.stats && c.stats.sent) || 0)).join(';'); }
async function loadSent() {
  const sig = sumSignature();
  if (S.sum.loading || (S.sum.sig === sig && S.sum.sent)) return;
  S.sum.loading = true;
  const list = chatList().filter(c => (c.stats && c.stats.sent) > 0);
  const times = []; let i = 0;
  const cutoff = Date.now() - 90 * 86400000;
  async function worker() {
    while (i < list.length) {
      const c = list[i++];
      try { (await S.store.listMessages(c.id)).forEach(m => { if (m.dir === 'out' && Date.parse(m.at) >= cutoff) times.push(m.at); }); } catch (e) { /* ohita */ }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  S.sum.loading = false; S.sum.sent = times; S.sum.sig = sig;
  if (S.view === 'summary') { renderSummary(); if (sumSignature() !== sig) loadSent(); }
}
function sumRow(c) {
  const st = c.stats || {}, now = new Date();
  const l1 = st.lastSentAt ? 'Lähetit ' + relDays(daysAgo(st.lastSentAt, now)) + ' (' + fmtDM(new Date(st.lastSentAt), false) + ')' : 'Et ole lähettänyt viestiä';
  const replied = st.lastReceivedAt && (!st.lastSentAt || Date.parse(st.lastReceivedAt) > Date.parse(st.lastSentAt));
  const l2 = replied ? 'Vastaus ' + relDays(daysAgo(st.lastReceivedAt, now)) : 'Ei vastausta';
  return h('button', { class: 'sum-row', type: 'button', id: 'sum-' + c.id, onclick: () => openChat(c.id) },
    avatar(c.name, 40, c.color),
    h('div', { class: 'row-main' }, h('div', { class: 'row-name' }, listTitle(c), isSensitive(c) ? shieldBadge() : null), h('div', { class: 'l2', text: l1 }), h('div', { class: 'l2', text: l2 })),
    h('div', { class: 'row-side' }, pill(c.status),
      h('span', { class: 'nums' }, ico('out', 12), ' ' + (st.sent || 0) + '  ', ico('in', 12), ' ' + (st.received || 0))));
}
function renderSummary() {
  const box = $('#sum-body'); if (!box || S.view !== 'summary') return;
  box.replaceChildren();
  if (!S.chatsReady) { box.append(h('div', { class: 'center-msg', text: 'Ladataan…' })); return; }
  const chats = chatList(), now = new Date();
  const active = chats.filter(c => c.status !== 'hylatty').length;
  const waiting = chats.filter(c => waitDays(c.stats, now) > 0).length;
  const sent30 = S.sum.sent ? S.sum.sent.filter(t => now - new Date(t) <= 30 * 86400000).length : null;
  const stat = (n, l, id) => h('div', { class: 'stat' }, h('b', { id, text: n == null ? '…' : String(n) }), h('span', { text: l }));
  box.append(h('div', { class: 'stats3' }, stat(active, 'Aktiiviset haut', 'st-active'), stat(sent30, 'Lähetetty 30 pv', 'st-sent30'), stat(waiting, 'Odottaa vastausta', 'st-wait')));
  const card = h('div', { class: 'card' }, h('h3', { text: 'Lähetetyt viestit viikoittain' }));
  card.append(h('div', { class: 'chart-tip', id: 'chart-tip', 'aria-live': 'polite', text: S.sum.sent ? 'Napauta pylvästä nähdäksesi luvun.' : 'Lasketaan…' }));
  if (S.sum.sent) card.insertBefore(chartEl(weeklyBuckets(S.sum.sent, now, 12)), card.lastChild);
  box.append(card);
  box.append(h('h2', { style: 'font:700 18px var(--font-display);margin:10px 0 4px', text: 'Kenelle olet viestinyt' }));
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Lajittelu' });
  [['sent', 'Viimeksi lähetetty'], ['recv', 'Viimeksi saatu'], ['name', 'Nimi']].forEach(([k, l]) => chips.append(h('button', {
    class: 'chip', type: 'button', id: 'sort-' + k, text: l, 'aria-pressed': String(sumSort === k), onclick: () => { sumSort = k; renderSummary(); }
  })));
  box.append(chips);
  const t = iso => iso ? Date.parse(iso) : -1;
  const sorted = chats.slice().sort((a, b) => sumSort === 'name' ? String(a.name).localeCompare(String(b.name), 'fi') :
    sumSort === 'recv' ? t(b.stats && b.stats.lastReceivedAt) - t(a.stats && a.stats.lastReceivedAt) : t(b.stats && b.stats.lastSentAt) - t(a.stats && a.stats.lastSentAt));
  if (!sorted.length) box.append(h('div', { class: 'center-msg', text: 'Ei vielä keskusteluja.' }));
  const lst = h('div', { class: 'list' }); sorted.forEach(c => lst.append(sumRow(c))); box.append(lst);
}
function buildSummaryView() {
  const root = h('section', { class: 'view', id: 'v-summary' }, pageHeader('Yhteenveto'), h('div', { id: 'sum-body' }));
  views.summary = { root, onShow: () => { renderSummary(); loadSent(); } };
  return root;
}

/* ----- Lajittelemattomat ----- */
const unsSel = {};
function unsortedGroups() {
  const groups = new Map();
  for (const m of S.unsorted) {
    const ps = partiesOf(m, S.own); const p = ps[0] || { key: 'n:?', name: m.suggestedName || '', email: '', phone: '' };
    let g = groups.get(p.key);
    if (!g) { g = { key: p.key, name: m.suggestedName || p.name, email: p.email, phone: p.phone, msgs: [] }; groups.set(p.key, g); }
    g.msgs.push(m);
  }
  const arr = [...groups.values()];
  arr.forEach(g => g.msgs.sort(byAt));
  return arr.sort((a, b) => Date.parse(b.msgs[b.msgs.length - 1].at) - Date.parse(a.msgs[a.msgs.length - 1].at));
}
function renderUnsorted() {
  const box = $('#uns-body'); if (!box || S.view !== 'unsorted') return;
  box.replaceChildren();
  const groups = unsortedGroups();
  if (!groups.length) { box.append(h('div', { class: 'center-msg', text: 'Ei lajittelemattomia viesteja.'.replace('viesteja', 'viestejä') })); return; }
  groups.forEach((g, gi) => {
    const label = g.name || g.email || g.phone || 'Tuntematon';
    const last = g.msgs[g.msgs.length - 1];
    const sel = h('select', { id: 'uns-sel-' + gi, 'aria-label': 'Siirrä henkilön ' + label + ' viestit keskusteluun', onchange: e => { unsSel[g.key] = e.target.value; } },
      h('option', { value: '', text: 'Valitse keskustelu…' }),
      chatList().sort((a, b) => String(a.name).localeCompare(String(b.name), 'fi')).map(c => h('option', { value: c.id, text: listTitle(c), selected: unsSel[g.key] === c.id })));
    const moveBtn = h('button', { class: 'btn primary', type: 'button', id: 'uns-move-' + gi, text: 'Siirrä keskusteluun', onclick: async () => {
      if (!sel.value) { toast('Valitse ensin keskustelu'); sel.focus(); return; }
      moveBtn.disabled = true;
      const ok = await moveUnsortedTo(g.msgs, sel.value);
      moveBtn.disabled = false;
      if (ok) toast('Siirrettiin ' + g.msgs.length + ' viestiä');
    } });
    box.append(h('div', { class: 'grp', id: 'uns-' + gi },
      h('div', { class: 'grp-h' }, avatar(label, 40),
        h('div', { style: 'min-width:0;flex:1' }, h('div', { class: 'nm', text: label }),
          (g.email || g.phone) ? h('div', { class: 'ad', text: g.email || g.phone }) : null,
          h('div', { class: 'ct', text: g.msgs.length + ' viestiä · viimeisin ' + fmtListDate(last.at, new Date()) }))),
      h('div', { class: 'quote', text: previewOf(last) }),
      h('div', { class: 'field' }, sel),
      h('div', { class: 'btn-row' }, moveBtn,
        h('button', { class: 'btn', type: 'button', id: 'uns-new-' + gi, text: 'Uusi keskustelu tästä henkilöstä', onclick: () => newChatFromUnsorted(g) }),
        h('button', { class: 'btn danger', type: 'button', id: 'uns-del-' + gi, text: 'Poista', onclick: async () => {
          if (!await confirmSheet({ title: 'Poistetaanko viestit?', text: g.msgs.length + ' viestiä (' + label + ') poistetaan lajittelemattomista. Tätä ei voi perua.', ok: 'Poista', danger: true })) return;
          if (await doWrites(g.msgs.map(m => ({ t: 'del', path: 'unsorted/' + m.id })), 'Poistetaan')) toast('Poistettu');
        } }))));
  });
}
async function newChatFromUnsorted(g) {
  const label = g.name || g.email || g.phone || 'Uusi keskustelu';
  const id = newChatId(), now = nowIso();
  const data = {
    name: label, company: g.email ? companyFromEmail(g.email) : '', status: 'haettu', notes: '', color: 'av' + (fnv32(label) % 6 + 1),
    members: [{ id: uid(), name: label, role: '', emails: g.email ? [g.email] : [], phones: g.phone ? [g.phone] : [] }],
    createdAt: now, updatedAt: now, stats: computeStats([])
  };
  if (!await doWrites([{ t: 'set', path: 'chats/' + id, data }])) return;
  S.chats = Object.assign({}, S.chats, { [id]: data }); rebuildIndexes();
  if (await moveUnsortedTo(g.msgs, id)) openChat(id);
}
function buildUnsortedView() {
  const root = h('section', { class: 'view', id: 'v-unsorted' }, pageHeader('Lajittelemattomat', 'chats'), h('div', { id: 'uns-body', style: 'padding-top:8px' }));
  views.unsorted = { root, onShow: renderUnsorted };
  return root;
}

/* ----- Omat tilit ----- */
function renderAccounts() {
  const list = $('#acc-list'); if (!list) return;
  const ids = (S.profile && S.profile.identities) || [];
  list.replaceChildren();
  if (!ids.length) list.append(h('p', { class: 'hint', text: 'Et ole vielä lisännyt omia osoitteita. Lisää ainakin oma sähköpostisi tai puhelinnumerosi.' }));
  ids.forEach((it, i) => list.append(h('div', { class: 'id-row', id: 'idn-' + i },
    ico(it.type === 'email' ? 'mail' : 'call', 20),
    h('div', { class: 'v' }, h('span', { class: 'mono', text: it.value }), it.label ? h('small', { text: it.label }) : null),
    h('button', { class: 'icon-btn', type: 'button', id: 'idn-del-' + i, 'aria-label': 'Poista ' + it.value, onclick: async () => {
      const arr = ids.slice(); arr.splice(i, 1); await saveIdentities(arr);
    } }, ico('trash', 18)))));
  const dl = $('#acc-download'); if (dl) dl.hidden = !S.downloads;
  const ex = $('#acc-example'); if (ex) ex.hidden = !chatList().some(c => c.example);
  renderPrivacy(); renderGmail();
}
async function saveIdentities(arr, opts) {
  const before = (S.profile && S.profile.identities) || [];
  const data = Object.assign({}, S.profile || {}, { identities: arr, updatedAt: nowIso() });
  const ok = await doWrites([{ t: 'set', path: 'meta/profile', data }]);
  if (ok) {
    S.profile = data; rebuildIndexes(); renderAccounts();
    // Uusi oma sähköposti -> tarjotaan työpaikkakeskustelujen etsintää (vain Gmailin ollessa käytettävissä)
    if (!(opts && opts.noPrompt)) {
      const had = new Set(before.filter(i => i.type === 'email').map(i => normEmail(i.value)));
      const added = arr.find(i => i.type === 'email' && !i.example && !had.has(normEmail(i.value)));
      if (added) setTimeout(() => openDiscoverPrompt(added.value), 0);
    }
  }
  return ok;
}
function readIdentity(type, rawValue, label) {
  const v = rawValue.trim();
  if (!v) return { err: 'Kirjoita ' + (type === 'email' ? 'sähköpostiosoite' : 'puhelinnumero') + '.' };
  if (type === 'email') {
    const e = normEmail(v);
    if (!isEmail(e)) return { err: 'Sähköpostiosoite ei näytä oikealta. Kirjoita se muodossa nimi@yritys.fi.' };
    return { it: { type, value: e, label: label.trim() } };
  }
  const p = normPhone(v);
  if (!isPhone(p)) return { err: 'Puhelinnumero ei näytä oikealta. Kirjoita se esimerkiksi 040 123 4567 tai +358 40 123 4567.' };
  return { it: { type, value: p, label: label.trim() } };
}
function buildAccountsView() {
  const root = h('section', { class: 'view', id: 'v-accounts' }, pageHeader('Omat tilit'));
  const type = h('select', { id: 'acc-type' }, h('option', { value: 'email', text: 'Sähköposti' }), h('option', { value: 'phone', text: 'Puhelinnumero' }));
  const val = h('input', { id: 'acc-value', type: 'text', inputmode: 'email', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'nimi@gmail.com' });
  const lab = h('input', { id: 'acc-label', type: 'text', autocomplete: 'off', placeholder: 'esim. Gmail tai Työ' });
  const err = h('p', { class: 'err', role: 'alert', hidden: true });
  type.addEventListener('change', () => { val.placeholder = type.value === 'email' ? 'nimi@gmail.com' : '040 123 4567'; val.inputMode = type.value === 'email' ? 'email' : 'tel'; });
  const addForm = h('form', { id: 'acc-form', novalidate: true, onsubmit: async e => {
    e.preventDefault();
    const r = readIdentity(type.value, val.value, lab.value);
    if (r.err) { err.textContent = r.err; err.hidden = false; return; }
    const cur = (S.profile && S.profile.identities) || [];
    if (cur.some(x => x.type === r.it.type && x.value === r.it.value)) { err.textContent = 'Tämä on jo lisätty.'; err.hidden = false; return; }
    err.hidden = true;
    if (await saveIdentities(cur.concat([r.it]))) { val.value = ''; lab.value = ''; toast('Lisätty'); }
  } }, field('acc-type', 'Tyyppi', type), field('acc-value', 'Osoite tai numero', val), field('acc-label', 'Nimilappu (valinnainen)', lab), err,
    h('button', { class: 'btn primary block', type: 'submit', id: 'acc-add', text: 'Lisää' }));
  const restoreF = fileField('acc-restore', 'Palauta varmuuskopiosta', {
    accept: '.json,application/json', btn: 'Valitse tiedosto', onFiles: f => restoreBackup(f[0]),
    hint: 'Valitse aiemmin ladattu .json-tiedosto. Palautus lisää ja päivittää tietoja, mutta ei poista mitään.'
  });
  root.append(
    h('div', { class: 'sec' }, h('h2', { text: 'Omat sähköpostit ja numerot' }),
      h('p', { class: 'hint', style: 'margin-bottom:8px', text: 'Näiden avulla sovellus tietää, mitkä viestit sinä lähetit.' }),
      h('div', { id: 'acc-list' }), h('div', { class: 'card', style: 'margin-top:12px' }, addForm)),
    privacySection(),
    gmailSection(),
    h('div', { class: 'sec' }, h('h2', { text: 'Varmuuskopio' }),
      h('div', { class: 'card' },
        h('button', { class: 'btn block', type: 'button', id: 'acc-download', style: 'margin-bottom:12px', onclick: exportBackup }, ico('import', 18), 'Lataa salattu varmuuskopio (.json)'),
        restoreF.el)),
    h('div', { class: 'sec' }, h('button', { class: 'btn danger block', type: 'button', id: 'acc-example', onclick: removeExamples, hidden: true, text: 'Poista esimerkkitiedot' })),
    h('p', { class: 'hint', style: 'text-align:center;margin:18px 0 6px', text: 'Tiedot tallentuvat tähän sovellukseen ja näkyvät vain sinulle.' }),
    h('p', { class: 'hint mono', id: 'acc-device', style: 'text-align:center;margin:0 0 18px' }));
  views.accounts = { root, onShow: renderAccounts };
  return root;
}
async function removeExamples() {
  const ids = chatList().filter(c => c.example).map(c => c.id);
  if (!ids.length) return;
  if (!await confirmSheet({ title: 'Poistetaanko esimerkkitiedot?', text: 'Esimerkkikeskustelut (' + ids.length + ') ja niiden viestit poistetaan. Omat tietosi säilyvät.', ok: 'Poista', danger: true })) return;
  if (!await deleteChats(ids)) return;
  const idn = ((S.profile && S.profile.identities) || []);
  if (idn.some(i => i.example)) await saveIdentities(idn.filter(i => !i.example));
  toast('Esimerkkitiedot poistettu');
}
// Arkaluonteisten keskustelujen mukaanotto varmuuskopioon: oletuksena pois; mukaan vain salasanan vahvistuksella. Palauttaa true / false / null (peruttu)
function askExportScope(n) {
  return new Promise(resolve => {
    let res = null;
    openSheet('Varmuuskopioon otettavat keskustelut', (body, api) => {
      const chk = h('input', { id: 'exp-sens', type: 'checkbox' });
      body.append(
        h('p', { class: 'hint', style: 'font-size:15px;color:var(--ink);margin-bottom:12px', text: 'Arkaluonteisia keskusteluja on ' + n + '. Ne jätetään oletuksena pois varmuuskopiosta.' }),
        h('label', { class: 'check', for: 'exp-sens' }, chk, h('span', { text: 'Sisällytä arkaluonteiset keskustelut' })),
        h('p', { class: 'hint', style: 'margin:0 0 12px 32px', text: 'Mukaan ottaminen vaatii salasanan kirjoittamisen uudelleen.' }),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', type: 'button', id: 'exp-cancel', text: 'Peruuta', onclick: () => api.close() }),
          h('button', { class: 'btn primary', type: 'button', id: 'exp-go', text: 'Jatka', onclick: () => { res = chk.checked; api.close(); } })));
    }, { onClose: () => resolve(res) });
  });
}
async function exportBackup() {
  if (!S.downloads) return;
  let chats = chatList();
  if (chats.some(isSensitive)) {
    const incl = await askExportScope(chats.filter(isSensitive).length);
    if (incl === null) return;
    if (incl) {
      const pw = await askPassword('Vahvista salasanalla', 'Arkaluonteisten keskustelujen vienti vaatii salasanan.');
      if (pw == null) return;
      if (!await openCrypto(pw, SEC.meta)) { toast('Salasana ei kelpaa.', 'bad'); return; }
    } else chats = chats.filter(c => !isSensitive(c));
  }
  const pg = showProgress('Kootaan varmuuskopiota', Math.max(1, chats.length));
  let data;
  try {
    const outChats = []; let n = 0;
    for (const c of chats) {
      const id = c.id; const d = Object.assign({}, c); delete d.id;
      const msgs = (await S.store.listMessages(id)).map(m => { const x = Object.assign({}, m); delete x.id; return { id: m.id, data: x }; });
      outChats.push({ id, data: d, messages: msgs });
      pg.set(++n, 'Kootaan');
    }
    data = {
      app: 'hakuviestit', version: 2, exportedAt: nowIso(), profile: S.profile, chats: outChats,
      unsorted: S.unsorted.map(u => { const x = Object.assign({}, u); delete x.id; return { id: u.id, data: x }; })
    };
  } catch (e) { pg.close(); toast(errText(e), 'bad'); return; }
  pg.close();
  const d = new Date();
  let file;
  try {
    const m = SEC.meta;
    file = { app: 'hakuviestit', version: 2, encrypted: true, crypto: { v: m.v, kdf: m.kdf, iter: m.iter, salt: m.salt, check: m.check }, enc: await encObj(SEC.key, data, 'backup') };
  } catch (e) { toast('Varmuuskopion salaus epäonnistui', 'bad'); return; }
  try {
    await S.downloads.save({ filename: 'hakuviestit-varmuuskopio-' + d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + '.json', data: JSON.stringify(file) });
    toast('Varmuuskopio valmis');
  } catch (e) {
    if (e && e.code === 'declined') return;
    toast(e && e.code === 'unavailable' ? 'Lataus ei ole käytettävissä tässä näkymässä' : 'Latauksen aloitus ei onnistunut', 'bad');
  }
}
async function restoreBackup(file) {
  let wrap, obj;
  try { wrap = JSON.parse(await file.text()); } catch (e) { toast('Tiedostoa ei voitu lukea. Valitse Hakuviestit-varmuuskopio (.json).', 'bad'); return; }
  if (!wrap || wrap.app !== 'hakuviestit') { toast('Tämä ei ole Hakuviestit-varmuuskopio.', 'bad'); return; }
  if (!wrap.encrypted || !wrap.enc || !wrap.crypto) { toast('Vain salattuja varmuuskopioita voi palauttaa.', 'bad'); return; }
  const pw = await askPassword('Varmuuskopion salasana', 'Kirjoita salasana, jolla varmuuskopio on salattu. Palautus vaatii salasanan.');
  if (pw == null) return;
  const bkey = await openCrypto(pw, wrap.crypto);
  if (!bkey) { toast('Salasana ei kelpaa.', 'bad'); return; }
  try { obj = await decObj(bkey, wrap.enc, 'backup'); } catch (e) { toast('Varmuuskopio on vioittunut.', 'bad'); return; }
  if (!obj || !Array.isArray(obj.chats)) { toast('Varmuuskopio on vioittunut.', 'bad'); return; }
  const okId = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(s);
  const chats = obj.chats.filter(c => c && okId(c.id) && c.data && typeof c.data === 'object');
  const msgCount = chats.reduce((n, c) => n + (Array.isArray(c.messages) ? c.messages.filter(m => m && okId(m.id) && m.data).length : 0), 0);
  if (!chats.length && !(obj.unsorted || []).length) { toast('Varmuuskopiossa ei ole keskusteluja.', 'bad'); return; }
  if (!await confirmSheet({ title: 'Palautetaanko varmuuskopio?', text: 'Varmuuskopiossa on ' + chats.length + ' keskustelua, ' + msgCount + ' viestiä. Samalla tunnisteella olevat tiedot korvataan.', ok: 'Palauta' })) return;
  const ops = [];
  for (const c of chats) {
    const d = clone(c.data);
    d.name = String(d.name || 'Keskustelu'); d.status = STATUSES.includes(d.status) ? d.status : 'muu';
    d.members = Array.isArray(d.members) ? d.members : [];
    if ('sensitive' in d) d.sensitive = d.sensitive === true;
    d.stats = d.stats && typeof d.stats === 'object' ? d.stats : computeStats([]);
    ops.push({ t: 'set', path: 'chats/' + c.id, data: d });
    (c.messages || []).forEach(m => { if (m && okId(m.id) && m.data && typeof m.data === 'object') ops.push({ t: 'set', path: 'chats/' + c.id + '/messages/' + m.id, data: toMsgDoc(m.data) }); });
  }
  (obj.unsorted || []).slice(0, MAX_UNSORTED).forEach(u => { if (u && okId(u.id) && u.data) ops.push({ t: 'set', path: 'unsorted/' + u.id, data: toMsgDoc(u.data, { suggestedName: String(u.data.suggestedName || '') }) }); });
  const pids = obj.profile && Array.isArray(obj.profile.identities) ? obj.profile.identities : [];
  if (pids.length) {
    const cur = ((S.profile && S.profile.identities) || []).slice();
    pids.forEach(i => { if (i && (i.type === 'email' || i.type === 'phone') && i.value && !cur.some(x => x.type === i.type && x.value === i.value)) cur.push(i); });
    ops.push({ t: 'set', path: 'meta/profile', data: Object.assign({}, S.profile || {}, { identities: cur, updatedAt: nowIso() }) });
  }
  const pg = showProgress('Palautetaan', ops.length);
  const r = await runWrites(ops, { onProgress: n => pg.set(n, 'Tallennetaan') });
  pg.close();
  S.sum.sig = '';
  if (r.error) toast(errText(r.error), 'bad'); else toast('Palautettu: ' + chats.length + ' keskustelua, ' + msgCount + ' viestiä');
}
