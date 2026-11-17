/* ===== Näkymät: Keskustelut, Chat ===== */
const views = {};
const act = (icon, label, onclick, bad) => h('button', { class: 'act' + (bad ? ' bad' : ''), type: 'button', onclick }, ico(icon, 20), label);

/* ----- Keskustelulista ----- */
function matchChat(c, q) {
  if (!q) return true;
  q = q.toLowerCase();
  const digits = q.replace(/[^\d+]/g, '');
  const hay = [c.name, c.company];
  (c.members || []).forEach(m => { hay.push(m.name, m.role); (m.emails || []).forEach(e => hay.push(e)); (m.phones || []).forEach(p => hay.push(p)); });
  const s = hay.filter(Boolean).join(' ').toLowerCase();
  if (s.includes(q)) return true;
  return digits.length >= 3 && s.replace(/[\s\-]/g, '').includes(digits);
}
function chatRow(c) {
  const st = c.stats || {}, now = new Date(), wait = waitDays(st, now);
  // Arkaluonteinen keskustelu: aina vain nimi (henkilönimi nimikirjaimina) ja päivä, ei esikatselua riippumatta asetuksesta
  if (isSensitive(c) || settings().hidePreview) {
    return h('button', { class: 'row' + (isSensitive(c) ? ' sens' : '') + (S.openId === c.id ? ' sel' : ''), type: 'button', id: 'chat-' + c.id, onclick: () => openChat(c.id) },
      avatar(c.name, 44, c.color),
      h('div', { class: 'row-main' }, h('div', { class: 'row-name' }, isSensitive(c) ? listTitle(c) : c.name, isSensitive(c) ? shieldBadge() : null)),
      h('div', { class: 'row-side' }, h('span', { class: 'row-date', text: fmtListDate(st.lastAt || c.createdAt, now) })));
  }
  const showCo = c.company && !String(c.name).toLowerCase().includes(c.company.toLowerCase());
  const row = h('button', { class: 'row' + (S.openId === c.id ? ' sel' : ''), type: 'button', id: 'chat-' + c.id, onclick: () => openChat(c.id) },
    avatar(c.name, 44, c.color),
    h('div', { class: 'row-main' },
      h('div', { class: 'row-name' }, c.name, showCo ? h('small', { text: c.company }) : null),
      h('div', { class: 'row-prev' }, c.example ? h('span', { class: 'tag', text: 'Esimerkki' }) : null, st.lastDir ? ico(st.lastDir === 'out' ? 'out' : 'in', 14) : null, st.lastChannel ? chIcon(st.lastChannel, 14) : null,
        h('span', { class: 't', text: st.lastPreview || 'Ei viestejä vielä' })),
      wait ? h('div', { class: 'row-warn', text: 'Ei vastausta ' + wait + ' pv' }) : null),
    h('div', { class: 'row-side' }, h('span', { class: 'row-date', text: fmtListDate(st.lastAt || c.createdAt, now) }), pill(c.status)));
  return row;
}
function renderChatList() {
  const v = views.chats; if (!v) return;
  const list = $('#chat-list'), slot = $('#unsorted-slot'), empty = $('#chats-empty');
  list.replaceChildren(); slot.replaceChildren(); empty.replaceChildren();
  S.visibleIds = [];
  if (!S.chatsReady) { list.append(h('div', { class: 'center-msg', text: 'Ladataan…' })); return; }
  if (S.unsorted.length) {
    slot.append(h('button', { class: 'unsorted-row', type: 'button', id: 'open-unsorted', onclick: () => showView('unsorted') },
      ico('mail', 20), h('span', { text: 'Lajittelemattomat viestit (' + S.unsorted.length + ')' }), ico('move', 18)));
  }
  const all = chatList();
  if (!all.length) {
    empty.append(h('div', { class: 'empty' },
      h('h2', { text: 'Ei vielä keskusteluja' }),
      h('p', { text: 'Tänne tulee jokaisesta työnantajasta oma keskusteluryhmä, jossa näet sähköpostit, tekstiviestit ja WhatsApp-viestit sekä sen, kenelle olet viestinyt ja milloin.' }),
      h('div', { class: 'btn-row' },
        gmailAvailable() ? h('button', { class: 'btn primary', type: 'button', id: 'empty-mail', text: 'Hae sähköpostista', onclick: () => { showView('import'); const i = $('#imp-mail'); if (i) i.focus(); } }) : null,
        h('button', { class: gmailAvailable() ? 'btn' : 'btn primary', type: 'button', id: 'empty-add', text: 'Lisää työnantaja', onclick: () => openNewChatSheet() }),
        h('button', { class: 'btn', type: 'button', id: 'empty-email', text: 'Lisää sähköpostilla', onclick: () => openAddByEmailSheet() }),
        h('button', { class: 'btn', type: 'button', id: 'empty-import', text: 'Tuo viestejä', onclick: () => showView('import') }))));
    return;
  }
  const rows = all.filter(c => (S.filter === 'all' || c.status === S.filter) && matchChat(c, S.q.trim())).sort((a, b) => chatSortKey(b) - chatSortKey(a));
  if (!rows.length) { list.append(h('div', { class: 'center-msg', text: 'Ei osumia.' })); return; }
  S.visibleIds = rows.map(c => c.id);
  rows.forEach(c => list.append(chatRow(c)));
}
function markSelected() { document.querySelectorAll('.row').forEach(r => r.classList.toggle('sel', r.id === 'chat-' + S.openId)); }
function buildChatsView() {
  const root = h('section', { class: 'view', id: 'v-chats' });
  const q = h('input', { id: 'q', type: 'search', placeholder: 'Hae nimistä, yrityksistä, osoitteista', autocomplete: 'off', 'aria-label': 'Hae keskusteluja', oninput: e => { S.q = e.target.value; renderChatList(); } });
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Suodata tilan mukaan' });
  [['all', 'Kaikki']].concat(STATUSES.map(s => [s, STATUS_LABEL[s]])).forEach(([k, l]) => {
    chips.append(h('button', {
      class: 'chip', type: 'button', id: 'f-' + k, text: l, 'aria-pressed': String(k === S.filter),
      onclick: () => { S.filter = k; chips.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.id === 'f-' + k))); renderChatList(); }
    }));
  });
  root.append(
    h('header', { class: 'top' }, h('h1', { text: 'Keskustelut' }), h('div', { class: 'search' }, ico('search', 18), q), chips),
    h('div', { id: 'dev-banner-slot' }), h('div', { id: 'unsorted-slot' }), h('div', { class: 'list', id: 'chat-list' }), h('div', { id: 'chats-empty' }));
  views.chats = { root };
  return root;
}

