//#ADDR-START
/* ===== Osoitteiden jäsennys ("Lisää sähköpostilla") ===== */
// "mikko.laine@valio.fi" -> "Mikko Laine", "anna-liisa_virtanen+cv@x.fi" -> "Anna-Liisa Virtanen"
function nameFromAddress(addr) {
  const e = normEmail(addr);
  const at = e.indexOf('@');
  let local = at < 0 ? e : e.slice(0, at);
  local = local.split('+')[0].replace(/\d+$/, '');
  const parts = local.split(/[._]+/).filter(Boolean);
  if (!parts.length) return '';
  const cap = w => w.split('-').map(x => x ? x.charAt(0).toLocaleUpperCase('fi') + x.slice(1) : x).join('-');
  return parts.map(cap).join(' ');
}
function addrError(e) {
  if (!e.includes('@')) return 'Osoitteesta puuttuu @-merkki';
  const parts = e.split('@');
  if (parts.length !== 2) return 'Osoitteessa on useita @-merkkejä';
  if (!parts[0]) return 'Osoitteesta puuttuu osa ennen @-merkkiä';
  if (!parts[1]) return 'Osoitteesta puuttuu verkkotunnus @-merkin jälkeen';
  if (!parts[1].includes('.')) return 'Verkkotunnuksesta puuttuu pääte (esim. .fi)';
  if (!isEmail(e)) return 'Osoitteen muoto ei kelpaa';
  return '';
}
function mkAddrEntry(raw, name, email) {
  const e = normEmail(email);
  const err = addrError(e);
  name = String(name || '').replace(/^["']+|["']+$/g, '').trim();
  if (err) return { raw: String(raw).trim(), email: e, ok: false, error: err };
  return { raw: String(raw).trim(), email: e, ok: true, name: name || nameFromAddress(e), nameGiven: !!name, company: companyFromEmail(e), domain: e.slice(e.indexOf('@') + 1) };
}
// Tunnistaa pilkun, puolipisteen, välilyönnin ja rivinvaihdon erottimina, "Nimi <osoite>" -muodon sekä kopioidun To/Cc-rivin.
// Palauttaa kaikki kohteet järjestyksessä: kelvolliset (ok:true, duplikaatit poistettu) ja virheelliset (ok:false, error).
function parseAddressList(text) {
  const out = [], seen = new Map();
  const push = en => {
    if (en.ok) {
      const prev = seen.get(en.email);
      if (prev) { if (!prev.nameGiven && en.nameGiven) { prev.name = en.name; prev.nameGiven = true; } return; }
      seen.set(en.email, en);
    }
    out.push(en);
  };
  const lines = String(text || '').replace(/\r/g, '\n').split('\n')
    .map(l => l.replace(/^\s*(to|cc|bcc|from|vastaanottaja|kopio|piilokopio|lähettäjä)\s*:\s*/i, ''));
  for (const line of lines) {
    for (const piece0 of splitAddrList(line)) {
      const piece = piece0.replace(/^\s*(to|cc|bcc|from|vastaanottaja|kopio|piilokopio|lähettäjä)\s*:\s*/i, '');
      let rest = piece;
      if (piece.includes('<')) {
        rest = '';
        let last = 0, m;
        const re = /([^<>]*)<([^<>]*)>/g;
        while ((m = re.exec(piece))) {
          let before = m[1];
          // ennen <...>-osaa mahdollisesti olevat paljaat osoitteet (ei lainausmerkeissä) käsitellään omina kohteinaan
          if (before.includes('@') && !/"[^"]*@[^"]*"/.test(before)) {
            before = before.replace(/[^\s"<>,;]+@[^\s"<>,;]+/g, tok => { push(mkAddrEntry(tok, '', tok)); return ' '; });
          }
          push(mkAddrEntry(m[0], before.trim(), m[2]));
          last = re.lastIndex;
        }
        rest = piece.slice(last);
      }
      let pending = [];
      for (const tok of rest.split(/\s+/).filter(Boolean)) {
        const t = tok.replace(/^mailto:/i, '').replace(/^[("'<\[]+|[)"'>\],.;:]+$/g, '');
        if (t.includes('@')) { push(mkAddrEntry(tok, pending.join(' '), t)); pending = []; }
        else pending.push(tok.replace(/^["']+|["']+$/g, ''));
      }
      if (pending.length) out.push({ raw: pending.join(' '), email: '', ok: false, error: 'Ei sähköpostiosoite (puuttuu @-merkki)' });
    }
  }
  return out;
}
// Suunnitelma: mitkä keskustelut luodaan ja mihin lisätään henkilöitä.
// mode: 'company' (yksi keskustelu per domain) | 'person'. choices[email] = 'addto' | 'new' (vain domainin chatin löytyessä).
function planEmailChats(entries, mode, chats, choices) {
  choices = choices || {};
  const idx = buildAddrIndex(chats);
  const rows = [], groups = new Map();
  const domainChat = en => {
    if (!en.company) return null;
    for (const id of Object.keys(chats)) {
      const c = chats[id];
      if (c.company && c.company.toLowerCase() === en.company.toLowerCase()) return id;
      if ((c.members || []).some(m => (m.emails || []).some(x => normEmail(x).endsWith('@' + en.domain)))) return id;
    }
    return null;
  };
  for (const en of entries) {
    if (!en.ok) { rows.push({ entry: en, state: 'invalid' }); continue; }
    const kc = idx.get('e:' + en.email);
    if (kc) { rows.push({ entry: en, state: 'known', chatId: kc, chatName: chats[kc].name }); continue; }
    const dc = domainChat(en);
    const choice = dc ? (choices[en.email] || 'addto') : 'new';
    const row = { entry: en, state: 'ok', domainChatId: dc, domainChatName: dc ? chats[dc].name : '', choice };
    rows.push(row);
    let key, g;
    if (choice === 'addto' && dc) { key = 'add:' + dc; g = groups.get(key) || { kind: 'add', key, chatId: dc, name: chats[dc].name, company: chats[dc].company || '', members: [] }; }
    else if (mode === 'company' && en.company) { key = 'new:' + en.domain; g = groups.get(key) || { kind: 'new', key, name: en.company, company: en.company, members: [] }; }
    else { key = 'new:' + en.email; g = groups.get(key) || { kind: 'new', key, name: en.name, company: en.company, members: [] }; }
    g.members.push({ name: en.name, email: en.email });
    groups.set(key, g); row.groupKey = key; row.groupName = g.name;
  }
  const gl = [...groups.values()];
  return {
    rows, groups: gl,
    newChats: gl.filter(g => g.kind === 'new').length,
    added: gl.filter(g => g.kind === 'add').reduce((n, g) => n + g.members.length, 0),
    known: rows.filter(r => r.state === 'known').length,
    invalid: rows.filter(r => r.state === 'invalid').length
  };
}
//#ADDR-END
