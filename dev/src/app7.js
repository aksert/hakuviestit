/* ===== Gmail-yhteys (claude.ai:n mcp-capability) =====
   Gmailia kutsutaan VAIN käyttäjän napautuksesta (haku / lähetyksen vahvistus), ei latauksessa eikä silmukoissa.
   Sähköpostien sisältö kulkee vain salaavan tallennuskerroksen (S.store) kautta ja näytetään textContentilla. */
S.mcp = null; S.perm = null;
const GM = { busy: false, permOk: false };
// claude.ai: Gmail-yhdistäjä (mcp). Puhelinversio: suora vain luku -yhteys (gmailRestBackend), kun Google-kirjautuminen on voimassa.
const gmailAvailable = () => !!S.mcp && !S.locked && (S.mcp.rest ? gmailRestReady() : !STANDALONE);
const gmailIsRest = () => !!(S.mcp && S.mcp.rest);
const chatEmails = chat => [...new Set(((chat && chat.members) || []).flatMap(m => m.emails || []).map(normEmail).filter(isEmail))];
const myEmailSet = () => new Set(((S.profile && S.profile.identities) || []).filter(i => i.type === 'email').map(i => normEmail(i.value)));
const myEmail = () => { const i = ((S.profile && S.profile.identities) || []).find(x => x.type === 'email'); return i ? normEmail(i.value) : ''; };

async function gmailCall(tool, input) {
  const res = await S.mcp.callTool('Gmail', tool, input, { cache: false });
  return (res && res.payload) || {};
}
// Lukukutsu: yksi uudelleenyritys vain jos err.retryable
async function gmailRead(tool, input, ctl) {
  try { return await gmailCall(tool, input); }
  catch (e) {
    if (e && e.retryable && !(ctl && ctl.cancelled)) { await sleep(e.retryAfterMs || 1000 + Math.random() * 1000); return gmailCall(tool, input); }
    throw e;
  }
}
async function getPerms() {
  if (S.perm) return S.perm;
  const p = window.claude && window.claude.use ? await window.claude.use('permissions') : null;
  if (p) S.perm = p;
  return p;
}
// Kehittäjän diagnostiikka: selväkielinen diag/send (+ diag/send-<yritys>); ei koskaan viestin sisältöä, aihetta tai osoitteita. Virheet nielaistaan hiljaa.
function writeSendDiag(attempt, tool, err, secrets) {
  try {
    const doc = buildSendDiag({ attempt, tool, err, at: nowIso(), ua: bioUA(), standalone: STANDALONE, secrets });
    const st = SEC.inner; if (!st) return;
    ['diag/send', 'diag/send-' + attempt].forEach(p => { try { Promise.resolve(st.set(p, doc)).catch(() => { /* diag ei saa häiritä */ }); } catch (e) { /* ok */ } });
  } catch (e) { /* diag ei saa häiritä */ }
}
// Ensimmäinen suora lähetys sivun latauksen jälkeen: tarkista Gmail-lupa ja pyydä se tarvittaessa (kutsutaan napautuksen käsittelijästä). 'ok' | 'denied'
async function ensureGmailPerm() {
  if (GM.permOk) return 'ok';
  let p = null; try { p = await getPerms(); } catch (e) { p = null; }
  if (!p || typeof p.state !== 'function') return 'ok';
  const st = async () => { const v = await p.state('mcp:Gmail'); return typeof v === 'string' ? v : String((v && v.state) || ''); };
  try {
    let v = await st();
    if (v === 'prompt' && typeof p.request === 'function') {
      let r = null; try { r = await p.request(['mcp:Gmail']); } catch (e) { r = null; }
      try { v = await st(); } catch (e) { v = /denied/.test(JSON.stringify(r) || '') ? 'denied' : v; }
    }
    if (v === 'denied') return 'denied';
  } catch (e) { return 'ok'; }
  GM.permOk = true; return 'ok';
}
/* ----- Virheiden näyttö (yhteinen haulle ja lähetykselle) ----- */
function gmailErrorBox(err, retryFn) {
  const info = gmailErrorInfo(err);
  if (info.unavailable) { S.mcp = null; setTimeout(refreshGmailUi, 0); }
  const box = h('div', { class: 'gm-err', id: 'gm-err', role: 'alert' }, h('p', { id: 'gm-err-text', text: info.text }));
  const row = h('div', { class: 'btn-row' });
  if (info.reauth && gmailRestCapable()) {
    row.append(h('button', { class: 'btn primary', type: 'button', id: 'gm-reauth', text: 'Kirjaudu Googleen', onclick: () => gmailConnect('') }));
  }
  if (info.openPerms) {
    row.append(h('button', { class: 'btn', type: 'button', id: 'gm-perms', text: 'Avaa luvat', onclick: async () => {
      try { const p = await getPerms(); if (!p || !p.manage) throw new Error('ei'); await p.manage(); }
      catch (e) { toast('Avaa luvat artifactin Permissions-valikosta.'); }
    } }));
  }
  if (info.retry && retryFn) {
    const rb = h('button', { class: 'btn primary', type: 'button', id: 'gm-retry', text: 'Yritä uudelleen', onclick: () => { rb.disabled = true; retryFn(); } });
    row.append(rb);
  }
  if (row.children.length) box.append(row);
  return box;
}
function showGmailErrorSheet(err, retryFn) {
  openSheet('Gmail', (body, api) => { body.append(gmailErrorBox(err, retryFn ? () => { api.close(); retryFn(); } : null)); });
}

