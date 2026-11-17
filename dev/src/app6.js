/* ===== Lisää keskustelut sähköpostiosoitteilla ===== */
function addTabs(active, api) {
  return h('div', { class: 'seg tabs2', role: 'group', 'aria-label': 'Tapa lisätä' },
    h('button', { type: 'button', id: 'tab-new', text: 'Uusi keskustelu', 'aria-pressed': String(active === 'new'), onclick: () => { if (active === 'new') return; api.close(); openNewChatSheet(); } }),
    h('button', { type: 'button', id: 'tab-email', text: 'Lisää sähköpostilla', 'aria-pressed': String(active === 'email'), onclick: () => { if (active === 'email') return; api.close(); openAddByEmailSheet(); } }));
}
function openAddByEmailSheet() {
  openSheet('Lisää sähköpostilla', (body, api) => {
    const ta = h('textarea', { id: 'ae-text', rows: '4', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
      placeholder: 'Liitä yksi tai useampi osoite. Erottimena käy pilkku, puolipiste, väli tai rivinvaihto, esim. Mikko Laine <mikko@valio.fi>' });
    const modeCo = h('input', { id: 'ae-mode-company', type: 'radio', name: 'ae-mode', value: 'company', checked: true });
    const modePe = h('input', { id: 'ae-mode-person', type: 'radio', name: 'ae-mode', value: 'person' });
    const status = statusSelect('ae-status', 'haettu');
    const prev = h('div', { id: 'ae-preview', 'aria-live': 'polite' });
    const go = h('button', { class: 'btn primary block', type: 'button', id: 'ae-go', text: 'Lisää keskustelut', disabled: true });
    const choices = {};
    let plan = null;
    const mode = () => (modePe.checked ? 'person' : 'company');
    function render() {
      const entries = parseAddressList(ta.value);
      plan = planEmailChats(entries, mode(), S.chats, choices);
      prev.replaceChildren();
      if (!entries.length) { prev.append(h('p', { class: 'hint', text: 'Osoitteet näkyvät tässä, kun liität ne yllä olevaan kenttään.' })); }
      plan.rows.forEach((r, i) => {
        const en = r.entry;
        if (r.state === 'invalid') {
          prev.append(h('div', { class: 'ae-row bad', id: 'ae-row-' + i },
            h('div', { class: 'ae-main' }, h('div', { class: 'ad mono', text: en.raw || en.email }), h('div', { class: 'ae-err', text: en.error }))));
          return;
        }
        const side = r.state === 'known'
          ? h('div', { class: 'ae-side hint', text: 'Jo keskustelussa ' + r.chatName + ' – ohitetaan' })
          : r.domainChatId
            ? (() => {
              const sel = h('select', { id: 'ae-ch-' + i, 'aria-label': 'Mihin ' + en.name + ' lisätään', onchange: e => { choices[en.email] = e.target.value; render(); } },
                h('option', { value: 'addto', text: 'Lisää henkilö keskusteluun ' + r.domainChatName, selected: r.choice === 'addto' }),
                h('option', { value: 'new', text: 'Luo uusi keskustelu', selected: r.choice === 'new' }));
              return h('div', { class: 'ae-side' }, sel);
            })()
            : h('div', { class: 'ae-side hint', text: 'Uusi keskustelu: ' + r.groupName });
        prev.append(h('div', { class: 'ae-row' + (r.state === 'known' ? ' skip' : ''), id: 'ae-row-' + i },
          avatar(en.name, 32),
          h('div', { class: 'ae-main' }, h('div', { class: 'nm', text: en.name }), h('div', { class: 'ad mono', text: en.email }), en.company ? h('div', { class: 'co', text: en.company }) : null),
          side));
      });
      const n = plan.newChats, a = plan.added;
      go.textContent = n > 0 ? (n === 1 ? 'Lisää 1 keskustelu' : 'Lisää ' + n + ' keskustelua') + (a ? ' ja ' + a + (a === 1 ? ' henkilö' : ' henkilöä') : '')
        : a > 0 ? 'Lisää ' + a + (a === 1 ? ' henkilö' : ' henkilöä') + ' keskusteluun' : 'Lisää keskustelut';
      go.disabled = n === 0 && a === 0;
      if (entries.length) {
        const ok = plan.rows.filter(r => r.state === 'ok').length;
        prev.prepend(h('p', { class: 'hint', id: 'ae-summary', style: 'margin-bottom:8px', text: ok + ' uutta osoitetta' + (plan.known ? ' · ' + plan.known + ' jo keskustelussa' : '') + (plan.invalid ? ' · ' + plan.invalid + ' virheellistä (ei lisätä)' : '') }));
      }
    }
    ta.addEventListener('input', render);
    modeCo.addEventListener('change', render); modePe.addEventListener('change', render);
    go.onclick = async () => {
      if (!plan || go.disabled) return;
      go.disabled = true;
      const r = await runEmailAdd(plan, status.value);
      if (r) api.close();
      else go.disabled = false;
    };
    body.append(addTabs('email', api),
      field('ae-text', 'Sähköpostiosoitteet', ta, 'Voit liittää myös kopioidun sähköpostin To- tai Cc-rivin.'),
      h('div', { class: 'field', role: 'radiogroup', 'aria-label': 'Keskustelujen jako' },
        h('span', { class: 'lbl', text: 'Keskustelujen jako' }),
        h('label', { class: 'check', for: 'ae-mode-company' }, modeCo, h('span', { text: 'Yksi keskustelu per yritys (domain)' })),
        h('label', { class: 'check', for: 'ae-mode-person' }, modePe, h('span', { text: 'Yksi keskustelu per henkilö' }))),
      field('ae-status', 'Tila kaikille', status),
      prev, go);
    render();
  });
}
// Luo keskustelut ja lisää henkilöt; siirtää lopuksi lajittelemattomista osuvat viestit
// Luo chatit ja lisää jäsenet ryhmistä ({kind:'new'|'add', name, company, members:[{name,email}], chatId?}).
// Palauttaa {ok, created, touched} (touched = kaikki käsitellyt chat-id:t). Ei toasteja eikä lajittelemattomien siirtoa.
async function applyEmailGroups(groups, statusVal, title) {
  const now = nowIso(), ops = [], created = [], touched = [];
  for (const g of groups) {
    if (g.kind === 'new') {
      const id = newChatId(), nm = g.name || (g.members[0] && g.members[0].name) || 'Keskustelu';
      const data = {
        name: nm, company: g.company || '', status: statusVal, notes: '', color: 'av' + (fnv32(nm) % 6 + 1),
        members: g.members.map(m => ({ id: uid(), name: m.name, role: '', emails: [m.email], phones: [] })),
        createdAt: now, updatedAt: now, stats: computeStats([])
      };
      ops.push({ t: 'set', path: 'chats/' + id, data });
      created.push({ id, data }); touched.push(id);
    } else {
      const chat = S.chats[g.chatId]; if (!chat) continue;
      const members = clone(chat.members || []);
      g.members.forEach(m => ensureMember(members, { name: m.name, email: m.email, phone: '' }, uid));
      ops.push({ t: 'update', path: 'chats/' + g.chatId, data: { members, updatedAt: now } });
      S.chats = Object.assign({}, S.chats, { [g.chatId]: Object.assign({}, chat, { members }) });
      touched.push(g.chatId);
    }
  }
  if (!ops.length) return { ok: false, created, touched };
  if (!await doWrites(ops, title || 'Lisätään keskusteluja')) return { ok: false, created, touched };
  created.forEach(c => { S.chats = Object.assign({}, S.chats, { [c.id]: c.data }); });
  rebuildIndexes(); renderChatList();
  return { ok: true, created, touched };
}
async function runEmailAdd(plan, statusVal) {
  const r = await applyEmailGroups(plan.groups, statusVal);
  if (!r.ok) return false;
  // Haetaan lajittelemattomista näille osoitteille kuuluvat viestit
  let moved = 0;
  for (const cid of r.touched) {
    const ms = unsortedMatches(cid);
    if (ms.length && await moveUnsortedTo(ms, cid)) moved += ms.length;
  }
  const nNew = r.created.length;
  toast('Lisättiin ' + nNew + (nNew === 1 ? ' keskustelu' : ' keskustelua') + (plan.added ? ' ja ' + plan.added + (plan.added === 1 ? ' henkilö' : ' henkilöä') : '') + ', siirrettiin ' + moved + (moved === 1 ? ' viesti' : ' viestiä'));
  return true;
}
