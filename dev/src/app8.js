/* ===== Etsi työpaikkakeskustelut Gmailista =====
   Kaikki Gmail-kutsut alkavat vasta kun käyttäjä napauttaa "Etsi". Etsintä lukee vain metadataa (osoitteet, aiheet, päivät). */
const DISC = { busy: false };
const PERIODS = [['6m', '6 kk'], ['1y', '1 v'], ['2y', '2 v'], ['all', 'Kaikki']];

function openDiscoverPrompt(enteredEmail) {
  if (!gmailAvailable() || DISC.busy || GM.busy) return;
  openSheet('Haetaanko työpaikkakeskustelut?', (body, api) => {
    const sel = h('select', { id: 'dp-period', 'aria-label': 'Aikaväli' }, PERIODS.map(([v, l]) => h('option', { value: v, text: l, selected: v === '2y' })));
    body.append(
      h('p', { id: 'dp-text', style: 'font-size:15px;margin-bottom:12px', text: 'Sovellus etsii Gmailista kaikki keskustelut, joita olet käynyt työnantajien kanssa, ja tekee niistä chatit. Mitään ei lähetetä.' }),
      field('dp-period', 'Aikaväli', sel),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', id: 'dp-no', text: 'Ei nyt', onclick: () => api.close() }),
        h('button', { class: 'btn primary', type: 'button', id: 'dp-go', text: 'Etsi', onclick: () => { const p = sel.value; api.close(); startDiscovery(p, enteredEmail); } })));
  });
}

// Luokittelu: vain sääntöpohjainen (kaikki tehdään paikallisesti, mitään ei lähetetä minnekään).
async function classifyGroups(groups) {
  const heur = new Map(groups.map(g => [g.key, { work: isWorkGroup(g), company: groupCompany(g) }]));
  return { map: heur, method: 'rules' };
}

async function startDiscovery(period, entered) {
  if (DISC.busy || GM.busy || !gmailAvailable()) return;
  DISC.busy = GM.busy = true;
  const ctl = openSyncSheet('Etsitään työpaikkakeskusteluja');
  let handedOff = false;
  const stop = msg => { ctl.close(); if (msg) toast(msg); };
  try {
    // 1. Tilin tarkistus
    ctl.set(0, 0, 'Tarkistetaan Gmail-tiliä…');
    const accRes = await gmailRead('search_threads', { query: 'in:sent', pageSize: 1, view: 'THREAD_VIEW_METADATA_ONLY' }, ctl);
    if (ctl.cancelled) return stop('Haku keskeytettiin');
    const acc = connectedAccountFromThreads(accRes.threads);
    const want = normEmail(entered || myEmail() || '');
    if (acc && !myEmailSet().has(acc)) {
      if (want && acc !== want) {
        const go = await confirmSheet({ title: 'Gmail-tili', ok: 'Jatka tällä tilillä', text: (gmailIsRest() ? 'Olet kirjautunut Googleen tilillä ' : 'Gmail-yhdistäjä on kirjautunut tilille ') + acc + '. Voit hakea vain sen tilin postit.' });
        if (!go) return stop();
      }
      const ids = ((S.profile && S.profile.identities) || []).slice();
      if (!ids.some(i => i.type === 'email' && normEmail(i.value) === acc)) await saveIdentities(ids.concat([{ type: 'email', value: acc, label: 'Gmail' }]), { noPrompt: true });
    }
    const own = new Set([...myEmailSet(), ...(acc ? [acc] : [])]);
    // 2. Metadatahaku (A: omat keskustelut, B: työnantajien viestit joihin et vastannut)
    const q = discoveryQueries(period), threads = new Map();
    for (const key of ['A', 'B']) {
      let token;
      for (let page = 0; page < 4 && !ctl.cancelled; page++) {
        ctl.set(0, 0, 'Etsitään… ' + threads.size + ' ketjua');
        const res = await gmailRead('search_threads', Object.assign({ query: q[key], pageSize: 50, view: 'THREAD_VIEW_MINIMAL' }, token ? { pageToken: token } : {}), ctl);
        (res.threads || []).forEach(t => { if (t && t.id && !threads.has(t.id)) threads.set(t.id, t); });
        token = res.nextPageToken;
        if (!token) break;
      }
    }
    if (ctl.cancelled) return stop('Haku keskeytettiin');
    ctl.set(0, 0, 'Ryhmitellään… ' + threads.size + ' ketjua');
    const groups = discoverCounterparts([...threads.values()], own);
    // 3. Luokittelu
    const cls = await classifyGroups(groups);
    ctl.close(); handedOff = true;
    if (!groups.length) { toast('Gmailista ei löytynyt keskusteluja valitulta ajalta.'); return; }
    openDiscoverReview(groups, cls);
  } catch (e) {
    ctl.close();
    showGmailErrorSheet(e, () => { DISC.busy = GM.busy = false; startDiscovery(period, entered); });
  } finally { if (!handedOff || !DISC.reviewOpen) { DISC.busy = false; GM.busy = false; } }
}