/* ----- Uusi keskustelu ----- */
function openNewChatSheet() {
  openSheet('Uusi keskustelu', (body, api) => {
    const name = h('input', { id: 'nc-name', type: 'text', autocomplete: 'off', placeholder: 'esim. Valio – myyntiassistentti' });
    const company = h('input', { id: 'nc-company', type: 'text', autocomplete: 'off', placeholder: 'esim. Valio' });
    const status = statusSelect('nc-status', 'haettu');
    const pf = personForm('nc-p');
    const err = h('p', { class: 'err', role: 'alert', hidden: true });
    const form = h('form', { id: 'nc-form', novalidate: true, onsubmit: async e => {
      e.preventDefault();
      const p = pf.read(); if (!p.ok) return;
      const nm = name.value.trim() || p.name || company.value.trim();
      if (!nm) { err.textContent = 'Anna keskustelulle nimi, esimerkiksi työnantajan ja tehtävän nimi.'; err.hidden = false; name.focus(); return; }
      err.hidden = true;
      const co = company.value.trim() || (p.emails[0] ? companyFromEmail(p.emails[0]) : '');
      const now = nowIso(), id = newChatId();
      const hasPerson = p.name || p.emails.length || p.phones.length;
      const data = {
        name: nm, company: co, status: status.value, notes: '', color: 'av' + (fnv32(nm) % 6 + 1),
        members: hasPerson ? [{ id: uid(), name: p.name || nm, role: p.role, emails: p.emails, phones: p.phones }] : [],
        createdAt: now, updatedAt: now, stats: computeStats([])
      };
      saveBtn.disabled = true;
      const ok = await doWrites([{ t: 'set', path: 'chats/' + id, data }]);
      saveBtn.disabled = false;
      if (!ok) return;
      S.chats = Object.assign({}, S.chats, { [id]: data }); rebuildIndexes();
      api.close(); openChat(id);
    } });
    const saveBtn = h('button', { class: 'btn primary block', type: 'submit', id: 'nc-save', text: 'Tallenna ja avaa' });
    form.prepend(addTabs('new', api));
    form.append(field('nc-name', 'Keskustelun nimi', name), field('nc-company', 'Yritys', company), field('nc-status', 'Tila', status),
      h('h3', { class: 'lbl', style: 'margin:4px 0 8px', text: 'Ensimmäinen henkilö' }), ...pf.els, err, saveBtn);
    body.append(form);
  });
}