/* ----- Haku ----- */
function openSyncSheet(title) {
  const ctl = { cancelled: false };
  let bar, lbl;
  const sh = openSheet(title, body => {
    bar = h('i', { id: 'gs-bar' }); lbl = h('p', { class: 'hint', id: 'gs-label', 'aria-live': 'polite', text: 'Haetaan…' });
    body.append(h('div', { class: 'prog' }, bar), lbl,
      h('button', { class: 'btn block', type: 'button', id: 'gs-cancel', text: 'Peruuta', onclick: () => { ctl.cancelled = true; lbl.textContent = 'Keskeytetään…'; } }));
  }, { persistent: true });
  ctl.set = (done, total, text) => { bar.style.width = total ? Math.min(100, Math.round(100 * done / total)) + '%' : '0%'; if (text) lbl.textContent = text; };
  ctl.close = () => sh.close();
  return ctl;
}
async function gmailSyncChat(cid, ctl, prefix) {
  const chat = S.chats[cid];
  const q = gmailQueryForChat(chat);
  if (!q) return { added: 0, threads: 0 };
  const pre = prefix ? prefix + ': ' : '';
  const ids = []; let token;
  for (let page = 0; page < 3 && !ctl.cancelled; page++) {
    ctl.set(0, 0, pre + 'Haetaan ketjuja…');
    const res = await gmailRead('search_threads', Object.assign({ query: q, pageSize: 20, view: 'THREAD_VIEW_IDS_ONLY' }, token ? { pageToken: token } : {}), ctl);
    (res.threads || []).forEach(t => { if (t && t.id && !ids.includes(t.id) && ids.length < 60) ids.push(t.id); });
    token = res.nextPageToken;
    if (!token || ids.length >= 60) break;
  }
  const have = new Set((await S.store.listMessages(cid)).map(m => m.id));
  const mine = myEmailSet();
  const newDocs = []; let done = 0;
  for (let i = 0; i < ids.length && !ctl.cancelled; i++) {
    ctl.set(i, ids.length, pre + 'Haetaan… ' + i + '/' + ids.length + ' ketjua');
    const th = await gmailRead('get_thread', { threadId: ids[i], messageFormat: 'PLAIN_TEXT' }, ctl);
    const ops = [];
    for (const gm of (th.messages || [])) {
      const am = gmailMsgToAppMsg(gm, mine);
      if (!am || have.has(am.id)) continue;
      have.add(am.id);
      const doc = toMsgDoc(am);
      ops.push({ t: 'set', path: 'chats/' + cid + '/messages/' + am.id, data: doc });
      newDocs.push(Object.assign({ id: am.id }, doc));
    }
    if (ops.length) { const r = await runWrites(ops, {}); if (r.error) throw r.error; }
    done = i + 1;
  }
  ctl.set(done, ids.length, pre + 'Valmis ' + done + '/' + ids.length + ' ketjua');
  // Sähköpostiin avatut (pending) viestit: korvataan Gmailista haetulla oikealla kopiolla
  let removed = [];
  try {
    const all = await S.store.listMessages(cid);
    const pend = all.filter(m => m.pending), outs = all.filter(m => m.source === 'gmail' && m.dir === 'out');
    const used = new Set();
    for (const p of pend) {
      const hit = matchPending(p, outs.filter(m => !used.has(m.id)));
      if (hit) { used.add(hit.id); removed.push(p.id); }
    }
    if (removed.length) { const r = await runWrites(removed.map(id => ({ t: 'del', path: 'chats/' + cid + '/messages/' + id })), {}); if (r.error) { removed = []; throw r.error; } }
  } catch (re) { /* täsmäytys on parhaan yrityksen varassa */ }
  if (newDocs.length || removed.length) await recomputeStats(cid, newDocs, removed);
  if (!ctl.cancelled) await S.store.update('chats/' + cid, { gmail: { lastSyncAt: nowIso() } });
  return { added: newDocs.length, threads: ids.length };
}
const syncToast = (added, cancelled) => toast((cancelled ? 'Haku keskeytettiin: ' : '') + '+' + added + (added === 1 ? ' uusi viesti' : ' uutta viestiä'));
async function gmailSyncOne(cid) {
  if (GM.busy || !gmailAvailable() || !S.chats[cid]) return;
  GM.busy = true;
  const ctl = openSyncSheet('Haetaan Gmailista');
  try {
    const r = await gmailSyncChat(cid, ctl);
    ctl.close(); syncToast(r.added, ctl.cancelled); S.sum.sig = '';
  } catch (e) {
    ctl.close();
    showGmailErrorSheet(e, () => gmailSyncOne(cid));
  } finally { GM.busy = false; }
}
async function gmailSyncAll() {
  if (GM.busy || !gmailAvailable()) return;
  const ids = chatList().filter(c => chatEmails(c).length).sort((a, b) => chatSortKey(b) - chatSortKey(a)).map(c => c.id);
  if (!ids.length) { toast('Ei keskusteluja, joilla on sähköpostiosoite.'); return; }
  GM.busy = true;
  const ctl = openSyncSheet('Haetaan Gmailista');
  let added = 0;
  try {
    for (let i = 0; i < ids.length && !ctl.cancelled; i++) {
      const r = await gmailSyncChat(ids[i], ctl, 'Keskustelu ' + (i + 1) + '/' + ids.length);
      added += r.added;
    }
    ctl.close(); syncToast(added, ctl.cancelled); S.sum.sig = '';
  } catch (e) {
    ctl.close();
    if (added) syncToast(added, true);
    showGmailErrorSheet(e, () => gmailSyncAll());
  } finally { GM.busy = false; }
}

