//#PURE-START
/* ===== Vakiot ===== */
const STATUSES = ['haettu', 'haastattelu', 'tarjous', 'odottaa', 'hylatty', 'muu'];
const STATUS_LABEL = { haettu: 'Haettu', haastattelu: 'Haastattelu', tarjous: 'Tarjous', odottaa: 'Odottaa vastausta', hylatty: 'Hylätty', muu: 'Muu' };
const CHANNELS = ['email', 'sms', 'whatsapp', 'call', 'meeting', 'other'];
const CHANNEL_LABEL = { email: 'Sähköposti', sms: 'Tekstiviesti', whatsapp: 'WhatsApp', call: 'Puhelu', meeting: 'Tapaaminen', other: 'Muu' };
const MAX_BODY = 6000;
const MAX_UNSORTED = 400;
const REMIND_DAYS = 7;

/* ===== Hajautus ===== */
function hash64(str) {
  let a = 0x811c9dc5, b = 5381;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    a ^= c; a = Math.imul(a, 16777619) >>> 0;
    b = (Math.imul(b, 33) ^ c) >>> 0;
  }
  b ^= b >>> 16; b = Math.imul(b, 0x85ebca6b) >>> 0; b ^= b >>> 13; b = Math.imul(b, 0xc2b2ae35) >>> 0; b ^= b >>> 16;
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
function fnv32(str) {
  let a = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { a ^= str.charCodeAt(i); a = Math.imul(a, 16777619) >>> 0; }
  return a >>> 0;
}
function msgIdOf(m) {
  const base = m.messageId
    ? 'mid|' + String(m.messageId).trim().toLowerCase()
    : [m.from || '', m.at || '', m.subject || '', String(m.body || '').slice(0, 200)].join('|');
  return 'm' + hash64(base);
}

/* ===== Osoitteiden normalisointi ===== */
function normEmail(s) {
  return String(s || '').trim().replace(/^mailto:/i, '').replace(/^<|>$/g, '').trim().toLowerCase();
}
function isEmail(s) { return /^[^\s@<>"',;()]+@[^\s@<>"',;()]+\.[^\s@<>"',;()]{2,}$/.test(s); }
function normPhone(s) {
  let t = String(s || '').trim().replace(/\(0\)/g, '').replace(/[\s\-().\/ ]/g, '');
  if (t.startsWith('00')) t = '+' + t.slice(2);
  else if (t.startsWith('0')) t = '+358' + t.slice(1);
  else if (/^358\d{8,10}$/.test(t)) t = '+' + t;
  return t;
}
function isPhone(s) { return /^\+\d{7,15}$/.test(s); }
// Avain: e:<email> | p:<puhelin> | n:<nimi>
function addrKey(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.includes('@')) return 'e:' + normEmail(s);
  const p = normPhone(s);
  if (isPhone(p)) return 'p:' + p;
  return 'n:' + s.toLowerCase().replace(/\s+/g, ' ');
}
function companyFromEmail(email) {
  const at = String(email || '').lastIndexOf('@');
  if (at < 0) return '';
  const labels = email.slice(at + 1).toLowerCase().split('.').filter(Boolean);
  const generic = ['gmail', 'googlemail', 'hotmail', 'outlook', 'live', 'yahoo', 'icloud', 'me', 'msn', 'protonmail', 'proton', 'elisa', 'luukku', 'suomi24', 'kolumbus', 'dnainternet', 'saunalahti', 'aol', 'gmx', 'pp'];
  if (labels.length < 2) return '';
  labels.pop();
  while (labels.length > 1 && ['example', 'co', 'com', 'org', 'net', 'gov', 'edu', 'test'].includes(labels[labels.length - 1])) labels.pop();
  const name = labels[labels.length - 1] || '';
  if (!name || generic.includes(name) || name === 'example') return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}
function splitAddrList(s) {
  const out = []; let cur = '', q = false, a = 0;
  for (const ch of String(s || '')) {
    if (ch === '"') q = !q;
    else if (!q && ch === '<') a++;
    else if (!q && ch === '>') a = Math.max(0, a - 1);
    if ((ch === ',' || ch === ';') && !q && !a) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}
function parseAddress(item) {
  let name = '', email = '';
  const m = item.match(/^(.*?)<([^<>]*)>\s*$/);
  if (m) {
    name = m[1].trim().replace(/^"|"$/g, '').replace(/\\(.)/g, '$1').trim();
    email = normEmail(m[2]);
  } else if (item.includes('@')) {
    const cm = item.match(/\(([^)]*)\)/);
    if (cm) name = cm[1].trim();
    email = normEmail(item.replace(/\(.*?\)/g, ''));
  } else name = item.trim();
  if (name && name.includes('@') && !email) { email = normEmail(name); name = ''; }
  if (name.toLowerCase() === email) name = '';
  return { name, email };
}
function parseAddrHeader(v) { return splitAddrList(v).map(parseAddress).filter(a => a.email || a.name); }

/* ===== Tavut, merkistöt ===== */
function bytesFromStr(s) {
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255;
  return u;
}
function bytesToLatin1(u8) {
  let s = ''; const CH = 0x2000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return s;
}
function decodeBytes(u8, charset) {
  let cs = String(charset || '').toLowerCase().replace(/^["']|["']$/g, '').trim();
  if (!cs) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); }
    catch (e) { return new TextDecoder('windows-1252').decode(u8); }
  }
  try { return new TextDecoder(cs).decode(u8); }
  catch (e) { try { return new TextDecoder('utf-8').decode(u8); } catch (e2) { return bytesToLatin1(u8); } }
}
function padB64(s) { s = s.replace(/=+$/, ''); while (s.length % 4) s += '='; return s; }
function qpToBytes(s) {
  return s.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
}
// RFC 2047 encoded-words
function decodeMimeWords(s) {
  if (!s || s.indexOf('=?') < 0) return s;
  const W = '=\\?[^?\\s]+\\?[bBqQ]\\?[^?\\s]*\\?=';
  const runRe = new RegExp(W + '(?:[ \\t]+' + W + ')*', 'g');
  return s.replace(runRe, run => {
    const words = [...run.matchAll(/=\?([^?\s]+)\?([bBqQ])\?([^?\s]*)\?=/g)];
    let out = '', curCs = null, buf = [];
    const flush = () => { if (buf.length) { out += decodeBytes(Uint8Array.from(buf), curCs); buf = []; } };
    for (const w of words) {
      const cs = w[1].split('*')[0].toLowerCase();
      if (cs !== curCs) { flush(); curCs = cs; }
      let bs;
      if (w[2].toLowerCase() === 'b') {
        try { bs = atob(padB64(w[3].replace(/\s/g, ''))); } catch (e) { bs = w[3]; }
      } else bs = qpToBytes(w[3].replace(/_/g, ' '));
      for (let i = 0; i < bs.length; i++) buf.push(bs.charCodeAt(i) & 255);
    }
    flush();
    return out;
  });
}