/* ----- Chat-näkymä ----- */
let unsubMessages = null;
function openChat(id) {
  if (!S.chats[id]) return;
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  S.openId = id; S.messages = []; S.msgsReady = false; S.expanded = new Set(); startStick();
  renderChatHead(); renderMessages();
  views.chat.resetComposer();
  unsubMessages = S.store.watchMessages(id, list => {
    S.messages = list.slice().sort(byAt); S.msgsReady = true; renderMessages();
  }, e => toast(errText(e), 'bad'));
  showView('chat');
  progScroll(); settle();
  markSelected();
  if (S.device === 'desktop') setTimeout(() => { const t = $('#c-body'); if (t) t.focus(); }, 0);
}
function closeChat(next) {
  stopStick();
  const wasOpen = S.openId;
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  S.openId = null; S.messages = [];
  showView(next || S.tab);
  if (wasOpen) markSelected();
}
function renderChatHead() {
  const c = S.chats[S.openId]; if (!c) return;
  const n = (c.members || []).length;
  $('#ch-avatar').replaceChildren(avatar(c.name, 40, c.color));
  $('#ch-name').textContent = c.name;
  const shd = $('#ch-shield'); if (shd) shd.hidden = !isSensitive(c);
  $('#ch-sub').textContent = (n === 0 ? 'Ei henkilöitä' : n === 1 ? '1 henkilö' : n + ' henkilöä') + ' · ' + (STATUS_LABEL[c.status] || STATUS_LABEL.muu);
  const hb = $('#ch-gmail'); if (hb) hb.hidden = !(gmailAvailable() && chatEmails(c).length > 0);
  if (views.chat && views.chat.refreshGmail) views.chat.refreshGmail();
}
// Viestin linkit: vain http(s), mailto ja tel ovat napautettavia; http(s)-linkki avataan vasta vahvistussheetin kautta (näyttää todellisen verkkotunnuksen)
function linkNodes(text) {
  return linkifyText(text).map(seg => {
    if (seg.t === 'text') return seg.s;
    const a = h('a', { class: 'lnk', href: seg.link.href, target: '_blank', rel: 'noopener noreferrer', text: seg.s });
    if (seg.link.kind === 'web') a.addEventListener('click', e => { e.preventDefault(); openLinkConfirm(seg); });
    return a;
  });
}
function openLinkConfirm(seg) {
  const L = seg.link, lbl = seg.label || (labelHostOf(seg.s) ? seg.s : ''), mism = linkMismatch(lbl, L);
  openSheet('Linkki viestissä', (body, api) => {
    body.append(h('p', { id: 'lk-q', style: 'font-size:17px;font-weight:600;margin-bottom:8px;overflow-wrap:anywhere', text: 'Avataanko linkki? ' + L.host }),
      h('div', { class: 'mono', id: 'lk-url', style: 'font-size:13px;color:var(--muted);overflow-wrap:anywhere;margin-bottom:10px', text: L.href.length > 300 ? L.href.slice(0, 300) + '…' : L.href }));
    if (mism) body.append(h('p', { class: 'warnbox', id: 'lk-warn', text: 'Varoitus: linkin teksti viittaa osoitteeseen ' + mism + ', mutta linkki johtaa osoitteeseen ' + L.host + '. Tämä voi olla huijaus.' }));
    if (L.userinfo) body.append(h('p', { class: 'warnbox', id: 'lk-warn-ui', text: 'Varoitus: osoitteessa on ennen @-merkkiä oleva osa, joka voi huijata. Todellinen verkkotunnus on ' + L.host + '.' }));
    if (L.idn) body.append(h('p', { class: 'warnbox', id: 'lk-warn-idn', text: 'Varoitus: verkkotunnuksessa on erikoismerkkejä, jotka voivat jäljitellä tuttua osoitetta.' }));
    if (/^http:/i.test(L.href)) body.append(h('p', { class: 'hint', id: 'lk-http', style: 'margin-bottom:8px', text: 'Yhteys ei ole salattu (http).' }));
    body.append(h('div', { class: 'btn-row', style: 'flex-direction:column;margin-top:6px' },
      h('a', { class: 'btn primary block', id: 'lk-go', style: 'text-decoration:none', href: L.href, target: '_blank', rel: 'noopener noreferrer', text: 'Avaa linkki', onclick: () => { setTimeout(() => api.close(), 150); } }),
      h('button', { class: 'btn block', type: 'button', id: 'lk-cancel', text: 'Peruuta', onclick: () => api.close() })));
  });
}
function bubbleEl(m, pend) {
  const now = new Date(), d = new Date(m.at), out = m.dir === 'out';
  const meta = h('div', { class: 'bmeta' }, chIcon(m.channel, 14));
  if (!out) meta.append(h('span', { class: 'nm', text: m.fromName || (m.channel === 'email' ? '' : m.from) || 'Tuntematon' }));
  else meta.append(h('span', { text: 'Sinä' }));
  if (m.channel === 'email') {
    const ad = out ? (m.to && m.to[0]) : m.from;
    if (ad) meta.append(h('span', { class: 'ad', text: (out ? '→ ' : '') + ad }));
  }
  const bodyEl = h('div', { class: 'bbody' + (S.expanded.has(m.id) ? ' open' : '') }, ...linkNodes(m.body || ''));
  const btn = h('button', { class: 'bexp', type: 'button', hidden: !S.expanded.has(m.id), text: S.expanded.has(m.id) ? 'Näytä vähemmän' : 'Näytä koko viesti',
    onclick: () => {
      if (S.expanded.has(m.id)) S.expanded.delete(m.id); else S.expanded.add(m.id);
      const o = S.expanded.has(m.id);
      bodyEl.classList.toggle('open', o); btn.textContent = o ? 'Näytä vähemmän' : 'Näytä koko viesti';
    } });
  pend.push([bodyEl, btn]);
  const more = h('button', { class: 'bmore', type: 'button', 'aria-label': 'Viestin toiminnot', onclick: () => openMessageSheet(m) }, ico('more', 18));
  const b = h('div', { class: 'bubble ' + (out ? 'out' : 'in'), id: 'msg-' + m.id },
    meta, more, m.subject ? h('div', { class: 'bsubj', text: m.subject }) : null, m.body ? bodyEl : null, m.body ? btn : null,
    (m.attachments && m.attachments.length) ? h('div', { class: 'bmeta', style: 'margin-top:4px;margin-right:0', text: 'Liitteet: ' + m.attachments.join(', ') }) : null,
    m.pending ? h('div', { class: 'hint pending-hint', text: 'Avattu sähköpostiin – ei vielä vahvistettu' }) : null,
    h('div', { class: 'btime', text: fmtTime(d) }));
  // pitkä painallus
  let timer = null, sx = 0, sy = 0;
  const cancel = () => { clearTimeout(timer); timer = null; };
  b.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || e.target.closest('button,a')) return; sx = e.clientX; sy = e.clientY; cancel(); timer = setTimeout(() => { timer = null; openMessageSheet(m); }, 480); });
  b.addEventListener('pointermove', e => { if (timer && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) cancel(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, cancel));
  b.addEventListener('contextmenu', e => { e.preventDefault(); cancel(); openMessageSheet(m); });
  return b;
}
function renderMessages() {
  const box = $('#msgs'); if (!box) return;
  box.replaceChildren();
  if (!S.msgsReady) { box.append(h('div', { class: 'center-msg', text: 'Ladataan…' })); return; }
  if (!S.messages.length) {
    const c0 = S.chats[S.openId] || {};
    const addrs = (c0.members || []).flatMap(m => m.emails || []).slice(0, 3);
    box.append(h('div', { class: 'center-msg', id: 'chat-empty' },
      'Kirjaa ensimmäinen viesti alla tai tuo sähköpostit Tuo-välilehdeltä – ' + (addrs.length ? 'osoitteeseen ' + addrs.join(', ') + ' liittyvät viestit' : 'chatin henkilöiden osoitteisiin liittyvät viestit') + ' lajitellaan tänne automaattisesti.'));
    return;
  }
  const now = new Date(), pend = []; let lastDay = '';
  for (const m of S.messages) {
    const d = new Date(m.at); const key = isNaN(d) ? '' : d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
    if (key !== lastDay) { lastDay = key; if (!isNaN(d)) box.append(h('div', { class: 'day', text: fmtDayLabel(d, now) })); }
    box.append(bubbleEl(m, pend));
  }
  const measure = () => {
    for (const [bodyEl, btn] of pend) {
      if (bodyEl.classList.contains('open')) continue;
      // näytä vain jos runko todella katkeaa 8 riviin
      let lh = 21;
      try { lh = parseFloat(getComputedStyle(bodyEl).lineHeight) || 21; } catch (e) { /* oletus */ }
      btn.hidden = !(bodyEl.scrollHeight > lh * 8 + 3);
    }
  };
  requestAnimationFrame(() => { measure(); if (stick.on) progScroll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (S.view === 'chat') { measure(); if (stick.on) progScroll(); } }, () => { });
}
/* "Stick to bottom": pidä chat pohjassa kun korkeus muuttuu (fontit, "Näytä koko viesti" -mittaus, uudet viestit),
   kunnes käyttäjä itse vierittää ylös. */