/* ----- Lähetys ----- */
const gmailLatest = () => { const a = S.messages.filter(m => m.source === 'gmail' && m.gmail && m.gmail.messageId); return a.length ? a[a.length - 1] : null; };
const gmailLatestIncoming = () => { const a = S.messages.filter(m => m.dir === 'in' && m.source === 'gmail' && m.gmail && m.gmail.messageId); return a.length ? a[a.length - 1] : null; };
function gmailComposeSend(o) {
  const chat = S.chats[o.cid]; if (!chat) return;
  const latest = gmailLatest(), inc = gmailLatestIncoming();
  const emails = chatEmails(chat);
  const opts = emails.slice();
  if (inc && inc.from && isEmail(inc.from) && !opts.includes(inc.from)) opts.unshift(inc.from);
  const defTo = inc && opts.includes(inc.from) ? inc.from : opts[0];
  const direct = !!settings().gmailDirect && gmailAvailable() && !gmailIsRest();
  openSheet('Kirjoita sähköposti', (body, api) => {
    const toSel = h('select', { id: 'gc-to', 'aria-label': 'Vastaanottaja' }, opts.map(e => h('option', { value: e, text: e, selected: e === defTo })));
    const subj = h('input', { id: 'gc-subject', type: 'text', autocomplete: 'off', value: latest ? replySubject(latest.subject) : (o.subject || ''), disabled: !!latest && direct, placeholder: 'Aihe' });
    const errWrap = h('div', { id: 'gc-errwrap' });
    const sendBtn = h('button', { class: 'btn block', type: 'button', id: 'gc-send', text: 'Lähetä Gmailin kautta' });
    const cancelBtn = h('button', { class: 'btn', type: 'button', id: 'gc-cancel', text: 'Peruuta', onclick: () => api.close() });
    let sending = false;
    const doSend = async () => {
      if (sending) return;
      const to = toSel.value, subject = subj.value.trim();
      errWrap.replaceChildren();
      if (!latest && !subject) { errWrap.append(h('p', { class: 'err', text: 'Anna sähköpostille aihe.' })); subj.focus(); return; }
      sending = true; sendBtn.hidden = false; sendBtn.disabled = true; sendBtn.textContent = 'Lähetetään…';
      const startedAt = Date.now();
      const finishSent = async payload => {
        const mid = payload && payload.id;
        const id = mid ? gmailDocId(mid) : 'gm-' + hash64(o.cid + '|' + Date.now() + '|' + o.body.slice(0, 50));
        const doc = toMsgDoc({
          at: nowIso(), dir: 'out', channel: 'email', from: myEmail(), fromName: 'Sinä', to: [to], subject: latest ? (subject || replySubject(latest.subject)) : subject,
          body: o.body, source: 'gmail', gmail: mid ? { messageId: mid, threadId: payload.threadId || '' } : null
        });
        api.close();
        try {
          await S.store.set('chats/' + o.cid + '/messages/' + id, doc);
          await recomputeStats(o.cid, [Object.assign({ id }, doc)], []);
        } catch (se) { toast('Sähköposti lähetettiin, mutta viestin tallennus epäonnistui. Hae viestit Gmailista.', 'bad'); }
        if (o.onSent) o.onSent();
        toast('Sähköposti lähetetty');
      };
      const secrets = () => [o.body, subj.value.trim()];
      const codeHint = code => h('p', { class: 'hint', id: 'gc-code', text: 'Virhekoodi: ' + (code || 'tuntematon') });
      // Koko syy näkyviin (sähköpostiosoitteet piilotettu, enintään 200 merkkiä)
      const msgHint = err => { const m = redactDiag(err && err.message, 200, secrets()); return m ? h('p', { class: 'hint', id: 'gc-msg', text: m }) : null; };
      const hints = (code, err) => [codeHint(code), msgHint(err)].filter(Boolean);
      const redErr = err => Object.assign({}, err, { message: redactDiag(err && err.message, 200, secrets()) });   // osoitteet piiloon myös virhelaatikossa
      const mailtoBtn = () => h('a', { class: 'btn', id: 'gc-mailto', style: 'text-decoration:none', href: mailtoHref(to, subject, o.body), target: '_blank', rel: 'noopener', text: 'Avaa sähköpostisovelluksessa',
        onclick: () => { toast('Kun viesti on lähetetty, se tulee tähän chattiin seuraavassa Gmail-haussa.'); api.close(); } });
      const showNotSent = async (code, err) => {
        const reason = (code === 'upstream_error' || code === 'approval_required')
          ? 'Gmail ei saanut lähetyslupaa. Puhelimen Claude-sovellus ei aina pysty kysymään lupaa – salli lähetys Luvat-valikosta tai kokeile claude.ai-sivulla selaimessa.'
          : code === 'perm_denied' ? 'Gmailin lähetyslupa on estetty. Avaa Luvat ja salli lähetys.'
            : code === 'server_unavailable' ? 'Gmail ei vastannut ajoissa.' : code === 'cancelled' ? 'Lähetys keskeytyi.' : '';
        let perms = null; try { perms = await getPerms(); } catch (pe) { perms = null; }
        const row = h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', type: 'button', id: 'gc-retry', text: 'Yritä uudelleen', onclick: () => { doSend(); } }));
        if (perms && perms.manage) row.append(h('button', { class: 'btn', type: 'button', id: 'gc-perms', text: 'Luvat', onclick: async () => {
          try { await perms.manage(); } catch (me) { toast('Avaa artefaktin ⋮-valikosta Luvat.'); }
        } }));
        row.append(mailtoBtn());
        const box = h('div', { class: 'gm-err', id: 'gm-err', role: 'alert' }, h('p', { id: 'gm-err-text', text: 'Viestiä ei lähetetty.' }));
        if (reason) box.append(h('p', { id: 'gm-err-reason', text: reason }));
        box.append(row);
        errWrap.replaceChildren(box, ...hints(code, err));
        sendBtn.hidden = true;
      };
      const resetBtn = () => { sendBtn.disabled = false; sendBtn.textContent = 'Lähetä Gmailin kautta'; };
      // Lähetyksen varmistus Lähetetyistä: {threads, hit}; threads === null jos haku epäonnistui
      const verify = async () => {
        let threads = null, hit = null;
        // Gmailin haku voi näyttää juuri lähetetyn viestin viiveellä: tarkistetaan muutaman kerran ennen kuin sanotaan "ei lähetetty"
        for (const wait of (window.HV_SENT_CHECK_DELAYS || [1500, 3000, 4500])) {
          await new Promise(r => setTimeout(r, wait));
          try { const r = await gmailCall('search_threads', { query: 'in:sent to:' + to + ' newer_than:1d', pageSize: 10, view: 'THREAD_VIEW_MINIMAL' }); threads = r.threads || []; }
          catch (re) { writeSendDiag('verify', 'search_threads', re, secrets()); if (!threads) threads = null; break; }
          hit = findSentMatch(threads, { to, subject, body: o.body, sinceMs: startedAt });
          if (hit) break;
        }
        return { threads, hit };
      };
      const perm = await ensureGmailPerm();
      if (perm === 'denied') { resetBtn(); sending = false; await showNotSent('perm_denied'); return; }
      let attempt = latest ? 'reply' : 'send_message', fellBack = false;
      let err = null;
      try {
        const payload = latest
          ? await gmailCall('reply', { messageId: latest.gmail.messageId, body: o.body, to: [to] })
          : await gmailCall('send_message', { to: [to], subject, body: o.body });
        await finishSent(payload);
        return;
      } catch (e) { err = e; }
      for (;;) {
        const e = err, code = String((e && e.code) || '');
        writeSendDiag(attempt, attempt, e, secrets());
        resetBtn();
        if (code === 'approval_required') { sending = false; await showNotSent(code, e); return; }
        const canFallback = !fellBack && !!latest && attempt === 'reply' && ['tool_error', 'bad_request', 'upstream_error'].includes(code);
        if (NOT_SENT_DEFINITE.includes(code) && !canFallback) {
          errWrap.append(gmailErrorBox(redErr(e), () => { sending = false; doSend(); }), ...hints(code, e));
          sending = false; return;
        }
        // Epävarma tulos (tai varalähetyksen ehto): varmista Lähetetyistä
        errWrap.replaceChildren(h('p', { class: 'hint', id: 'gc-status', role: 'status', text: 'Tarkistetaan, lähtikö viesti…' }));
        sendBtn.disabled = true; sendBtn.textContent = 'Tarkistetaan…';
        const { threads, hit } = await verify();
        resetBtn();
        if (!threads) {
          sending = false;
          if (NOT_SENT_DEFINITE.includes(code)) { errWrap.replaceChildren(gmailErrorBox(redErr(e), () => { sending = false; doSend(); }), ...hints(code, e)); return; }
          errWrap.replaceChildren(h('div', { class: 'gm-err', id: 'gm-err', role: 'alert' }, h('p', { id: 'gm-err-text', text: SEND_UNCERTAIN_TEXT }), h('div', { class: 'btn-row' }, mailtoBtn())), ...hints(code, e));
          sendBtn.textContent = 'Lähetä uudelleen';
          return;
        }
        if (hit) { await finishSent(hit); return; }
        if (!canFallback) { sending = false; await showNotSent(code, e); return; }
        // Varalähetys: reply hylättiin eikä viestiä löytynyt Lähetetyistä -> ei kaksoislähetyksen riskiä. Yritetään kerran uutena viestinä samaan ketjuun.
        fellBack = true; attempt = 'send_message';
        sendBtn.disabled = true; sendBtn.textContent = 'Lähetetään…';
        try {
          const payload = await gmailCall('send_message', { to: [to], subject: subject || replySubject(latest.subject), body: o.body, replyThreadId: latest.gmail.threadId });
          await finishSent(payload);
          return;
        } catch (e2) { err = e2; }
      }
    };
    sendBtn.onclick = doSend;
    // Oletus: avaa valmiiksi kirjoitettu sähköposti käyttäjän omaan sähköpostisovellukseen (ei Gmail-kirjoituslupaa)
    const bodyTa = h('textarea', { id: 'gc-body', readonly: true, rows: '6', 'aria-label': 'Viesti' });
    bodyTa.value = o.body;
    const openA = h('a', { class: 'btn primary block', id: 'gc-open', style: 'text-decoration:none', href: '#', target: '_blank', rel: 'noopener', text: 'Avaa sähköpostisovelluksessa', onclick: () => opened() });
    const webA = h('a', { class: 'btn block', id: 'gc-gmailweb', style: 'text-decoration:none', href: '#', target: '_blank', rel: 'noopener', text: 'Avaa Gmailissa (selain)', onclick: () => opened() });
    const upd = () => {
      openA.setAttribute('href', mailtoHref(toSel.value, subj.value.trim(), o.body));
      webA.setAttribute('href', gmailComposeUrl(toSel.value, subj.value.trim(), o.body));
    };
    ['input', 'change'].forEach(t => { toSel.addEventListener(t, upd); subj.addEventListener(t, upd); });
    upd();
    const copyBtn = h('button', { class: 'btn block', type: 'button', id: 'gc-copy', text: 'Kopioi teksti', onclick: async () => {
      try {
        if (!(navigator.clipboard && navigator.clipboard.writeText)) throw new Error('ei');
        await navigator.clipboard.writeText(o.body); toast('Teksti kopioitu');
      } catch (ce) { try { bodyTa.focus(); bodyTa.select(); } catch (se) { /* ei valintaa */ } toast('Kopioi teksti käsin'); }
    } });
    let saved = false;
    const opened = () => {
      upd();
      if (saved) return;
      saved = true;
      const to = toSel.value, subject = subj.value.trim();
      const doc = toMsgDoc({ at: nowIso(), dir: 'out', channel: 'email', from: myEmail(), fromName: 'Sinä', to: [to], subject, body: o.body, source: 'manual', pending: true });
      const id = 'm' + hash64([o.cid, doc.at, subject, o.body.slice(0, 200), uid()].join('|'));
      toast('Viesti avattiin sähköpostiin. Muista painaa siellä Lähetä.');
      setTimeout(() => api.close(), 150);
      (async () => {
        if (!await doWrites([{ t: 'set', path: 'chats/' + o.cid + '/messages/' + id, data: doc }])) return;
        await doWrites([statsOp(o.cid, [Object.assign({ id }, doc)], [])]);
        if (o.onSent) o.onSent();
      })();
    };
    body.append(...[
      direct ? h('div', { class: 'field' }, h('span', { class: 'lbl', text: 'Lähettäjä (Gmail-tilisi)' }), h('div', { id: 'gc-from', class: 'mono', style: 'font-size:14px;overflow-wrap:anywhere', text: myEmail() || 'Gmailissa käytössä oleva tili' })) : null,
      field('gc-to', 'Vastaanottaja', toSel),
      field('gc-subject', 'Aihe', subj, latest && direct ? 'Vastaus jatkaa samaa ketjua, joten aihetta ei voi muuttaa.' : null),
      field('gc-body', 'Viesti', bodyTa),
      openA,
      h('p', { class: 'hint', id: 'gc-hint', style: 'margin:6px 0 10px', text: 'Sähköposti avautuu valmiiksi kirjoitettuna. Lähetä se sieltä – sovellus ei lähetä mitään itse.' }),
      h('div', { class: 'btn-row', style: 'flex-direction:column' }, webA, copyBtn, direct ? sendBtn : null),
      errWrap, h('div', { class: 'btn-row', style: 'margin-top:8px' }, cancelBtn)].filter(Boolean));
  });
}