// 4. Tarkistusnäkymä
function openDiscoverReview(groups, cls) {
  DISC.reviewOpen = true; DISC.busy = true; GM.busy = true;
  const items = groups.map(g => {
    const c = cls.map.get(g.key) || { work: isWorkGroup(g), company: groupCompany(g) };
    const ex = matchExistingChat(g, S.chats);
    return { g, work: c.work && !g.jobBoard, name: c.company || groupCompany(g) || g.addresses[0].email, existing: ex, checked: c.work };
  }).sort((a, b) => (b.work ? 1 : 0) - (a.work ? 1 : 0));
  const nWork = items.filter(x => x.work).length, nOther = items.length - nWork;
  let finished = false;
  openSheet('Löytyi ' + nWork + (nWork === 1 ? ' työpaikka' : ' työpaikkaa'), (body, api) => {
    const list = h('div', { id: 'dr-list' }), others = h('div', { id: 'dr-others', hidden: true });
    const go = h('button', { class: 'btn primary block', type: 'button', id: 'dr-go' });
    const rows = items.map((it, i) => {
      const chk = h('input', { id: 'dr-chk-' + i, type: 'checkbox', checked: it.checked, onchange: () => { it.checked = chk.checked; upd(); } });
      const nameEl = it.existing
        ? h('div', { class: 'nm', text: S.chats[it.existing] ? S.chats[it.existing].name : it.name })
        : h('input', { id: 'dr-name-' + i, type: 'text', value: it.name, 'aria-label': 'Yrityksen nimi', autocomplete: 'off', oninput: e => { it.name = e.target.value; } });
      const meta = it.g.count + (it.g.count === 1 ? ' ketju' : ' ketjua') + ' · ' + it.g.addresses.length + (it.g.addresses.length === 1 ? ' osoite' : ' osoitetta') + (it.g.lastAt ? ' · ' + relDays(daysAgo(it.g.lastAt, new Date())) : '');
      const row = h('div', { class: 'dr-row' + (it.work ? '' : ' other'), id: 'dr-row-' + i },
        h('label', { class: 'dr-chk', for: 'dr-chk-' + i }, chk, h('span', { class: 'sr', text: 'Valitse ' + it.name })),
        h('div', { class: 'dr-main' }, nameEl,
          h('div', { class: 'hint', text: meta }),
          it.g.jobBoard ? h('span', { class: 'tag', id: 'dr-board-' + i, text: 'Työpaikkailmoitukset' }) : null,
          it.existing ? h('div', { class: 'known', text: 'jo chatissa: ' + (S.chats[it.existing] ? S.chats[it.existing].name : '') + ' – viestit lisätään siihen' }) : null,
          h('div', { class: 'dr-subj', text: it.g.subjects.slice(0, 2).join(' · ') })));
      (it.work ? list : others).append(row);
      return row;
    });
    const toggle = h('button', { class: 'btn block', type: 'button', id: 'dr-others-toggle', 'aria-expanded': 'false', hidden: !nOther, text: 'Muut keskustelut (' + nOther + ')',
      onclick: () => { others.hidden = !others.hidden; toggle.setAttribute('aria-expanded', String(!others.hidden)); } });
    function upd() {
      const nNew = items.filter(x => x.checked && !x.existing).length, nEx = items.filter(x => x.checked && x.existing).length;
      go.textContent = nNew ? 'Luo ' + nNew + (nNew === 1 ? ' keskustelu' : ' keskustelua') + ' ja hae viestit' : nEx ? 'Hae viestit ' + nEx + (nEx === 1 ? ' keskusteluun' : ' keskusteluun') : 'Ei valittuja';
      go.disabled = !nNew && !nEx;
    }
    go.onclick = () => {
      const chosen = items.filter(x => x.checked).map(x => {
        const members = x.g.addresses.map(a => ({ name: a.name || nameFromAddress(a.email), email: a.email }));
        if (x.existing) return { kind: 'add', chatId: x.existing, members };
        const nm = (x.name || '').trim() || groupCompany(x.g) || members[0].name;
        return { kind: 'new', name: nm, company: x.g.domain ? nm : '', members };
      });
      finished = true; api.close();
      importDiscovered(chosen);
    };
    body.append(
      h('p', { class: 'hint', id: 'dr-note', style: 'margin-bottom:10px', text: 'Luokittelu tehtiin aiheiden perusteella (sääntöpohjainen)' }),
      nWork ? list : h('p', { class: 'hint', text: 'Työpaikkoja ei tunnistettu automaattisesti. Voit valita keskusteluja alta.' }),
      toggle, others, h('div', { class: 'dr-foot' }, go));
    upd();
  }, { onClose: () => { DISC.reviewOpen = false; if (!finished) { DISC.busy = false; GM.busy = false; } } });
}

// 5. Luo chatit ja hae viestit (sama gmailSyncChat kuin yksittäisessä haussa)
async function importDiscovered(chosen) {
  try {
    const r = await applyEmailGroups(chosen, 'haettu', 'Luodaan keskusteluja');
    if (!r.ok) return;
    const ctl = openSyncSheet('Haetaan viestejä');
    let added = 0;
    try {
      for (let i = 0; i < r.touched.length && !ctl.cancelled; i++) {
        const res = await gmailSyncChat(r.touched[i], ctl, 'Keskustelu ' + (i + 1) + '/' + r.touched.length);
        added += res.added;
      }
      ctl.close();
    } catch (e) { ctl.close(); showGmailErrorSheet(e, null); }
    S.sum.sig = '';
    const nc = r.created.length;
    toast((ctl.cancelled ? 'Haku keskeytettiin: ' : '') + '+' + nc + (nc === 1 ? ' keskustelu' : ' keskustelua') + ', +' + added + (added === 1 ? ' viesti' : ' viestiä'));
    if (S.openId) closeChat('chats'); else showView('chats');
  } finally { DISC.busy = false; GM.busy = false; }
}