const stick = { on: false, ro: null, lastProg: 0 };
// Pienellä ruudulla vierittää sivu, kahden paneelin asettelussa viestialue itse.
function scrollEl() { return S.split ? ($('#msgs-scroll') || document.documentElement) : (document.scrollingElement || document.documentElement); }
function distToBottom() { const el = scrollEl(); return S.split ? el.scrollHeight - el.scrollTop - el.clientHeight : el.scrollHeight - window.scrollY - window.innerHeight; }
function progScroll() {
  stick.lastProg = performance.now();
  const el = scrollEl();
  if (S.split) el.scrollTop = el.scrollHeight; else window.scrollTo(0, el.scrollHeight);
}
// Selaimen osoitepalkki voi muuttaa näkymän korkeutta ilman resize-tapahtumaa: tarkista lopputulos muutaman kerran
function settle() { [100, 350, 900].forEach(ms => setTimeout(() => { if (stick.on && S.view === 'chat' && distToBottom() > 2) progScroll(); }, ms)); }
function startStick() {
  stick.on = true;
  if (stick.ro || typeof ResizeObserver === 'undefined') return;
  stick.ro = new ResizeObserver(() => { if (stick.on && S.view === 'chat') progScroll(); });
  ['#msgs', '#c-form', '#app'].forEach(sel => { const e = $(sel); if (e) stick.ro.observe(e); });
}
function stopStick() {
  stick.on = false;
  if (stick.ro) { stick.ro.disconnect(); stick.ro = null; }
}
// Näkymän korkeus voi muuttua ilman sisällön muutosta (mobiilin osoitepalkki, näppäimistö): pidä pohjassa\nconst restick = () => { if (stick.on && S.view === 'chat') progScroll(); };\nwindow.addEventListener('resize', restick);\nif (window.visualViewport) window.visualViewport.addEventListener('resize', restick);\nwindow.addEventListener('wheel', e => { if (S.view === 'chat' && e.deltaY < 0 && (!S.split || (e.target.closest && e.target.closest('#msgs-scroll')))) stick.on = false; }, { passive: true, capture: true });
window.addEventListener('scroll', e => {
  if (S.view !== 'chat' || !S.openId) return;
  if (S.split ? e.target !== $('#msgs-scroll') : (e.target !== document && e.target !== document.documentElement)) return;
  const d = distToBottom();
  if (stick.on && d > 80 && performance.now() - stick.lastProg > 200) stick.on = false;       // käyttäjä vieritti ylös
  else if (!stick.on && d <= 20) { stick.on = true; if (!stick.ro) startStick(); }              // palasi pohjalle
}, { passive: true });
function msgText(m) { return (m.subject ? m.subject + '\n\n' : '') + (m.body || ''); }
function openMessageSheet(m) {
  openSheet('Viesti', (body, api) => {
    body.append(h('div', { class: 'quote', text: previewOf(m) }),
      act('copy', 'Kopioi teksti', async () => {
        api.close();
        if (isSensitive(S.chats[S.openId]) && !await confirmSheet({ title: 'Arkaluonteinen viesti', text: 'Kopioidaanko arkaluonteinen viesti leikepöydälle?', ok: 'Kopioi' })) return;
        copyText(msgText(m));
      }),
      act('move', 'Siirrä toiseen keskusteluun', () => { api.close(); openMoveSheet(m); }),
      act('trash', 'Poista', async () => {
        api.close();
        if (!await confirmSheet({ title: 'Poistetaanko viesti?', text: 'Viesti poistetaan tästä keskustelusta. Tätä ei voi perua.', ok: 'Poista', danger: true })) return;
        const cid = S.openId;
        if (!await doWrites([{ t: 'del', path: 'chats/' + cid + '/messages/' + m.id }])) return;
        await doWrites([statsOp(cid, [], [m.id])]);
        toast('Viesti poistettu');
      }, true));
  });
}
function openMoveSheet(m) {
  const from = S.openId;
  openSheet('Siirrä viesti', (body, api) => {
    const others = chatList().filter(c => c.id !== from).sort((a, b) => chatSortKey(b) - chatSortKey(a));
    if (!others.length) body.append(h('p', { class: 'hint', text: 'Ei muita keskusteluja, joihin viestin voisi siirtää.' }));
    others.forEach(c => body.append(h('button', { class: 'act', type: 'button', id: 'mv-' + c.id, onclick: async () => {
      api.close();
      const doc = toMsgDoc(m);
      const ok = await doWrites([{ t: 'set', path: 'chats/' + c.id + '/messages/' + m.id, data: doc }, { t: 'del', path: 'chats/' + from + '/messages/' + m.id }]);
      if (!ok) return;
      await doWrites([statsOp(c.id, [Object.assign({ id: m.id }, doc)], []), statsOp(from, [], [m.id])]);
      toast('Viesti siirretty: ' + c.name);
    } }, avatar(c.name, 32, c.color), listTitle(c))));
  });
}