/* ----- Käyttöliittymän näkyvyys ----- */
function gmailSection() {
  return h('div', { class: 'sec', id: 'gm-card' }, h('h2', { text: 'Gmail' }),
    h('div', { class: 'card' },
      h('p', { id: 'gm-note', style: 'margin-bottom:8px' }),
      gmailRestSection(),
      h('button', { class: 'btn block', type: 'button', id: 'gm-discover', style: 'margin-bottom:8px', onclick: () => openDiscoverPrompt() }, ico('search', 18), 'Etsi työpaikkakeskustelut'),
      h('button', { class: 'btn block', type: 'button', id: 'gm-sync-all', style: 'margin-bottom:10px', onclick: gmailSyncAll }, ico('refresh', 18), 'Hae kaikki keskustelut Gmailista'),
      h('label', { class: 'check', id: 'gm-direct-row', for: 'gm-direct', style: 'margin-bottom:2px' }, h('input', { id: 'gm-direct', type: 'checkbox', onchange: e => saveSettings({ gmailDirect: e.target.checked }) }), h('span', { text: 'Lähetä suoraan Gmailin kautta (vaatii Gmailin lähetysluvan)' })),
      h('p', { class: 'hint', id: 'gm-direct-hint', style: 'margin:0 0 10px 32px', text: 'Oletuksena sähköposti avataan sähköpostisovellukseen ja lähetät sen siellä.' }),
      h('p', { class: 'hint', id: 'gm-privacy', style: 'margin-bottom:6px', text: STANDALONE ? 'Sähköpostit tallennetaan salattuina. Gmail-haku tapahtuu vain kun painat painiketta.' : 'Sähköpostit tallennetaan salattuina. Gmail-haku ja -lähetys tapahtuvat vain kun painat painiketta.' }),
      h('p', { class: 'hint', id: 'gm-outlook', style: 'margin:0', text: 'Outlook/Hotmail: tuo viestit nykyisellä tuontitoiminnolla (suora yhteys ei vielä tuettu).' })));
}
function renderGmail() {
  const note = $('#gm-note'); if (!note) return;
  const on = gmailAvailable();
  const rest = gmailRestCapable();
  note.textContent = on ? (gmailIsRest() ? 'Gmail on yhdistetty. Etsi työpaikkakeskustelut tai hae keskustelujen sähköpostit painikkeilla.' : 'Gmail on käytettävissä. Hae keskustelujen sähköpostit painikkeella tai kirjoita vastaus chatin kirjauspalkista sähköpostiin.') : rest ? 'Hae työnhaun sähköpostit suoraan Gmailista tähän puhelimeen.' : 'Gmail-yhteys toimii, kun sovellus avataan claude.ai:ssa.';
  const dr = $('#gm-direct'); if (dr) dr.checked = !!settings().gmailDirect;
  const dOn = on && !gmailIsRest();
  $('#gm-direct-row').hidden = !dOn; $('#gm-direct-hint').hidden = !dOn;
  renderGmailRest();
  $('#gm-sync-all').hidden = !on; $('#gm-discover').hidden = !on; $('#gm-privacy').hidden = !on;
}
function refreshGmailUi() {
  if (S.locked) return;
  renderGmail();
  if (S.chatsReady) renderChatList();
  const chat = S.chats[S.openId];
  const show = gmailAvailable() && !!chat && chatEmails(chat).length > 0;
  const hb = $('#ch-gmail'); if (hb) hb.hidden = !show;
  if (views.chat && views.chat.refreshGmail) views.chat.refreshGmail();
  notifyRefresh();
}
