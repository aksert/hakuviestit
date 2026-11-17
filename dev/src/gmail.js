//#GMAIL-START
/* ===== Gmail: puhtaat apufunktiot ===== */
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.fi', 'outlook.com', 'outlook.fi', 'live.com', 'live.fi', 'msn.com',
  'yahoo.com', 'yahoo.fi', 'ymail.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com',
  'suomi24.fi', 'luukku.com', 'kolumbus.fi', 'pp.inet.fi', 'welho.com', 'elisanet.fi', 'saunalahti.fi', 'dnainternet.net'
]);
// Työpaikkahakupalvelut: niiden ilmoitusuutiskirjeet eivät ole työnantajakeskusteluja (pois kyselystä B ja aina "muut")
const JOB_BOARDS = new Set(['duunitori.fi', 'linkedin.com', 'jobly.fi', 'monster.fi', 'monster.com', 'indeed.com', 'indeedemail.com', 'oikotie.fi', 'glassdoor.com', 'tyomarkkinatori.fi', 'te-palvelut.fi', 'mol.fi', 'jobindex.dk', 'stepstone.fi']);
// Rekrytointijärjestelmät (ATS): lähettävät oikeita hakemuskuittauksia -> työhön liittyviä, yritys nimestä eikä domainista
const ATS_DOMAINS = new Set(['kuntarekry.fi', 'varbi.com', 'teamtailor.com', 'reachmee.com', 'smartrecruiters.com', 'myworkday.com', 'workday.com', 'lyyti.fi',
  'teamtailor-mail.com', 'jobylon.com', 'recruitee.com', 'greenhouse.io', 'lever.co', 'workable.com', 'workablemail.com', 'hr-manager.net', 'valtiolle.fi', 'personio.com', 'personio.de']);