/* ----- Kirjauspalkki ----- */
function buildComposer() {
  const C = { dir: 'out', ch: 'sms', open: false };
  const dirOut = h('button', { type: 'button', id: 'c-dir-out', text: 'Lähetin', onclick: () => setDir('out') });
  const dirIn = h('button', { type: 'button', id: 'c-dir-in', text: 'Sain', onclick: () => setDir('in') });
  const chBox = h('div', { class: 'chbtns', role: 'group', 'aria-label': 'Kanava' });
  const chB = {};
  ['email', 'sms', 'whatsapp', 'call', 'meeting'].forEach(k => {
    chB[k] = h('button', { class: 'chbtn', type: 'button', id: 'c-ch-' + k, 'aria-label': CHANNEL_LABEL[k], title: CHANNEL_LABEL[k], onclick: () => setCh(k) }, ico(k, 20));
    chBox.append(chB[k]);
  });
  const moreBtn = h('button', { class: 'small-btn', type: 'button', id: 'c-more-btn', 'aria-expanded': 'false', text: 'Aika', onclick: () => toggleMore() });
  const time = h('input', { id: 'c-time', type: 'datetime-local' });
  const subj = h('input', { id: 'c-subject', type: 'text', autocomplete: 'off', placeholder: 'Aihe' });
  const person = h('select', { id: 'c-person' });
  const timeF = h('div', { class: 'field', style: 'margin:0' }, h('label', { for: 'c-time', text: 'Aika' }), time);
  const subjF = h('div', { class: 'field', style: 'margin:0' }, h('label', { for: 'c-subject', text: 'Aihe (sähköposti)' }), subj);
  const persF = h('div', { class: 'field full', style: 'margin:0' }, h('label', { for: 'c-person', text: 'Henkilö' }), person);
  const moreBox = h('div', { class: 'comp-more', hidden: true }, timeF, subjF, persF);
  const ta = h('textarea', { id: 'c-body', rows: '1', maxlength: String(MAX_BODY), placeholder: 'Kirjaa viesti tai puhelu…', 'aria-label': 'Viesti', autocomplete: 'off' });
  const send = h('button', { class: 'send', type: 'submit', id: 'c-send', 'aria-label': 'Kirjaa viesti' }, ico('send', 20));
  const gmailChk = h('input', { id: 'c-gmail', type: 'checkbox', onchange: () => { if (gmailChk.checked) { setDir('out'); setCh('email'); } } });
  const gmailRow = h('label', { class: 'comp-gmail', id: 'c-gmail-row', for: 'c-gmail', hidden: true }, gmailChk, h('span', { text: 'Kirjoita sähköpostiin' }));
  const form = h('form', { class: 'composer', id: 'c-form', novalidate: true, onsubmit: e => { e.preventDefault(); submit(); } },
    h('div', { class: 'comp-tools' }, h('div', { class: 'seg', role: 'group', 'aria-label': 'Suunta' }, dirOut, dirIn), chBox, moreBtn), moreBox, gmailRow,
    h('div', { class: 'comp-row' }, ta, send));
  function setDir(d) { if (d !== 'out') gmailChk.checked = false; C.dir = d; dirOut.setAttribute('aria-pressed', String(d === 'out')); dirIn.setAttribute('aria-pressed', String(d === 'in')); }
  function setCh(k) {
    if (k !== 'email') gmailChk.checked = false;
    C.ch = k;
    Object.keys(chB).forEach(x => chB[x].setAttribute('aria-pressed', String(x === k)));
    subjF.hidden = k !== 'email';
  }
  function toggleMore(force) {
    C.open = force === undefined ? !C.open : force;
    moreBox.hidden = !C.open; moreBtn.setAttribute('aria-expanded', String(C.open));
    moreBtn.textContent = C.open ? 'Piilota' : 'Aika';
    if (C.open && !time.value) time.value = isoLocalInput(new Date());
  }
  function grow() { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 134) + 'px'; }
  ta.addEventListener('input', grow);
  ta.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing) return;
    // Tietokone: Enter kirjaa, Shift+Enter rivinvaihto. Muualla vain Ctrl/Cmd+Enter kirjaa.
    if (e.ctrlKey || e.metaKey || (S.device === 'desktop' && !e.shiftKey && !e.altKey)) { e.preventDefault(); submit(); }
  });
  async function submit() {
    const chat = S.chats[S.openId]; if (!chat || send.disabled) return;
    if (gmailChk.checked && chatEmails(chat).length) {
      const gb = ta.value.trim();
      if (!gb) { toast('Kirjoita ensin viesti'); ta.focus(); return; }
      gmailComposeSend({ cid: S.openId, body: gb, subject: subj.value.trim(), onSent: () => { ta.value = ''; subj.value = ''; grow(); startStick(); progScroll(); } });
      return;
    }
    const body = ta.value.trim(), subject = C.ch === 'email' ? subj.value.trim() : '';
    if (!body && !subject && C.ch !== 'call' && C.ch !== 'meeting') { toast('Kirjoita ensin viesti'); ta.focus(); return; }
    let at = new Date();
    if (C.open && time.value) { const t = new Date(time.value); if (!isNaN(t)) at = t; }
    const members = chat.members || [];
    const mem = members.find(x => x.id === person.value) || members[0];
    const kind = C.ch === 'email' ? 'email' : 'phone';
    const memAddr = mem ? (kind === 'email' ? (mem.emails || [])[0] || (mem.phones || [])[0] : (mem.phones || [])[0] || (mem.emails || [])[0]) || '' : '';
    const me = ownAddr(kind);
    const m = {
      at: at.toISOString(), dir: C.dir, channel: C.ch, from: C.dir === 'out' ? me : memAddr, fromName: C.dir === 'out' ? 'Sinä' : (mem ? mem.name : chat.name),
      to: C.dir === 'out' ? (memAddr ? [memAddr] : []) : (me ? [me] : []), subject, body, source: 'manual', createdAt: nowIso()
    };
    const id = 'm' + hash64([m.from, m.at, m.subject, m.body.slice(0, 200), uid()].join('|'));
    const doc = toMsgDoc(m);
    send.disabled = true;
    const cid = S.openId;
    const ok = await doWrites([{ t: 'set', path: 'chats/' + cid + '/messages/' + id, data: doc }]);
    if (ok) {
      await doWrites([statsOp(cid, [Object.assign({ id }, doc)], [])]);
      ta.value = ''; subj.value = ''; grow(); if (C.open) time.value = isoLocalInput(new Date());
      startStick(); progScroll(); settle();
    }
    send.disabled = false;
  }
  function reset() {
    const chat = S.chats[S.openId]; if (!chat) return;
    const last = (chat.stats && chat.stats.lastChannel) || 'sms';
    setDir('out'); setCh(['email', 'sms', 'whatsapp', 'call', 'meeting'].includes(last) ? last : 'sms');
    ta.value = ''; subj.value = ''; grow(); toggleMore(false); time.value = ''; gmailChk.checked = false;
    refreshPeople(); refreshGmail();
  }
  function refreshGmail() {
    const chat = S.chats[S.openId];
    const show = !!chat && chatEmails(chat).length > 0;
    gmailRow.hidden = !show;
    if (!show) gmailChk.checked = false;
  }
  function refreshPeople() {
    const chat = S.chats[S.openId]; if (!chat) return;
    const members = chat.members || [], cur = person.value;
    person.replaceChildren(...members.map(x => h('option', { value: x.id, text: x.name, selected: x.id === cur })));
    persF.hidden = members.length < 2;
  }
  return { el: form, reset, refreshPeople, refreshGmail };
}
function buildChatView() {
  const root = h('section', { class: 'view', id: 'v-chat' });
  const comp = buildComposer();
  root.append(
    h('header', { class: 'top chathead' }, h('div', { class: 'top-row' },
      h('button', { class: 'icon-btn', type: 'button', id: 'ch-back', 'aria-label': 'Takaisin', onclick: () => closeChat() }, ico('back', 24)),
      h('span', { id: 'ch-avatar' }),
      h('button', { class: 'who', type: 'button', id: 'ch-who', 'aria-label': 'Keskustelun tiedot', onclick: () => S.openId && openInfoSheet(S.openId) },
        h('span', { class: 'who-name', id: 'ch-name' }), h('span', { class: 'who-sub', id: 'ch-sub' })),
      h('span', { class: 'shield', id: 'ch-shield', role: 'img', 'aria-label': 'Arkaluonteinen', title: 'Arkaluonteinen', hidden: true }, ico('shield', 18)),
      h('button', { class: 'icon-btn', type: 'button', id: 'ch-gmail', hidden: true, 'aria-label': 'Hae Gmailista', title: 'Hae Gmailista', onclick: () => S.openId && gmailSyncOne(S.openId) }, ico('refresh', 22)))),
    h('div', { class: 'msgs-scroll', id: 'msgs-scroll' }, h('div', { class: 'msgs', id: 'msgs', role: 'log', 'aria-label': 'Viestit' })), comp.el);
  views.chat = { root, resetComposer: comp.reset, refreshPeople: comp.refreshPeople, refreshGmail: comp.refreshGmail };
  return root;
}