/* ===== Sähköpostin jäsennys ===== */
function splitHeadBody(raw) {
  const m = raw.match(/\r?\n\r?\n/);
  if (!m) return [raw, ''];
  return [raw.slice(0, m.index), raw.slice(m.index + m[0].length)];
}
function parseHeaderBlock(head) {
  const h = {};
  const unfolded = head.replace(/\r?\n[ \t]+/g, ' ');
  for (const line of unfolded.split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 1) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    if (!(k in h)) h[k] = line.slice(i + 1).trim();
  }
  return h;
}
function fixRawHeaderValue(v) { return /[\x80-\xff]/.test(v) ? decodeBytes(bytesFromStr(v), '') : v; }
function hdr(h, k) { return decodeMimeWords(fixRawHeaderValue(h[k] || '')).trim(); }
function parseCT(v) {
  const parts = String(v || '').split(';');
  const type = (parts.shift() || '').trim().toLowerCase();
  const params = {};
  for (const p of parts) {
    const i = p.indexOf('=');
    if (i < 0) continue;
    const k = p.slice(0, i).trim().toLowerCase();
    let val = p.slice(i + 1).trim();
    if (val[0] === '"') val = val.replace(/^"|"$/g, '');
    params[k] = val;
  }
  return { type, params };
}
function decodeBody(body, cte, charset) {
  cte = String(cte || '7bit').trim().toLowerCase();
  let bs;
  if (cte === 'base64') {
    try { bs = atob(padB64(body.replace(/[^A-Za-z0-9+/]/g, ''))); } catch (e) { bs = body; }
  } else if (cte === 'quoted-printable') bs = qpToBytes(body);
  else bs = body;
  return decodeBytes(bytesFromStr(bs), charset);
}
function splitMultipart(body, boundary) {
  const re = new RegExp('(?:^|\\r?\\n)--' + boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(--)?[ \\t]*(?=\\r?\\n|$)', 'g');
  const parts = []; let last = -1, m;
  while ((m = re.exec(body))) {
    if (last >= 0) parts.push(body.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1]) { last = -1; break; }
  }
  if (last >= 0) parts.push(body.slice(last));
  return parts.map(p => p.replace(/^\r?\n/, ''));
}
function htmlToText(html) {
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('style,script,head,noscript,template').forEach(n => n.remove());
      doc.querySelectorAll('br').forEach(n => n.replaceWith('\n'));
      doc.querySelectorAll('td,th').forEach(n => n.append(' '));
      doc.querySelectorAll('p,h1,h2,h3,h4,h5,h6,blockquote').forEach(n => n.append('\n\n'));
      doc.querySelectorAll('div,li,tr,table,ul,ol,pre,section,article,header,footer').forEach(n => n.append('\n'));
      const root = doc.body || doc.documentElement;
      return (root.textContent || '').replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    } catch (e) { /* fall through */ }
  }
  let t = String(html)
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|blockquote)>/gi, '\n\n')
    .replace(/<\/(div|li|tr|table|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  t = t.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
  return t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function collectParts(raw, acc, depth) {
  if (depth > 8) return;
  const [head, body] = splitHeadBody(raw);
  const h = parseHeaderBlock(head);
  const ct = parseCT(h['content-type'] || 'text/plain');
  if (ct.type.startsWith('multipart/') && ct.params.boundary) {
    for (const p of splitMultipart(body, ct.params.boundary)) collectParts(p, acc, depth + 1);
    return;
  }
  if (/^\s*attachment/i.test(h['content-disposition'] || '')) return;
  if (ct.type === 'text/plain') acc.plain.push(decodeBody(body, h['content-transfer-encoding'], ct.params.charset));
  else if (ct.type === 'text/html') acc.html.push(decodeBody(body, h['content-transfer-encoding'], ct.params.charset));
}
function stripQuoted(text) {
  const lines = text.split('\n');
  let cut = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    const nx = (lines[i + 1] || '').trim();
    const hit =
      /^On .{5,300}wrote:$/i.test(l) ||
      (/^On /i.test(l) && !/wrote:$/i.test(l) && /wrote:$/i.test(nx)) ||
      (/^.{5,300}kirjoitti:$/i.test(l) && /[\d@]/.test(l)) ||
      (/^(ma|ti|ke|to|pe|la|su)\b/i.test(l) && !/kirjoitti:$/i.test(l) && /kirjoitti:$/i.test(nx)) ||
      /^-{2,}\s*(Original Message|Alkuperäinen viesti)\s*-{2,}$/i.test(l) ||
      (/^(From|Lähettäjä):\s.+/i.test(l) && lines.slice(i + 1, i + 5).some(x => /^(Sent|Lähetetty|Date|Päivämäärä):/i.test(x.trim())));
    if (hit) {
      if (lines.slice(0, i).some(x => x.trim() && !x.trim().startsWith('>'))) { cut = i; break; }
    }
  }
  let kept = lines.slice(0, cut).filter(l => !/^\s*>/.test(l));
  let out = kept.join('\n').replace(/\n[ \t]*(_{5,}|-{5,})[ \t]*$/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return out || text.trim();
}
function parseDateHeader(v) {
  if (!v) return null;
  const t = Date.parse(String(v).replace(/\([^)]*\)/g, '').trim());
  return isNaN(t) ? null : new Date(t).toISOString();
}
function parseEml(raw, opts) {
  opts = opts || {};
  raw = String(raw || '').replace(/^﻿/, '');
  const [head] = splitHeadBody(raw);
  const h = parseHeaderBlock(head);
  const from = parseAddrHeader(hdr(h, 'from'))[0] || { name: '', email: '' };
  const toL = parseAddrHeader(hdr(h, 'to')).concat(parseAddrHeader(hdr(h, 'cc')));
  const acc = { plain: [], html: [] };
  collectParts(raw, acc, 0);
  let text = acc.plain.map(s => s.replace(/\r\n?/g, '\n').trim()).filter(Boolean).join('\n\n');
  if (!text && acc.html.length) text = acc.html.map(s => htmlToText(s.replace(/\r\n?/g, '\n'))).filter(Boolean).join('\n\n');
  text = stripQuoted(text.replace(/\r\n?/g, '\n'));
  if (text.length > MAX_BODY) text = text.slice(0, MAX_BODY);
  const mid = (h['message-id'] || '').replace(/[<>\s]/g, '');
  return {
    at: parseDateHeader(hdr(h, 'date')) || opts.fallbackAt || null,
    from: from.email || from.name || '',
    fromName: from.email ? from.name : '',
    to: toL.map(a => a.email || a.name),
    _toNames: toL.map(a => a.name),
    subject: hdr(h, 'subject').replace(/\s+/g, ' '),
    body: text,
    messageId: mid,
    channel: 'email',
    source: opts.source || 'eml'
  };
}

/* ===== mbox-jakaja ===== */
function createMboxSplitter(onMessage) {
  let carry = '', cur = null, curSize = 0, prevBlank = true, curDate = null;
  const SEP = /^From \S+\s+\S.*\d{1,2}:\d{2}/;
  function flush() {
    if (cur && cur.length) onMessage(cur.join('\n'), curDate);
    cur = null; curSize = 0;
  }
  function line(l) {
    const bare = l.replace(/\r$/, '');
    if (prevBlank && SEP.test(bare)) {
      flush();
      cur = []; curSize = 0;
      const d = Date.parse(bare.replace(/^From \S+\s+/, ''));
      curDate = isNaN(d) ? null : new Date(d).toISOString();
    } else {
      if (cur === null) { cur = []; curSize = 0; curDate = null; }
      if (curSize < 8000000) { cur.push(l); curSize += l.length + 1; }
    }
    prevBlank = bare === '';
  }
  return {
    push(str) {
      const parts = (carry + str).split('\n');
      carry = parts.pop();
      for (let i = 0; i < parts.length; i++) line(parts[i]);
    },
    end() { if (carry) { line(carry); carry = ''; } flush(); }
  };
}
function looksLikeMbox(firstText) { return /^From \S+\s+\S.*\d{1,2}:\d{2}/.test(String(firstText || '').replace(/^﻿/, '')); }

/* ===== WhatsApp ===== */
function parseWhatsApp(text) {
  text = String(text || '').replace(/^﻿/, '').replace(/[  ]/g, ' ').replace(/[‎‏‪-‮]/g, '');
  const lines = text.split(/\r?\n/);
  const re = /^\[?(\d{1,2})([./])(\d{1,2})[./](\d{2,4}),?\s+(?:klo\s+)?(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?\]?\s*(?:[-–—]\s*)?(.*)$/;
  const entries = [];
  let cur = null;
  for (const line of lines) {
    const m = re.exec(line);
    if (m && +m[1] <= 31 && +m[3] <= 31) {
      const rest = m[9];
      const sm = /^([^:]{1,100}?):(?:\s(.*))?$/.exec(rest);
      cur = {
        a: +m[1], sep: m[2], b: +m[3], y: +m[4], hh: +m[5], mm: +m[6], ss: m[7] ? +m[7] : 0, ap: m[8] ? m[8].replace(/[^AaPp]/g, '').toLowerCase() : '',
        sender: sm ? sm[1].trim() : null, lines: [sm ? (sm[2] || '') : rest]
      };
      entries.push(cur);
    } else if (cur) cur.lines.push(line);
  }
  let aBig = false, bBig = false, ampm = false, slash = false;
  for (const e of entries) { if (e.a > 12) aBig = true; if (e.b > 12) bBig = true; if (e.ap) ampm = true; if (e.sep === '/') slash = true; }
  const dmy = aBig ? true : bBig ? false : !(slash && ampm);
  const messages = [], counts = {};
  for (const e of entries) {
    if (e.sender === null) continue;
    const day = dmy ? e.a : e.b, mon = dmy ? e.b : e.a;
    let y = e.y < 100 ? 2000 + e.y : e.y, hh = e.hh;
    if (e.ap === 'p' && hh < 12) hh += 12;
    if (e.ap === 'a' && hh === 12) hh = 0;
    if (mon < 1 || mon > 12 || day < 1 || day > 31 || hh > 23 || e.mm > 59) continue;
    const d = new Date(y, mon - 1, day, hh, e.mm, e.ss);
    if (isNaN(d)) continue;
    let body = e.lines.join('\n').replace(/\s+$/, '');
    body = body.replace(/<?(Media jätetty pois|Media omitted|image omitted|video omitted|sticker omitted|audio omitted|GIF omitted|document omitted)>?/gi, '[media]')
      .replace(/<(attached|liitetty): [^>]*>/gi, '[media]');
    if (!body.trim()) continue;
    if (body.length > MAX_BODY) body = body.slice(0, MAX_BODY);
    messages.push({ at: d.toISOString(), fromName: e.sender, body });
    counts[e.sender] = (counts[e.sender] || 0) + 1;
  }
  const names = Object.keys(counts).sort((x, y2) => counts[y2] - counts[x]);
  return { messages, names, counts };
}

/* ===== Viestit ja tilastot ===== */
function previewOf(m) {
  const body = String(m.body || '').replace(/\s+/g, ' ').trim();
  let s = m.subject ? (body ? m.subject + ' – ' + body : m.subject) : body;
  if (!s) s = { call: 'Puhelu', meeting: 'Tapaaminen' }[m.channel] || '(ei tekstiä)';
  return s.slice(0, 140);
}
function computeStats(msgs) {
  let lastAt = null, lastSentAt = null, lastReceivedAt = null, sent = 0, received = 0, last = null;
  let lastT = -Infinity, lsT = -Infinity, lrT = -Infinity;
  for (const m of msgs) {
    const t = Date.parse(m.at);
    if (isNaN(t)) continue;
    if (m.dir === 'out') { sent++; if (t >= lsT) { lsT = t; lastSentAt = m.at; } }
    else { received++; if (t >= lrT) { lrT = t; lastReceivedAt = m.at; } }
    if (t >= lastT) { lastT = t; last = m; lastAt = m.at; }
  }
  return {
    lastAt, lastSentAt, lastReceivedAt, sent, received,
    lastPreview: last ? previewOf(last) : '', lastDir: last ? last.dir : null, lastChannel: last ? last.channel : null
  };
}
function cleanBody(s) { s = String(s == null ? '' : s); return s.length > MAX_BODY ? s.slice(0, MAX_BODY) : s; }
// Siivoaa viestin tallennettavaan muotoon
function toMsgDoc(m, extra) {
  const d = {
    at: m.at, dir: m.dir === 'out' ? 'out' : 'in',
    channel: CHANNELS.includes(m.channel) ? m.channel : 'other',
    from: String(m.from || ''), fromName: String(m.fromName || ''),
    to: Array.isArray(m.to) ? m.to.map(String) : [],
    subject: String(m.subject || ''), body: cleanBody(m.body),
    source: m.source || 'manual', createdAt: m.createdAt || m.at
  };
  if (m.example) d.example = true;
  if (m.pending) d.pending = true;
  if (m.gmail && m.gmail.messageId) d.gmail = { messageId: String(m.gmail.messageId).slice(0, 200), threadId: String(m.gmail.threadId || '').slice(0, 200) };
  if (Array.isArray(m.attachments) && m.attachments.length) d.attachments = m.attachments.map(x => String(x).slice(0, 200)).slice(0, 10);
  return Object.assign(d, extra || {});
}
// Osapuolet viestissä (ei-omat), ensisijainen ensin
function partiesOf(m, ownSet) {
  const list = [], seen = new Set();
  const add = (raw, name) => {
    const key = addrKey(raw);
    if (!key || ownSet.has(key) || seen.has(key)) return;
    seen.add(key);
    const k = key.slice(0, 1);
    list.push({ key, email: k === 'e' ? key.slice(2) : '', phone: k === 'p' ? key.slice(2) : '', name: name || '' });
  };
  const tn = m._toNames || [];
  if (m.dir === 'out') { (m.to || []).forEach((t, i) => add(t, tn[i])); add(m.from, m.fromName); }
  else { add(m.from, m.fromName); (m.to || []).forEach((t, i) => add(t, tn[i])); }
  return list;
}
function partyLabel(p) { return p.name || p.email || p.phone || (p.key ? p.key.slice(2) : ''); }
function buildOwnSet(identities) {
  const s = new Set();
  for (const i of identities || []) {
    if (!i || !i.value) continue;
    if (i.type === 'email') s.add('e:' + normEmail(i.value));
    else if (i.type === 'phone') s.add('p:' + normPhone(i.value));
  }
  return s;
}
function buildAddrIndex(chats) {
  const idx = new Map();
  for (const id of Object.keys(chats || {})) {
    const c = chats[id];
    for (const mem of (c.members || [])) {
      (mem.emails || []).forEach(e => { const k = 'e:' + normEmail(e); if (!idx.has(k)) idx.set(k, id); });
      (mem.phones || []).forEach(p => { const k = 'p:' + normPhone(p); if (!idx.has(k)) idx.set(k, id); });
      if (mem.name) { const k = 'n:' + mem.name.toLowerCase().replace(/\s+/g, ' '); if (!idx.has(k)) idx.set(k, id); }
    }
  }
  return idx;
}
// Lisää osapuolen osoitteet jäseniin (muokkaa annettua taulukkoa)
function ensureMember(members, p, newId) {
  const keys = [];
  if (p.email) keys.push('e:' + p.email);
  if (p.phone) keys.push('p:' + p.phone);
  let mem = members.find(m => (m.emails || []).some(e => keys.includes('e:' + normEmail(e))) || (m.phones || []).some(x => keys.includes('p:' + normPhone(x))));
  if (!mem && p.name) mem = members.find(m => (m.name || '').trim().toLowerCase() === p.name.trim().toLowerCase());
  if (mem) {
    mem.emails = mem.emails || []; mem.phones = mem.phones || [];
    if (p.email && !mem.emails.some(e => normEmail(e) === p.email)) mem.emails.push(p.email);
    if (p.phone && !mem.phones.some(x => normPhone(x) === p.phone)) mem.phones.push(p.phone);
    return members;
  }
  members.push({ id: newId(), name: p.name || p.email || p.phone || '?', role: '', emails: p.email ? [p.email] : [], phones: p.phone ? [p.phone] : [] });
  return members;
}

/* ===== Päivämäärät (fi) ===== */
const WD_SHORT = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
const WD_LONG = ['Sunnuntai', 'Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai'];
const pad2 = n => String(n).padStart(2, '0');
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function dayDiff(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000); }
function weekStart(d) { const s = startOfDay(d); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return s; }
function fmtTime(d) { return pad2(d.getHours()) + '.' + pad2(d.getMinutes()); }
function fmtDM(d, withYear) { return d.getDate() + '.' + (d.getMonth() + 1) + '.' + (withYear ? d.getFullYear() : ''); }
function fmtListDate(iso, now) {
  const d = new Date(iso); if (!iso || isNaN(d)) return '';
  if (dayDiff(d, now) === 0) return fmtTime(d);
  if (weekStart(d).getTime() === weekStart(now).getTime()) return WD_SHORT[d.getDay()];
  return fmtDM(d, d.getFullYear() !== now.getFullYear());
}
function fmtDayLabel(d, now) {
  const n = dayDiff(d, now);
  if (n === 0) return 'Tänään';
  if (n === 1) return 'Eilen';
  return WD_LONG[d.getDay()] + ' ' + fmtDM(d, true);
}
function daysAgo(iso, now) { return dayDiff(new Date(iso), now); }
function relDays(n) { return n <= 0 ? 'tänään' : n + ' pv sitten'; }
function waitDays(stats, now) {
  if (!stats || stats.lastDir !== 'out' || !stats.lastAt) return 0;
  const ms = now - new Date(stats.lastAt);
  return ms > REMIND_DAYS * 86400000 ? Math.floor(ms / 86400000) : 0;
}
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dn = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dn + 3);
  const fy = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t - fy) / 86400000 - 3 + ((fy.getUTCDay() + 6) % 7)) / 7);
}
function weeklyBuckets(times, now, n) {
  const ws = weekStart(now), out = [];
  for (let i = n - 1; i >= 0; i--) {
    const s = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - 7 * i);
    out.push({ start: s, week: isoWeek(s), count: 0 });
  }
  for (const t of times) {
    const d = new Date(t); if (isNaN(d)) continue;
    const idx = Math.floor(dayDiff(out[0].start, d) / 7);
    if (idx >= 0 && idx < n) out[idx].count++;
  }
  return out;
}
function isoLocalInput(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
/* ===== Biometrinen avaus: alustakohtaiset tekstit (puhtaita) ===== */
const bioPlatform = ua => { ua = String(ua || ''); return /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(ua) ? 'ios' : 'other'; };
const bioLabel = ua => ({ ios: 'Face ID', android: 'sormenjälki tai kasvojentunnistus', other: 'biometrinen tunnistus' })[bioPlatform(ua)];
function bioStrings(ua, native) {
  const p = bioPlatform(ua), label = bioLabel(ua), cap = label.charAt(0).toUpperCase() + label.slice(1);
  // native = Capacitor-kuori: ei viitata Safariin tai Koti-valikkoon
  const where = native ? (p === 'ios' ? 'Ota Face ID käyttöön iPhonen asetuksista (Asetukset → Face ID ja pääsykoodi).' : 'Ota laitteen biometrinen tunnistus käyttöön laitteen asetuksista.')
    : p === 'ios' ? 'Toimii Safarissa tai Koti-valikkoon lisätyssä sovelluksessa (iOS 18 tai uudempi): avaa sivu Safarilla ja valitse Jaa → Lisää Koti-valikkoon.'
    : p === 'android' ? 'Toimii Chromessa tai aloitusnäytölle lisätyssä sovelluksessa (Android 9 tai uudempi, Google Play -palvelut).'
      : 'Toimii selaimessa, joka tukee pääsyavaimia ja PRF-laajennusta (esim. Chrome tai Safari).';
  return {
    platform: p, label,
    on: 'Ota ' + label + ' käyttöön', off: 'Poista ' + label + ' käytöstä',
    unlock: p === 'ios' ? 'Avaa Face ID:llä' : 'Avaa biometrisellä tunnistuksella',
    fail: (p === 'ios' ? 'Face ID -avaus' : 'Biometrinen avaus') + ' epäonnistui. Kirjoita salasana.',
    unsupported: cap + ' ei ole käytettävissä' + (native ? '. ' : ' tässä näkymässä. ') + where,
    offerTitle: cap + ' käyttöön?',
    offerText: 'Avaa Hakuviestit jatkossa ' + (p === 'ios' ? 'Face ID:llä' : p === 'android' ? 'sormenjäljellä tai kasvojentunnistuksella' : 'laitteen tunnistuksella') + ' ilman salasanaa. Salasana suojataan laitteen tunnistuksella eikä sitä tallenneta selväkielisenä.',
    enabled: cap + ' otettu käyttöön', disabled: cap + ' poistettu käytöstä',
    resetHint: cap + ' poistettiin käytöstä salasanan vaihdon vuoksi. Ota se uudelleen käyttöön Tietosuoja-osiossa.',
    invalidated: (p === 'ios' ? 'Face ID -avaus' : 'Biometrinen avaus') + ' ei ole enää käytössä. Avaa salasanalla ja ota ' + label + ' uudelleen käyttöön Tietosuoja-osiossa.',
    hint: 'Salasana pysyy tallessa vain laitteen oman tunnistuksen suojaamana. Salasanalla pääsee aina sisään.'
  };
}
/* ===== Suojausvinkit puhelimeen (alustan mukaan) ===== */
const TIPS_IOS = [
  'Laita päälle Varastetun laitteen suojaus: Asetukset → Face ID ja pääsykoodi.',
  'Pidä iOS ajan tasalla: Asetukset → Yleiset → Ohjelmistopäivitys → Automaattiset päivitykset.',
  'Suojaa Google-tili: kaksivaiheinen tunnistus tai pääsyavain osoitteessa myaccount.google.com/security.',
  'Tarkista Google-tilin yhdistetyt sovellukset ja poista tuntemattomat.',
  'iPhone ei tarvitse erillistä virustorjuntasovellusta – lataa sovelluksia vain App Storesta äläkä avaa outoja linkkejä.',
  'Lukitustila (Lockdown Mode) vain, jos epäilet kohdennettua hyökkäystä.'
];
const TIPS_ANDROID = [
  'Laita päälle varkaussuoja: Asetukset → Google → Kaikki palvelut → Varkaussuoja (Theft protection).',
  'Pidä Android ja Google Play -järjestelmäpäivitykset ajan tasalla: Asetukset → Järjestelmä → Ohjelmistopäivitys.',
  'Pidä Play Protect päällä: Play Kauppa → profiilikuva → Play Protect.',
  'Älä asenna sovelluksia Play Kaupan ulkopuolelta (pidä "Tuntemattomat sovellukset" pois päältä).',
  'Suojaa Google-tili: kaksivaiheinen tunnistus tai pääsyavain osoitteessa myaccount.google.com/security.',
  'Kehittyneet suojaukset (Advanced Protection, Android 16) vain, jos epäilet kohdennettua hyökkäystä.',
  'Android ei yleensä tarvitse erillistä virustorjuntasovellusta, kun Play Protect on päällä.'
];
// Palauttaa ryhmät [{title, items}]; tuntemattomalla alustalla molemmat otsikoituina
function secTips(ua) {
  ua = String(ua || '');
  if (/Android/i.test(ua)) return [{ title: '', items: TIPS_ANDROID }];
  if (/iPhone|iPad|iPod/i.test(ua)) return [{ title: '', items: TIPS_IOS }];
  return [{ title: 'iPhone', items: TIPS_IOS }, { title: 'Android', items: TIPS_ANDROID }];
}
/* ===== Avauksen jarrutus: 5 virhettä sallitaan, sitten 30 s, kaksinkertaistuen, enintään 15 min ===== */
function unlockDelayMs(fails) {
  fails = Math.floor(Number(fails) || 0);
  if (fails < 5) return 0;
  return Math.min(30000 * Math.pow(2, fails - 5), 15 * 60000);
}
/* ===== Viestien linkit: vain http(s), mailto ja tel ovat napautettavia ===== */
// Palauttaa {kind, href, host, ...} tai null jos linkki ei ole turvallinen
function safeLink(raw) {
  const u = String(raw == null ? '' : raw).trim();
  if (!u || u.length > 2000 || /[\s\u0000-\u001f\u007f<>"`\\]/.test(u)) return null;
  let m = /^(https?):\/\/([^\/?#]*)/i.exec(u);
  if (m) {
    let auth = m[2]; const at = auth.lastIndexOf('@'), userinfo = at >= 0;
    if (userinfo) auth = auth.slice(at + 1);
    const hm = /^(\[[0-9a-f:.]+\]|[^:\/\[\]@]+)(?::(\d{1,5}))?$/i.exec(auth);
    if (!hm) return null;
    const host = hm[1].toLowerCase().replace(/\.$/, '');
    if (!host || host.indexOf('%') >= 0) return null;
    return { kind: 'web', href: u, host, port: hm[2] || '', userinfo, idn: /[^\x00-\x7f]/.test(host) || /(^|\.)xn--/.test(host) };
  }
  m = /^mailto:([^?]*)/i.exec(u);
  if (m) {
    let a = m[1]; try { a = decodeURIComponent(a); } catch (e) { return null; }
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(a)) return null;
    return { kind: 'mail', href: u, host: a.slice(a.lastIndexOf('@') + 1).toLowerCase() };
  }
  if (/^tel:\+?[0-9 ()\-.]{3,30}$/i.test(u)) return { kind: 'tel', href: u, host: '' };
  return null;
}
const labelHostOf = s => { const m = /^\s*(?:https?:\/\/)?(?:[^\/\s@]*@)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?(?:[\/?#]\S*)?\s*$/i.exec(String(s || '')); return m ? m[1].toLowerCase() : ''; };
// Jos linkin teksti näyttää toiselta osoitteelta kuin varsinainen kohde, palauttaa tekstin osoitteen; muuten ''
function linkMismatch(label, link) {
  const lh = labelHostOf(label);
  if (!lh || !link || link.kind !== 'web') return '';
  return (link.host === lh || link.host.endsWith('.' + lh)) ? '' : lh;
}
// Pilkkoo tekstin osiin: {t:'text', s} ja {t:'link', s, label, link}. Muut kuin turvalliset skeemat jäävät tavalliseksi tekstiksi.
function linkifyText(text) {
  const src = String(text == null ? '' : text), out = [];
  const re = /\[([^\]\n]{1,200})\]\(([^\s)]{1,2000})\)|(?:https?:\/\/|mailto:|tel:)[^\s<>"'`]+/gi;
  let last = 0, m;
  const pushText = s => { if (!s) return; const l = out[out.length - 1]; if (l && l.t === 'text') l.s += s; else out.push({ t: 'text', s }); };
  while ((m = re.exec(src))) {
    let tok = m[0], label = '', url;
    if (m[1] !== undefined) { label = m[1]; url = m[2]; }
    else {
      url = tok;
      while (/[.,;:!?'\]}]$/.test(url) || (url.endsWith(')') && (url.match(/\)/g) || []).length > (url.match(/\(/g) || []).length)) url = url.slice(0, -1);
      tok = url;
      const prev = src.slice(0, m.index), pm = /(\S+)\s*<$/.exec(prev);
      if (pm && labelHostOf(pm[1])) label = pm[1];
    }
    const link = safeLink(url);
    pushText(src.slice(last, m.index));
    if (!link) pushText(tok); else out.push({ t: 'link', s: m[1] !== undefined ? label : tok, label, link });
    last = m.index + tok.length; re.lastIndex = last;
  }
  pushText(src.slice(last));
  return out;
}
/* ===== Laitteen tila: vähimmäisversiot ===== */
// HUOM: PÄIVITÄ nämä arvot aina kun sovellus julkaistaan uudelleen (ja aseta checked = tarkistuskuukausi).
// Ne ovat suositeltuja vähimmäisversioita, joiden alapuolella käyttäjälle näytetään päivitysmuistutus.
// Päivitä julkaistaessa: Applen tukemat iOS-linjat ja niiden uusin tietoturvaversio (tarkistettu 2026-11: 27.2.1 / 26.7.3 / 18.7.12)
const SEC_MIN = { ios: { 27: '27.2.1', 26: '26.7.3', 18: '18.7.12' }, android: 14, chrome: 150, safari: 18, checked: '2026-11' };
// iOS-versiolle vaadittu vähimmäisversio: oma linja, uudempi kuin listattu = ajan tasalla, vanhempi kuin vanhin linja = ei enää tuettu
function iosMinFor(v, iosMin) {
  if (typeof iosMin === 'string') return iosMin;
  const majors = Object.keys(iosMin).map(Number).sort((a, b) => a - b), maj = parseInt(String(v), 10) || 0;
  if (iosMin[maj]) return iosMin[maj];
  if (maj > majors[majors.length - 1]) return null;
  if (maj < majors[0]) return iosMin[majors[majors.length - 1]];
  const lower = majors.filter(m => m < maj).pop(); return iosMin[majors.find(m => m > maj)] || iosMin[lower];
}
function cmpVersion(a, b) {
  const pa = String(a == null ? '' : a).split(/[._]/).map(x => parseInt(x, 10) || 0), pb = String(b == null ? '' : b).split(/[._]/).map(x => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
}
// Tunnistaa alustan, käyttöjärjestelmän version ja selaimen UA:sta. platformVersion = navigator.userAgentData.getHighEntropyValues(['platformVersion']) (vain Android).
// Chromen supistettu UA jäädyttää Androidin version muotoon "Android 10; K": sitä ei uskota. iPadOS:n pöytäkone-UA (Macintosh + kosketus) -> iOS, versio tuntematon.
function detectDeviceInfo(o) {
  o = o || {};
  const ua = String(o.ua || ''), touch = Number(o.maxTouchPoints) || 0;
  let platform = 'other', osVersion = null, m;
  if (/Android/i.test(ua)) {
    platform = 'android';
    const pv = o.platformVersion ? /^\s*(\d+(?:\.\d+)*)/.exec(String(o.platformVersion)) : null;
    if (pv) osVersion = pv[1];
    else if (!/Android 10; K\b/.test(ua) && (m = /Android (\d+(?:\.\d+)*)/.exec(ua))) osVersion = m[1];
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    platform = 'ios';
    if ((m = /\b(?:iPhone OS|CPU OS) (\d+(?:[_.]\d+){0,2})/.exec(ua))) osVersion = m[1].replace(/_/g, '.');
  } else if (/Macintosh/.test(ua) && touch > 1) platform = 'ios';
  let browser = '', major = null;
  if ((m = /SamsungBrowser\/(\d+)/.exec(ua))) browser = 'Samsung';
  else if ((m = /\b(?:EdgA|EdgiOS|Edg|Edge)\/(\d+)/.exec(ua))) browser = 'Edge';
  else if ((m = /\b(?:OPR|OPiOS)\/(\d+)/.exec(ua))) browser = 'Opera';
  else if ((m = /\b(?:Firefox|FxiOS)\/(\d+)/.exec(ua))) browser = 'Firefox';
  else if ((m = /\b(?:CriOS|Chrome)\/(\d+)/.exec(ua))) browser = 'Chrome';
  else if (/Safari\//.test(ua) && (m = /Version\/(\d+)/.exec(ua))) browser = 'Safari';
  if (browser && m) major = +m[1];
  return { platform, osVersion, browser, browserMajor: major };
}
const DEV_NOTE = 'Sovellus ei voi asentaa päivityksiä itse, mutta se käyttää aina puhelimen ja selaimen uusimpia suojauksia, kun ne on päivitetty.';
const DEV_UNKNOWN = 'Versiota ei voitu tunnistaa. Tarkista päivitykset puhelimen asetuksista.';
// -> {level: 'ok'|'update'|'unknown', lines: [...]}
function deviceStatus(info, min) {
  info = info || {}; min = min || SEC_MIN;
  const lines = []; let upd = false, unk = false;
  const p = info.platform, v = info.osVersion;
  if (p === 'ios') {
    if (v) {
      const im = iosMinFor(v, min.ios);
      if (im && cmpVersion(v, im) < 0) { upd = true; lines.push('iOS ' + v + ' – päivitys suositeltu (vähintään ' + im + '). Asetukset → Yleiset → Ohjelmistopäivitys.'); }
      else lines.push('iOS ' + v + ' – ajan tasalla.');
    } else { unk = true; lines.push(DEV_UNKNOWN); }
  } else if (p === 'android') {
    const major = v ? parseInt(v, 10) : NaN;
    if (isFinite(major)) {
      if (major < min.android) { upd = true; lines.push('Android ' + major + ' – päivitys suositeltu (vähintään ' + min.android + '). Asetukset → Järjestelmä → Ohjelmistopäivitys.'); }
      else lines.push('Android ' + major + ' – ajan tasalla.');
    } else { unk = true; lines.push(DEV_UNKNOWN); }
    lines.push('Tarkista myös Google Play -järjestelmäpäivitys ja tietoturvapäivityksen päivämäärä (Asetukset → Tietoturva ja yksityisyys).');
  }
  const b = info.browser, bm = info.browserMajor;
  if (b === 'Chrome' && bm != null) {
    if (bm < min.chrome) { upd = true; lines.push('Selain Chrome ' + bm + ' – päivitys suositeltu (vähintään ' + min.chrome + '). Päivitä selain sovelluskaupasta.'); }
    else lines.push('Selain Chrome ' + bm + ' – ajan tasalla.');
  } else if (b === 'Safari' && bm != null && p !== 'ios') {   // iOS:ssä Safarin versio seuraa käyttöjärjestelmää
    if (bm < min.safari) { upd = true; lines.push('Selain Safari ' + bm + ' – päivitys suositeltu (vähintään ' + min.safari + '). Safari päivittyy käyttöjärjestelmän päivityksen mukana.'); }
    else lines.push('Selain Safari ' + bm + ' – ajan tasalla.');
  }
  if (!lines.length) { unk = true; lines.push(DEV_UNKNOWN); }
  lines.push(DEV_NOTE);
  return { level: upd ? 'update' : unk ? 'unknown' : 'ok', lines };
}

const PII_ORG_WORDS = new Set(['oy', 'oyj', 'ab', 'ky', 'ry', 'ltd', 'inc', 'gmbh', 'group', 'konserni', 'rekrytointi', 'rekry', 'rekrytointitiimi', 'tiimi', 'team', 'asiakaspalvelu', 'palvelu', 'palvelut', 'support', 'hr', 'jobs', 'careers', 'recruitment', 'recruiting', 'viestintä', 'myynti', 'kauppa', 'kaupunki', 'kunta', 'säätiö', 'yhdistys', 'osasto', 'toimisto', 'päiväkoti', 'koulu', 'sairaala', 'keskus', 'noreply', 'no-reply', 'info', 'service', 'hakemus', 'työ', 'työpaikka', 'henkilö', 'terveisin', 'ystävällisin', 'kiitos', 'regards', 'br', 'sinä', 'minä', 'tuntematon']);
function looksLikePersonName(s) {
  s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  if (!s || s.length > 60 || /[\d@/\\&–—:;,()[\]<>"]/.test(s)) return false;
  const toks = s.split(' ');
  if (toks.length > 4) return false;
  return toks.every(t => /^\p{Lu}[\p{L}'’-]+$/u.test(t) && !PII_ORG_WORDS.has(t.toLowerCase()));
}
function dottedInitials(name) {
  const w = String(name || '').split(/[\s-]+/).map(x => x.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  return w.length ? w.map(x => Array.from(x)[0].toUpperCase() + '.').join(' ') : '?';
}
const isSensitive = c => !!(c && c.sensitive === true);
//#PURE-END

//#EXAMPLE-START
/* ===== Esimerkkidata ===== */
function buildExampleDocs() {
  const ME_E = 'oma.esimerkki@gmail.com', ME_P = '+358401234567', ME = 'Sinä';
  const sig = '\n\nTerveisin\nEero Esimerkki';
  const chats = [
    {
      id: 'ex-valio', name: 'Valio – myyntiassistentti', company: 'Valio', status: 'haastattelu', color: 'av1',
      notes: 'Toinen haastattelu pidetty 20.10. Päätös luvattu viimeistään 30.10.',
      members: [
        { id: 'p1', name: 'Heli Ranta', role: 'Rekrytoija', emails: ['rekry@valio.example.fi'], phones: ['+358501110001'] },
        { id: 'p2', name: 'Mikko Laine', role: 'Myyntipäällikkö (esihenkilö)', emails: ['mikko.laine@valio.example.fi'], phones: ['+358501110002'] }
      ],
      msgs: [
        ['2026-10-05T09:12:00+03:00', 'out', 'email', ME_E, ME, ['rekry@valio.example.fi'], 'Hakemus: myyntiassistentti', 'Hei,\n\nhaen avoinna olevaa myyntiassistentin tehtävää. Minulla on kaksi vuotta kokemusta asiakaspalvelusta ja tilausten käsittelystä, ja olen kiinnostunut erityisesti yritysmyynnistä.\n\nCV on liitteenä. Kerron mielelläni lisää, jos tehtävä kiinnostaa.' + sig],
        ['2026-10-06T14:40:00+03:00', 'in', 'email', 'rekry@valio.example.fi', 'Heli Ranta', [ME_E], 'Re: Hakemus: myyntiassistentti', 'Hei Eero,\n\nkiitos hakemuksestasi! Olemme vastaanottaneet sen ja käymme hakemukset läpi ensi viikon aikana. Otamme yhteyttä, jos jatkamme prosessia.\n\nTerveisin\nHeli Ranta\nRekrytointi, Valio'],
        ['2026-10-12T10:05:00+03:00', 'in', 'email', 'rekry@valio.example.fi', 'Heli Ranta', [ME_E], 'Kutsu haastatteluun – myyntiassistentti', 'Hei Eero,\n\nhakemuksesi herätti kiinnostusta! Haluaisimme kutsua sinut haastatteluun torstaina 15.10. klo 13.00 toimistollemme. Haastattelussa on mukana myös esihenkilö Mikko Laine.\n\nSopiiko aika? Vahvistathan vastaamalla tähän viestiin.\n\nTerveisin\nHeli'],
        ['2026-10-12T11:30:00+03:00', 'out', 'email', ME_E, ME, ['rekry@valio.example.fi'], 'Re: Kutsu haastatteluun – myyntiassistentti', 'Hei Heli,\n\nkiitos kutsusta! Torstai 15.10. klo 13.00 sopii hyvin, tulen paikalle.' + sig],
        ['2026-10-14T16:20:00+03:00', 'in', 'sms', '+358501110001', 'Heli Ranta', [ME_P], '', 'Hei! Heli Valiolta. Muistutus: haastattelu huomenna torstaina klo 13.00. Tervetuloa, kysy vastaanotosta Helia!'],
        ['2026-10-14T16:35:00+03:00', 'out', 'sms', ME_P, ME, ['+358501110001'], '', 'Kiitos muistutuksesta, nähdään huomenna!'],
        ['2026-10-15T13:00:00+03:00', 'out', 'meeting', ME_E, ME, ['rekry@valio.example.fi', 'mikko.laine@valio.example.fi'], '', 'Haastattelu Valion toimistolla (Heli ja Mikko). Kysyttiin kokemuksesta tilausten käsittelyssä ja asiakastapauksista. Meni mielestäni hyvin.'],
        ['2026-10-16T09:50:00+03:00', 'in', 'call', '+358501110002', 'Mikko Laine', [ME_P], '', 'Puhelu, 6 min. Mikko kiitti haastattelusta ja kysyi, pääsisinkö toiselle kierrokselle ensi viikolla.'],
        ['2026-10-16T10:30:00+03:00', 'in', 'email', 'mikko.laine@valio.example.fi', 'Mikko Laine', [ME_E], 'Toinen haastattelu ja työnäyte', 'Hei Eero,\n\nkiitos puhelusta! Tässä vielä kirjallisesti: toinen haastattelu on tiistaina 20.10. klo 10.00 Teamsissa. Valmistele ennen sitä lyhyt (5 min) esitys siitä, miten lähestyisit uuden asiakkaan ensikontaktia.\n\nTerveisin\nMikko Laine\nMyyntipäällikkö, Valio'],
        ['2026-10-16T12:10:00+03:00', 'out', 'email', ME_E, ME, ['mikko.laine@valio.example.fi'], 'Re: Toinen haastattelu ja työnäyte', 'Hei Mikko,\n\nkiitos! Aika sopii ja valmistelen esityksen. Tuleeko Teams-linkki erikseen?' + sig],
        ['2026-10-22T15:30:00+03:00', 'in', 'email', 'rekry@valio.example.fi', 'Heli Ranta', [ME_E], 'Päätöksen aikataulu', 'Hei Eero,\n\nkiitos toisesta haastattelusta! Päätämme valinnasta ensi viikon aikana ja ilmoitamme tuloksesta viimeistään perjantaina 30.10.\n\nTerveisin\nHeli']
      ]
    },
    {
      id: 'ex-kesko', name: 'Kesko – varastotyöntekijä', company: 'Kesko', status: 'odottaa', color: 'av3',
      notes: 'Ei vielä vastausta. Muista soittaa tai lähettää muistutus.',
      members: [{ id: 'p3', name: 'Keskon rekrytointi', role: 'Rekrytointitiimi', emails: ['rekrytointi@kesko.example.fi'], phones: [] }],
      msgs: [
        ['2026-10-12T20:15:00+03:00', 'out', 'other', ME_E, ME, ['rekrytointi@kesko.example.fi'], '', 'Täytin hakulomakkeen Keskon rekrytointisivulla (varastotyöntekijä, Vantaa). Vahvistus tuli lomakkeen lähetyksen jälkeen.'],
        ['2026-10-13T08:45:00+03:00', 'out', 'email', ME_E, ME, ['rekrytointi@kesko.example.fi'], 'Hakemus: varastotyöntekijä, Vantaa', 'Hei,\n\nhain eilen verkkolomakkeella varastotyöntekijän tehtävää Vantaan keskusvarastolle. Minulla on trukkikortti ja kolmen vuoden kokemus varastotyöstä.\n\nKuulisin mielelläni hakemuksen etenemisestä.' + sig]
      ]
    },
    {
      id: 'ex-fazer', name: 'Fazer – asiakaspalvelu', company: 'Fazer', status: 'tarjous', color: 'av4',
      notes: 'Suullinen tarjous 23.10. Työsopimusluonnos tulossa sähköpostilla.',
      members: [{ id: 'p4', name: 'Sari Mäkelä', role: 'Asiakaspalvelupäällikkö', emails: ['sari.makela@fazer.example.fi'], phones: ['+358502220001'] }],
      msgs: [
        ['2026-10-08T10:02:00+03:00', 'out', 'whatsapp', ME_P, ME, ['+358502220001'], '', 'Hei Sari! Olen Eero, hain Fazerin asiakaspalvelijan paikkaa. Kiitos että soitit tänään. Laitan tähän vielä CV:ni.'],
        ['2026-10-08T10:15:00+03:00', 'in', 'whatsapp', '+358502220001', 'Sari Mäkelä', [ME_P], '', 'Hei Eero! Kiva kun laitoit viestiä. Kerro vielä, milloin voisit aloittaa jos tulisit valituksi?'],
        ['2026-10-08T10:21:00+03:00', 'out', 'whatsapp', ME_P, ME, ['+358502220001'], '', 'Voisin aloittaa 1.11. alkaen, irtisanomisaikaa ei ole.'],
        ['2026-10-08T10:30:00+03:00', 'in', 'whatsapp', '+358502220001', 'Sari Mäkelä', [ME_P], '', 'Hyvä! Sovitaan haastattelu ensi viikolle. Sopiiko tiistai 13.10. klo 9?'],
        ['2026-10-08T10:32:00+03:00', 'out', 'whatsapp', ME_P, ME, ['+358502220001'], '', 'Sopii hyvin, kiitos!'],
        ['2026-10-13T11:45:00+03:00', 'in', 'whatsapp', '+358502220001', 'Sari Mäkelä', [ME_P], '', 'Kiitos haastattelusta tänään, oli mukava tavata!'],
        ['2026-10-13T11:50:00+03:00', 'out', 'whatsapp', ME_P, ME, ['+358502220001'], '', 'Kiitos samoin! Tehtävä kuulosti todella kiinnostavalta.'],
        ['2026-10-23T13:20:00+03:00', 'in', 'whatsapp', '+358502220001', 'Sari Mäkelä', [ME_P], '', 'Hei Eero! Hyviä uutisia: haluaisimme tarjota sinulle asiakaspalvelijan paikkaa. Lähetän työsopimusluonnoksen sähköpostilla tänään.'],
        ['2026-10-23T13:34:00+03:00', 'out', 'whatsapp', ME_P, ME, ['+358502220001'], '', 'Vau, kiitos paljon! Otan paikan mielelläni vastaan. Odotan sopimusta.'],
        ['2026-10-23T13:40:00+03:00', 'in', 'whatsapp', '+358502220001', 'Sari Mäkelä', [ME_P], '', 'Mahtavaa! Tervetuloa joukkoon.']
      ]
    },
    {
      id: 'ex-posti', name: 'Posti – kesätyö', company: 'Posti', status: 'hylatty', color: 'av5',
      notes: 'Hakea uudelleen ensi vuonna.',
      members: [{ id: 'p5', name: 'Postin rekrytointi', role: 'Rekrytointitiimi', emails: ['rekry@posti.example.fi'], phones: [] }],
      msgs: [
        ['2026-09-28T18:20:00+03:00', 'out', 'email', ME_E, ME, ['rekry@posti.example.fi'], 'Hakemus: kesätyöntekijä 2027', 'Hei,\n\nhaen kesätyöntekijän paikkaa lajittelukeskuksesta kesäksi 2027. Olen työskennellyt varastolla ja pidän fyysisestä työstä.\n\nCV liitteenä.' + sig],
        ['2026-10-09T11:05:00+03:00', 'in', 'email', 'rekry@posti.example.fi', 'Postin rekrytointi', [ME_E], 'Hakemuksesi: kesätyöntekijä 2027', 'Hei Eero,\n\nkiitos kiinnostuksestasi Postia kohtaan ja ajastasi hakuprosessissa. Saimme tehtävään runsaasti päteviä hakijoita, ja valitettavasti emme tällä kertaa voi tarjota sinulle paikkaa.\n\nToivotamme sinulle menestystä jatkossa ja kannustamme hakemaan uudelleen!\n\nYstävällisin terveisin\nPostin rekrytointitiimi']
      ]
    },
    {
      id: 'ex-makinen', name: 'Rakennus Mäkinen Oy', company: 'Rakennus Mäkinen Oy', status: 'haettu', color: 'av2',
      notes: 'Koepäivä maanantaina 26.10. klo 7, Rakentajantie 5. Omat turvakengät mukaan.',
      members: [{ id: 'p6', name: 'Pekka Mäkinen', role: 'Yrittäjä', emails: [], phones: ['+358503330099'] }],
      msgs: [
        ['2026-10-19T17:05:00+03:00', 'out', 'sms', ME_P, ME, ['+358503330099'], '', 'Hei Pekka! Näin ilmoituksesi rakennusapulaisen paikasta. Olen kiinnostunut, minulla on perustaidot rakennustyöstä ja ajokortti. Voisinko soittaa huomenna? -Eero'],
        ['2026-10-19T18:30:00+03:00', 'in', 'sms', '+358503330099', 'Pekka Mäkinen', [ME_P], '', 'Moi! Joo soita vaikka aamulla ennen kahdeksaa, silloin tavoittaa parhaiten.'],
        ['2026-10-20T07:40:00+03:00', 'out', 'call', ME_P, ME, ['+358503330099'], '', 'Puhelu, 4 min. Sovittiin koepäivä haastattelun sijaan, Pekka ilmoittaa tarkemmin.'],
        ['2026-10-23T16:10:00+03:00', 'in', 'sms', '+358503330099', 'Pekka Mäkinen', [ME_P], '', 'Koepäivä voisi olla ensi maanantaina 26.10. klo 7 Rakentajantie 5 työmaalla. Tuo omat turvakengät.'],
        ['2026-10-23T16:25:00+03:00', 'out', 'sms', ME_P, ME, ['+358503330099'], '', 'Selvä, olen paikalla maanantaina klo 7. Kiitos!']
      ]
    }
  ];
  const docs = [];
  docs.push({
    path: 'meta/profile',
    data: {
      identities: [
        { type: 'email', value: ME_E, label: 'Gmail', example: true },
        { type: 'phone', value: ME_P, label: 'Oma puhelin', example: true }
      ],
      updatedAt: '2026-10-05T09:00:00+03:00'
    }
  });
  for (const c of chats) {
    const msgs = c.msgs.map((t, i) => ({
      id: 'm' + (i + 1),
      data: toMsgDoc({ at: t[0], dir: t[1], channel: t[2], from: t[3], fromName: t[4], to: t[5], subject: t[6], body: t[7], source: 'manual', example: true, createdAt: t[0] })
    }));
    const stats = computeStats(msgs.map(m => m.data));
    const created = msgs.length ? msgs[0].data.at : '2026-10-01T10:00:00+03:00';
    docs.push({
      path: 'chats/' + c.id,
      data: {
        name: c.name, company: c.company, status: c.status, notes: c.notes, color: c.color, example: true,
        members: c.members, createdAt: created, updatedAt: stats.lastAt || created, stats
      }
    });
    for (const m of msgs) docs.push({ path: 'chats/' + c.id + '/messages/' + m.id, data: m.data });
  }
  return docs;
}
//#EXAMPLE-END