// Rekrytointijärjestelmän näyttönimestä työnantaja: "Kuntarekry / Kaupunki", "Etunimi Sukunimi - Yritys Oy" -> viimeinen osa
const atsCompanyOf = name => { const p = String(name || '').split(/\s*[\/|]\s*|\s+[-–]\s+/).map(x => x.trim()).filter(Boolean); return p.length ? p[p.length - 1] : ''; };
const domainIn = (set, dom) => { dom = String(dom || '').toLowerCase(); for (const d of set) if (dom === d || dom.endsWith('.' + d)) return true; return false; };
const emailDomain = e => { const s = String(e || ''); const i = s.lastIndexOf('@'); return i < 0 ? '' : s.slice(i + 1).toLowerCase(); };
// Gmail-hakulauseke chatin jäsenille: jokaiselle osoitteelle from/to/cc, ei-ilmaisille domaineille lisäksi from/to domain.
function gmailQueryForChat(chat) {
  const emails = [...new Set(((chat && chat.members) || []).flatMap(m => m.emails || []).map(normEmail).filter(isEmail))];
  if (!emails.length) return '';
  const terms = [];
  const co = String((chat && chat.company) || '').replace(/["\\]/g, '').trim();
  // ATS-lähettäjän osoite on yhteinen usealle työnantajalle: rajataan yrityksen nimellä, eikä domainia hae kokonaan
  emails.forEach(e => { if (co && domainIn(ATS_DOMAINS, emailDomain(e))) terms.push('(from:' + e + ' "' + co + '")'); else terms.push('from:' + e, 'to:' + e, 'cc:' + e); });
  [...new Set(emails.map(emailDomain).filter(d => d && !FREE_MAIL.has(d) && !domainIn(JOB_BOARDS, d) && !domainIn(ATS_DOMAINS, d)))].forEach(d => terms.push('from:' + d, 'to:' + d));
  return '(' + terms.join(' OR ') + ') -in:chats';
}
// Leikkaa lainatun historian pois. Jos tulos jää tyhjäksi, palautetaan alkuperäinen teksti.
function stripQuotedMail(text, cap) {
  cap = cap || 20000;
  const orig = String(text == null ? '' : text).replace(/\r\n?/g, '\n').trim();
  const lines = orig.split('\n');
  let cut = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim(), nx = (lines[i + 1] || '').trim();
    const pv = i === 0 ? '' : lines[i - 1].trim();
    const prevSep = i === 0 || !pv || /^_{5,}$/.test(pv) || /^-{3,}$/.test(pv);
    const hit =
      /^_{8,}\s*$/.test(l) ||
      /^-{2,}\s*(Original Message|Alkuperäinen viesti)/i.test(l) ||
      (/^(Lähettäjä|From):\s/.test(l) && prevSep) ||
      /^On .+wrote:\s*$/i.test(l) ||
      (/^On /i.test(l) && !/wrote:\s*$/i.test(l) && /wrote:\s*$/i.test(nx)) ||
      (/^.+ kirjoitti:?\s*$/.test(l) && /[\d@]/.test(l)) ||
      (/^(ma|ti|ke|to|pe|la|su)\b/i.test(l) && !/kirjoitti:?\s*$/.test(l) && /kirjoitti:?\s*$/.test(nx) && /[\d@]/.test(l + nx));
    if (hit && lines.slice(0, i).some(x => x.trim() && !/^\s*>/.test(x))) { cut = i; break; }
  }
  const kept = lines.slice(0, cut).filter(l => !/^\s*\[undefined\]\s*$/.test(l));
  while (kept.length && (!kept[kept.length - 1].trim() || /^\s*>/.test(kept[kept.length - 1]))) kept.pop();
  let out = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!out) out = orig;
  return out.length > cap ? out.slice(0, cap) : out;
}
const gmailDocId = id => 'gm-' + String(id).replace(/[^A-Za-z0-9_-]/g, '_');
// Gmailin viesti -> sovelluksen viesti. myAddrs: omat sähköpostiosoitteet (Set tai taulukko, pienellä).
// `at` on ISO-merkkijono (sovelluksen tietomalli), `to` taulukko. Palauttaa null jos aikaa ei voi päätellä.
function gmailMsgToAppMsg(m, myAddrs) {
  if (!m || !m.id) return null;
  const mine = (myAddrs && typeof myAddrs.has === 'function') ? myAddrs : new Set((myAddrs || []).map(a => String(a).toLowerCase()));
  const sender = normEmail(m.sender || '');
  const ms = Number(m.internalDate) || Date.parse(m.date);
  if (!isFinite(ms)) return null;
  const dn = (m.addressDisplayNames || []).find(x => normEmail(x.emailAddress) === sender);
  const to = [...new Set([].concat(m.toRecipients || [], m.ccRecipients || []).map(normEmail).filter(Boolean))];
  return {
    id: gmailDocId(m.id), at: new Date(ms).toISOString(),
    dir: ((m.labelIds || []).includes('SENT') || mine.has(sender)) ? 'out' : 'in',
    channel: 'email', from: sender, fromName: (dn && dn.displayName) || '', to,
    subject: String(m.subject || ''), body: stripQuotedMail(m.plaintextBody || m.snippet || ''),
    source: 'gmail', gmail: { messageId: String(m.id), threadId: String(m.threadId || '') },
    attachments: (m.attachments || []).map(a => a && a.filename).filter(Boolean).slice(0, 10)
  };
}
// Virhekoodi -> käyttäjälle näytettävä teksti ja toimintovihjeet
function gmailErrorInfo(err) {
  const code = String((err && err.code) || '');
  const perms = 'Gmail-lupa puuttuu tältä sivulta.';
  const base = { code, openPerms: false, retry: false, unavailable: false, uncertain: false };
  if (['not_granted', 'capability_disabled', 'capability_removed'].includes(code)) return Object.assign(base, { kind: 'unavailable', unavailable: true, text: 'Gmail-yhteys ei ole käytettävissä tässä näkymässä.' });
  if (code === 'needs_reauth') return Object.assign(base, { kind: code, text: 'Gmail-yhteys vanhentui. Yhdistä Gmail uudelleen: claude.ai → Asetukset → Yhdistäjät.' });
  if (code === 'server_not_connected') return Object.assign(base, { kind: code, text: 'Gmail ei ole yhdistetty. Lisää se: claude.ai → Asetukset → Yhdistäjät.' });
  if (code === 'selection_required') return Object.assign(base, { kind: code, text: 'Valitse käytettävä Gmail-tili claude.ai:n kehotteesta.' });
  if (code === 'not_in_manifest') return Object.assign(base, { kind: code, text: perms, openPerms: true });
  if (code === 'approval_required') return Object.assign(base, { kind: code, text: perms, openPerms: true, retry: true });
  if (code === 'blocked_by_policy') return Object.assign(base, { kind: code, text: 'Organisaation asetukset estävät tämän.' });
  if (code === 'tool_error') return Object.assign(base, { kind: code, text: String((err && err.message) || 'Gmail-työkalu palautti virheen.') });
  const uncertain = ['server_unavailable', 'upstream_error', 'cancelled'].includes(code);
  return Object.assign(base, { kind: uncertain ? 'uncertain' : 'default', uncertain, text: 'Gmail-virhe: ' + (code || 'tuntematon') });
}
const SEND_UNCERTAIN_TEXT = 'Lähetyksen tila epävarma – tarkista Gmailin Lähetetyt ennen kuin yrität uudelleen.';
// "Re: Re: VS: Aihe" -> "Re: Aihe"
const replySubject = s => { const base = String(s || '').replace(/^\s*((re|vs|sv|fw|fwd|vl)\s*:\s*)+/i, '').trim(); return base ? 'Re: ' + base : ''; };
/* ===== Työpaikkakeskustelujen etsintä ===== */
const AUTOMATION_RE = /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce)/i;
const isAutomationAddr = a => AUTOMATION_RE.test(String(a || '').split('@')[0]);
const JOB_WORDS = 'hakemus|hakemuksesi|hakemuksen|työpaikka|työhakemus|haastattelu|haastatteluun|rekrytointi|rekry|sijainen|sijaisuus|työvuoro|työsopimus|palkka|työtarjous|application|interview|recruitment|position|vacancy|job offer';
const JOB_KW_RE = new RegExp(JOB_WORDS + '|hakemuks|hakenut|haastattel|rekrytoi|työpaik|sijaisu', 'i');
const SHOP_RE = /verkkokauppa|tilaus|\border\b|kuitti|receipt|lasku|invoice|uutiskirje|newsletter|tarjous(?!kirje)|alennus|kampanja|pankki|\bbank\b|tracking|seuranta|paketti|toimitus/i;
const periodTerm = p => ({ '6m': 'newer_than:6m', '1y': 'newer_than:1y', '2y': 'newer_than:2y' }[p] || '');
// Kysely A: keskustelut joihin olet osallistunut. Kysely B: työnantajien viestit joihin et vastannut (esim. hakemuskuittaukset).
function discoveryQueries(period) {
  const pt = periodTerm(period);
  const words = JOB_WORDS.split('|').map(w => w.includes(' ') ? '"' + w + '"' : w).join(' OR ');
  return {
    A: ['in:sent', '-in:chats', pt].filter(Boolean).join(' '),
    B: ['-in:sent', '-in:chats', 'category:primary', pt, '(' + words + ')'].concat([...JOB_BOARDS].map(d => '-from:' + d)).filter(Boolean).join(' ')
  };
}
// Yhdistetty Gmail-tili: SENT-viestin lähettäjä
function connectedAccountFromThreads(threads) {
  for (const th of threads || []) for (const m of th.messages || []) if ((m.labelIds || []).includes('SENT') && m.sender) return normEmail(m.sender);
  return '';
}
// Vastapuolet ketjuista (vain metadata): ryhmittely domainin (ei-ilmaiset) tai osoitteen (ilmaiset) mukaan.
function discoverCounterparts(threads, ownSet) {
  const own = ownSet && typeof ownSet.has === 'function' ? ownSet : new Set((ownSet || []).map(a => String(a).toLowerCase()));
  const groups = new Map();
  for (const th of threads || []) {
    const msgs = th.messages || [];
    if (!msgs.length) continue;
    let last = -Infinity, sent = 0, subj = '', subjT = -Infinity;
    const addrs = new Map();
    for (const m of msgs) {
      const t = Number(m.internalDate) || Date.parse(m.date);
      if (isFinite(t) && t > last) last = t;
      const sender = normEmail(m.sender || '');
      if ((m.labelIds || []).includes('SENT') || own.has(sender)) sent++;
      if (m.subject && (isFinite(t) ? t : 0) >= subjT) { subj = m.subject; subjT = isFinite(t) ? t : 0; }
      const dn = new Map((m.addressDisplayNames || []).map(x => [normEmail(x.emailAddress), x.displayName]));
      [sender].concat(m.toRecipients || [], m.ccRecipients || []).map(normEmail).filter(a => a && isEmail(a) && !own.has(a)).forEach(a => {
        if (!addrs.has(a) || (!addrs.get(a) && dn.get(a))) addrs.set(a, dn.get(a) || addrs.get(a) || '');
      });
    }
    const seen = new Set();
    for (const [a, name] of addrs) {
      const dom = emailDomain(a), free = FREE_MAIL.has(dom), isAts = domainIn(ATS_DOMAINS, dom), isBoard = domainIn(JOB_BOARDS, dom);
      // ATS: yksi ryhmä per työnantaja (näyttönimen yritysosa), jotta saman yrityksen eri rekrytoijat yhdistyvät
      const key = free ? a : isAts ? 'ats:' + (atsCompanyOf(name).toLowerCase() || a) : dom;
      let g = groups.get(key);
      if (!g) { g = { key, domain: free ? '' : dom, free, ats: isAts, jobBoard: isBoard, addrMap: new Map(), threadIds: new Set(), lastMs: -Infinity, subs: new Map(), sentByMe: 0, count: 0 }; groups.set(key, g); }
      if (!g.addrMap.has(a) || (!g.addrMap.get(a) && name)) g.addrMap.set(a, name || g.addrMap.get(a) || '');
      if (seen.has(key)) continue;
      seen.add(key);
      g.threadIds.add(th.id); g.count++;
      if (sent > 0) g.sentByMe++;
      if (isFinite(last) && last > g.lastMs) g.lastMs = last;
      if (subj) g.subs.set(subj, Math.max(g.subs.get(subj) || 0, isFinite(last) ? last : 0));
    }
  }
  const out = [];
  for (const g of groups.values()) {
    const all = [...g.addrMap.entries()].map(([email, name]) => ({ email, name }));
    const members = all.filter(x => !isAutomationAddr(x.email));
    if (!members.length && g.free) continue;                 // pelkkä ilmaisen postin automaatio ei kerro työnantajasta
    const grp = {
      key: g.key, domain: g.domain, free: g.free, ats: g.ats, jobBoard: g.jobBoard, addresses: members.length ? members : all, automationOnly: !members.length,
      threadIds: [...g.threadIds], count: g.count, sentByMe: g.sentByMe,
      lastAt: isFinite(g.lastMs) ? new Date(g.lastMs).toISOString() : null,
      subjects: [...g.subs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0])
    };
    grp.newsletterLike = isNewsletterLike(grp);
    out.push(grp);
  }
  return out.sort((a, b) => (Date.parse(b.lastAt) || 0) - (Date.parse(a.lastAt) || 0));
}
// Sääntöpohjainen työpaikkapisteytys (>= 2 = työpaikka)
// Uutiskirjemäinen: kaikki osoitteet automaatiota/tiedotteita, et ole koskaan vastannut, ja vähintään 5 ketjua
const NEWSLETTER_LOCAL_RE = /^(info|news|newsletter|uutiskirje|marketing|markkinointi|vahti|alerts?|notifications?|noreply)/i;
function isNewsletterLike(g) {
  const addrs = g.addresses || [];
  if (g.ats || g.jobBoard || !addrs.length || (g.sentByMe || 0) > 0 || (g.count || 0) < 5) return false;
  return addrs.every(a => isAutomationAddr(a.email) || NEWSLETTER_LOCAL_RE.test(String(a.email).split('@')[0]));
}
function workScore(g) {
  if (g.jobBoard) return -10;   // työpaikkahakupalvelut eivät ole työnantajia
  if (g.ats) return 3;          // rekrytointijärjestelmän kuittaukset ovat työhön liittyviä
  const subs = (g.subjects || []).join(' ');
  let s = 0;
  if (JOB_KW_RE.test(subs)) s += 2;
  if (g.domain) s += 1;
  if (g.sentByMe > 0) s += 1;
  if (SHOP_RE.test(subs + ' ' + (g.domain || ''))) s -= 3;
  if (g.newsletterLike !== undefined ? g.newsletterLike : isNewsletterLike(g)) s -= 4;
  return s;
}
const isWorkGroup = g => !g.jobBoard && workScore(g) >= 2;
function groupCompany(g) {
  if (g.ats) {   // "Kuntarekry / Esimerkkikaupunki" -> "Esimerkkikaupunki"
    return atsCompanyOf((g.addresses || []).map(a => a.name).find(Boolean) || '');
  }
  return groupCompany0(g);
}
const groupCompany0 = g => g.domain ? companyFromEmail('x@' + g.domain) : ((g.addresses[0] && (g.addresses[0].name || nameFromAddress(g.addresses[0].email))) || '');
// Onko ryhmä jo jonkin chatin jäsen (osoite) tai saman domainin/yrityksen chat?
function matchExistingChat(g, chats) {
  if (g.ats) {   // jaettu lähettäjäosoite: täsmää vain yrityksen nimellä
    const co = groupCompany(g).toLowerCase();
    if (!co) return null;
    for (const id of Object.keys(chats)) if (String(chats[id].company || chats[id].name || '').toLowerCase() === co) return id;
    return null;
  }
  const idx = buildAddrIndex(chats);
  for (const a of g.addresses) { const id = idx.get('e:' + normEmail(a.email)); if (id) return id; }
  if (!g.domain || g.jobBoard) return null;
  const co = companyFromEmail('x@' + g.domain).toLowerCase();
  for (const id of Object.keys(chats)) {
    const c = chats[id];
    if (co && c.company && c.company.toLowerCase() === co) return id;
    if ((c.members || []).some(m => (m.emails || []).some(x => emailDomain(normEmail(x)) === g.domain))) return id;
  }
  return null;
}
// Lähetyksen varmistus: löytyykö juuri lähetetty viesti Gmailin hakutuloksista (search_threads, THREAD_VIEW_MINIMAL)?
const NOT_SENT_DEFINITE = ['not_granted', 'capability_disabled', 'capability_removed', 'needs_reauth', 'server_not_connected', 'selection_required', 'not_in_manifest', 'approval_required', 'blocked_by_policy', 'bad_request', 'tool_error'];
const sentNorm = s => String(s || '').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&nbsp;/gi, ' ').replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ').trim().toLowerCase();
const sentAddrs = list => [].concat(list || []).flatMap(x => String(x || '').match(/[^\s<>"',;()]+@[^\s<>"',;()]+/g) || []).map(a => a.toLowerCase());
function findSentMatch(threads, q) {
  const to = String((q && q.to) || '').toLowerCase().trim(), since = Number(q && q.sinceMs) || 0;
  const nb = sentNorm(q && q.body).slice(0, 40), shortBody = sentNorm(q && q.body).length < 20;
  const subjKey = String((q && q.subject) || '').replace(/^\s*((re|vs|sv|fw|fwd|vl)\s*:\s*)+/i, '').trim().toLowerCase();
  for (const th of threads || []) for (const m of (th && th.messages) || []) {
    if (!m || !m.id) continue;
    if (m.labelIds && !m.labelIds.includes('SENT')) continue;
    if (!sentAddrs(m.toRecipients).includes(to)) continue;
    const t = Number(m.internalDate) || Date.parse(m.date);
    if (!isFinite(t) || t < since - 120000) continue;
    const sn = sentNorm(m.snippet);
    const bodyHit = !!nb && !!sn && (sn.includes(nb) || (sn.length >= 10 && nb.startsWith(sn)));
    const subjHit = shortBody && !!subjKey && String(m.subject || '').replace(/^\s*((re|vs|sv|fw|fwd|vl)\s*:\s*)+/i, '').trim().toLowerCase() === subjKey;
    if (bodyHit || subjHit) return { id: String(m.id), threadId: String(m.threadId || th.id || '') };
  }
  return null;
}
function mailtoHref(to, subject, body) {
  const enc = s => encodeURIComponent(String(s || '').replace(/\r?\n/g, '\r\n'));
  return 'mailto:' + encodeURIComponent(String(to || '')).replace(/%40/g, '@') + '?subject=' + enc(subject) + '&body=' + enc(body);
}
function gmailComposeUrl(to, subject, body) {
  const enc = x => encodeURIComponent(String(x || ''));
  return 'https://mail.google.com/mail/?view=cm&fs=1&to=' + enc(to) + '&su=' + enc(subject) + '&body=' + enc(body);
}
// Sähköpostiin avattu viesti (pending) vs. Gmailista haetut viestit (sovellusmuoto: at, dir, body, subject, snippet)
function matchPending(pending, gmailMsgs) {
  const since = Date.parse(pending && pending.at), pb = sentNorm(pending && pending.body);
  const nb = pb.slice(0, 40), shortBody = pb.length < 20;
  const strip = x => String(x || '').replace(/^s*((re|vs|sv|fw|fwd|vl)s*:s*)+/i, '').trim().toLowerCase();
  const subjKey = strip(pending && pending.subject);
  for (const m of gmailMsgs || []) {
    if (!m || m.dir !== 'out') continue;
    const t = Date.parse(m.at);
    if (!isFinite(t) || (isFinite(since) && t < since - 120000)) continue;
    const hay = sentNorm(m.body || m.snippet);
    const bodyHit = !!nb && !!hay && hay.includes(nb);
    const subjHit = shortBody && !!subjKey && strip(m.subject) === subjKey;
    if (bodyHit || subjHit) return m;
  }
  return null;
}
/* ===== Lähetysdiagnostiikka (selväkielinen diag/send-dokumentti kehittäjälle) =====
   Tallennetaan ei koskaan viestin sisältöä, aihetta tai vastaanottajia: kaikki sähköpostiosoitteet muutetaan muotoon <email>. */
function redactDiag(str, max, secrets) {
  let s = String(str == null ? '' : str);
  for (const sec of (secrets || [])) {
    const t = String(sec == null ? '' : sec);
    if (t.length < 5) continue;
    for (const v of new Set([t, JSON.stringify(t).slice(1, -1)])) if (v) s = s.split(v).join('<removed>');
  }
  s = s.replace(/[^\s<>"'(),;:\\/]+(?:@|%40|\\u0040)[^\s<>"'(),;\\/]+/gi, '<email>').replace(/@|%40|\\u0040/gi, '(at)');
  return s.slice(0, Math.max(0, max == null ? 400 : max));
}
const DIAG_DROP_KEYS = new Set(['body', 'htmlBody', 'plaintextBody', 'subject', 'snippet', 'to', 'cc', 'bcc', 'toRecipients', 'ccRecipients', 'bccRecipients', 'sender', 'from', 'attachments']);
function diagResultText(result, max, secrets) {
  let t = '';
  try { t = result === undefined ? '' : JSON.stringify(result, (k, v) => (DIAG_DROP_KEYS.has(k) ? '<removed>' : v)) || ''; } catch (e) { t = ''; }
  return redactDiag(t, max == null ? 600 : max, secrets);
}
// o: {attempt: 'reply'|'send_message'|'verify', tool, err, at, ua, standalone, secrets: [viestin teksti, aihe]}
function buildSendDiag(o) {
  const e = (o && o.err) || {}, sec = (o && o.secrets) || [];
  const ra = Number(e.retryAfterMs);
  return {
    at: (o && o.at) || '', tool: redactDiag(o && o.tool, 60), code: redactDiag(e.code, 60, sec),
    message: redactDiag(e.message, 400, sec), retryable: !!e.retryable, retryAfterMs: isFinite(ra) && e.retryAfterMs != null ? ra : null,
    resultText: diagResultText(e.result, 600, sec), ua: redactDiag(o && o.ua, 120), standalone: !!(o && o.standalone), attempt: redactDiag(o && o.attempt, 20)
  };
}
//#GMAIL-END