/* ----- Info-sheet ----- */
function keysForMatch(chat) {
  const set = chatKeys(chat);
  (chat.members || []).forEach(m => { if (m.name) set.add('n:' + m.name.toLowerCase().replace(/\s+/g, ' ')); });
  return set;
}
function unsortedMatches(cid) {
  const chat = S.chats[cid]; if (!chat) return [];
  const keys = keysForMatch(chat);
  return S.unsorted.filter(u => partiesOf(u, S.own).some(p => keys.has(p.key)));
}
async function moveUnsortedTo(msgs, cid) {
  const chat = S.chats[cid]; if (!chat || !msgs.length) return false;
  const members = clone(chat.members || []);
  for (const m of msgs) {
    const ps = partiesOf(m, S.own);
    const p = ps.find(x => S.idx.get(x.key) === cid) || ps[0];
    if (p) ensureMember(members, { name: p.name || m.suggestedName || '', email: p.email, phone: p.phone }, uid);
  }
  const ops = [];
  if (JSON.stringify(members) !== JSON.stringify(chat.members || [])) ops.push({ t: 'update', path: 'chats/' + cid, data: { members, updatedAt: nowIso() } });
  const docs = msgs.map(m => Object.assign({ id: m.id }, toMsgDoc(m)));
  docs.forEach(d => {
    const data = Object.assign({}, d); delete data.id;
    ops.push({ t: 'set', path: 'chats/' + cid + '/messages/' + d.id, data });
    ops.push({ t: 'del', path: 'unsorted/' + d.id });
  });
  if (!await doWrites(ops, 'Siirretään')) return false;
  await doWrites([statsOp(cid, docs, [])]);
  S.sum.sig = '';
  return true;
}
function openInfoSheet(cid) {
  openSheet('Keskustelun tiedot', (body, api) => {
    const c0 = S.chats[cid]; if (!c0) { api.close(); return; }
    const save = async (obj) => { await doWrites([{ t: 'update', path: 'chats/' + cid, data: Object.assign({}, obj, { updatedAt: nowIso() }) }]); };
    const nameI = h('input', { id: 'ci-name', type: 'text', value: c0.name, autocomplete: 'off' });
    nameI.addEventListener('blur', () => { const v = nameI.value.trim(); const c = S.chats[cid]; if (!v) { nameI.value = c.name; return; } if (c && v !== c.name) save({ name: v }); });
    const coI = h('input', { id: 'ci-company', type: 'text', value: c0.company || '', autocomplete: 'off' });
    coI.addEventListener('blur', () => { const v = coI.value.trim(); const c = S.chats[cid]; if (c && v !== (c.company || '')) save({ company: v }); });
    const stI = statusSelect('ci-status', c0.status);
    stI.addEventListener('change', () => save({ status: stI.value }));
    const notes = h('textarea', { id: 'ci-notes', rows: '4', placeholder: 'Muistiinpanot (tallentuu kun poistut kentästä)', value: c0.notes || '' });
    notes.addEventListener('blur', () => { const c = S.chats[cid]; if (c && notes.value !== (c.notes || '')) save({ notes: notes.value }); });
    const sensI = h('input', { id: 'chat-sensitive', type: 'checkbox', checked: isSensitive(c0), onchange: () => save({ sensitive: sensI.checked }) });
    const sensRow = h('div', { style: 'margin:0 0 12px' }, h('label', { class: 'check', for: 'chat-sensitive' }, sensI, h('span', { text: 'Arkaluonteinen keskustelu (esim. päiväkoti, terveys)' })),
      h('p', { class: 'hint', style: 'margin:0 0 0 32px', text: 'Listoissa näkyy vain nimikirjaimet ilman esikatselua. Sitä ei viedä varmuuskopioon ilman salasanaa. Viestin kopiointi vahvistetaan.' }));
    const kv = h('div', { class: 'kv' });
    const memBox = h('div', { id: 'ci-members' });
    const gmBtn = h('button', { class: 'btn block', type: 'button', id: 'ci-gmail', hidden: true, style: 'margin-bottom:6px', onclick: () => { api.close(); gmailSyncOne(cid); } }, ico('refresh', 18), 'Hae Gmailista');
    const gmHint = h('p', { class: 'hint', id: 'ci-gmail-hint', style: 'margin:0 0 10px', hidden: true });
    const matchBtn = h('button', { class: 'btn block', type: 'button', id: 'ci-match', hidden: true, style: 'margin-bottom:10px', onclick: async () => {
      const ms = unsortedMatches(cid); if (!ms.length) return;
      matchBtn.disabled = true;
      const ok = await moveUnsortedTo(ms, cid);
      matchBtn.disabled = false;
      if (ok) toast('Siirrettiin ' + ms.length + ' viestiä');
    } });
    function fmtD(iso) { return iso ? fmtDM(new Date(iso), true) : '–'; }
    function renderAll() {
      const c = S.chats[cid]; if (!c) { api.close(); return; }
      const st = c.stats || {};
      kv.replaceChildren(
        h('div', null, 'Lähetetty', h('b', { text: String(st.sent || 0) })), h('div', null, 'Saatu', h('b', { text: String(st.received || 0) })),
        h('div', null, 'Viimeksi lähetetty', h('b', { text: fmtD(st.lastSentAt) })), h('div', null, 'Viimeksi saatu', h('b', { text: fmtD(st.lastReceivedAt) })));
      memBox.replaceChildren();
      (c.members || []).forEach((m, i) => {
        const card = h('div', { class: 'mem', id: 'mem-' + i },
          h('div', { class: 'mem-h' }, avatar(m.name, 36),
            h('div', { class: 'nm' }, m.name, m.role ? h('small', { text: m.role }) : null),
            h('button', { class: 'icon-btn', type: 'button', id: 'mem-edit-' + i, 'aria-label': 'Muokkaa henkilöä ' + m.name, onclick: () => openMemberSheet(cid, i) }, ico('edit', 18)),
            h('button', { class: 'icon-btn', type: 'button', id: 'mem-del-' + i, 'aria-label': 'Poista henkilö ' + m.name, onclick: async () => {
              if (!await confirmSheet({ title: 'Poistetaanko henkilö?', text: m.name + ' poistetaan keskustelun henkilöistä. Viestit säilyvät.', ok: 'Poista', danger: true })) return;
              const arr = clone(S.chats[cid].members); arr.splice(i, 1);
              save({ members: arr });
            } }, ico('trash', 18))));
        [].concat((m.emails || []).map(v => ['mail', v]), (m.phones || []).map(v => ['call', v])).forEach(([ic, v], j) => {
          const t = h('span', { class: 'mono', text: v });
          card.append(h('div', { class: 'copyline' }, ico(ic, 16), t,
            h('button', { class: 'small-btn', type: 'button', id: 'mem-' + i + '-cp-' + j, text: 'Kopioi', 'aria-label': 'Kopioi ' + v, onclick: () => copyText(v, t) })));
        });
        memBox.append(card);
      });
      if (!(c.members || []).length) memBox.append(h('p', { class: 'hint', text: 'Ei henkilöitä. Lisää henkilö, niin viestit osataan kohdistaa tähän keskusteluun.' }));
      const n = unsortedMatches(cid).length;
      matchBtn.hidden = n === 0; matchBtn.textContent = 'Hae lajittelemattomista (' + n + ')';
      const gOn = gmailAvailable() && chatEmails(c).length > 0;
      gmBtn.hidden = !gOn;
      const ls = c.gmail && c.gmail.lastSyncAt;
      gmHint.hidden = !(gOn && ls);
      if (ls) gmHint.textContent = 'Haettu Gmailista viimeksi ' + fmtDM(new Date(ls), true) + ' ' + fmtTime(new Date(ls));
    }
    api.onRefresh(renderAll);
    body.append(field('ci-name', 'Nimi', nameI), field('ci-company', 'Yritys', coI), field('ci-status', 'Tila', stI), field('ci-notes', 'Muistiinpanot', notes), sensRow,
      kv, h('h3', { class: 'lbl', style: 'margin:0 0 8px', text: 'Henkilöt' }), memBox, matchBtn, gmBtn, gmHint,
      h('div', { class: 'btn-row', style: 'margin:6px 0 18px' },
        h('button', { class: 'btn', type: 'button', id: 'ci-addp', text: 'Lisää henkilö', onclick: () => openMemberSheet(cid, -1) })),
      h('button', { class: 'btn danger block', type: 'button', id: 'ci-delete', text: 'Poista keskustelu', onclick: async () => {
        const c = S.chats[cid];
        if (!await confirmSheet({ title: 'Poistetaanko keskustelu?', text: '"' + c.name + '" ja kaikki sen viestit poistetaan. Tätä ei voi perua.', ok: 'Poista', danger: true })) return;
        const ok = await deleteChats([cid]);
        if (ok) { api.close(); closeChat(); toast('Keskustelu poistettu'); }
      } }));
    renderAll();
  }, { side: true });
}
async function deleteChats(ids) {
  const pg = showProgress('Poistetaan', 1);
  let total = 0, doneBefore = 0;
  try {
    for (const cid of ids) {
      for (let round = 0; round < 30; round++) {
        const list = await S.store.listMessages(cid);
        if (!list.length) break;
        total += list.length; pg.setTotal(total);
        const r = await runWrites(list.map(m => ({ t: 'del', path: 'chats/' + cid + '/messages/' + m.id })), { onProgress: n => pg.set(doneBefore + n, 'Poistetaan viestejä') });
        if (r.error) { toast(errText(r.error), 'bad'); return false; }
        doneBefore += list.length;
      }
      await S.store.del('chats/' + cid);
    }
    S.sum.sig = '';
    return true;
  } catch (e) { toast(errText(e), 'bad'); return false; }
  finally { pg.close(); }
}
function openMemberSheet(cid, idx) {
  const c = S.chats[cid]; if (!c) return;
  const m0 = idx >= 0 ? c.members[idx] : null;
  openSheet(m0 ? 'Muokkaa henkilöä' : 'Lisää henkilö', (body, api) => {
    const pf = personForm('mem-f', m0 || {});
    const form = h('form', { id: 'mem-form', novalidate: true, onsubmit: async e => {
      e.preventDefault();
      const p = pf.read(); if (!p.ok) return;
      if (!p.name && !p.emails.length && !p.phones.length) { toast('Anna henkilölle nimi, sähköposti tai puhelinnumero'); return; }
      const members = clone(S.chats[cid].members || []);
      const rec = { id: m0 ? m0.id : uid(), name: p.name || p.emails[0] || p.phones[0], role: p.role, emails: p.emails, phones: p.phones };
      if (idx >= 0) members[idx] = rec; else members.push(rec);
      sb.disabled = true;
      const ok = await doWrites([{ t: 'update', path: 'chats/' + cid, data: { members, updatedAt: nowIso() } }]);
      sb.disabled = false;
      if (!ok) return;
      api.close();
      S.chats[cid] = Object.assign({}, S.chats[cid], { members }); rebuildIndexes(); notifyRefresh();
      const n = unsortedMatches(cid).length;
      if (n) toast('Löytyi ' + n + ' lajittelematonta viestiä – siirrä ne keskustelun tiedoissa');
    } });
    const sb = h('button', { class: 'btn primary block', type: 'submit', id: 'mem-save', text: 'Tallenna' });
    form.append(...pf.els, sb);
    body.append(form);
  });
}
