// Testaa hakuviestit.html:n puhtaat funktiot (lukee ne tiedostosta markerien välistä).
const fs = require('fs');
const vm = require('vm');
const SRC = process.argv[2];
const html = fs.readFileSync(SRC, 'utf8');
function section(a, b) {
  const i = html.indexOf(a), j = html.indexOf(b);
  if (i < 0 || j < 0) throw new Error('marker puuttuu ' + a);
  return html.slice(i, j + b.length);
}
const code = section('//#PURE-START', '//#PURE-END') + '\n' + section('//#ADDR-START', '//#ADDR-END') + '\n' + section('//#GMAIL-START', '//#GMAIL-END') + '\n' + section('//#EXAMPLE-START', '//#EXAMPLE-END');
const names = 'normEmail isEmail normPhone isPhone addrKey companyFromEmail parseAddrHeader decodeMimeWords parseEml stripQuoted htmlToText createMboxSplitter looksLikeMbox parseWhatsApp computeStats msgIdOf hash64 fmtListDate fmtDayLabel waitDays isoWeek weeklyBuckets partiesOf buildOwnSet buildAddrIndex ensureMember buildExampleDocs toMsgDoc previewOf bytesToLatin1 relDays dayDiff parseAddressList nameFromAddress planEmailChats FREE_MAIL gmailQueryForChat stripQuotedMail gmailMsgToAppMsg gmailDocId gmailErrorInfo replySubject findSentMatch gmailComposeUrl matchPending mailtoHref discoveryQueries connectedAccountFromThreads discoverCounterparts workScore isWorkGroup groupCompany matchExistingChat periodTerm isAutomationAddr JOB_BOARDS ATS_DOMAINS isNewsletterLike bioPlatform bioLabel bioStrings secTips unlockDelayMs safeLink linkifyText linkMismatch labelHostOf redactDiag buildSendDiag diagResultText SEC_MIN cmpVersion detectDeviceInfo deviceStatus looksLikePersonName dottedInitials isSensitive GOOGLE_CLIENT_RE GMAIL_SCOPE oauthRedirectUri oauthAuthUrl parseOAuthFragment gmailApiMsg gmailHttpError decodeEntities'.split(' ');
const ctx = { TextDecoder, atob, btoa, console, Math, Date, Uint8Array, RegExp };
vm.createContext(ctx);
vm.runInContext(code + '\nglobalThis.__x={' + names.join(',') + '};', ctx);
const X = ctx.__x;

let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log('FAIL', name, '\n  got :', JSON.stringify(got), '\n  want:', JSON.stringify(want)); }
}
function ok(name, cond, info) { if (cond) pass++; else { fail++; console.log('FAIL', name, info || ''); } }
const u8 = s => Buffer.from(s, 'utf8').toString('latin1'); // utf-8 -> "tavumerkkijono" (kuten tiedostonluku)
const l1 = s => Buffer.from(s, 'latin1').toString('latin1');

// ---- Puhelinnormalisointi ----
eq('phone 040', X.normPhone('040 123 4567'), '+358401234567');
eq('phone +358', X.normPhone('+358 40 123 4567'), '+358401234567');
eq('phone 00', X.normPhone('0044 20 7946 0958'), '+442079460958');
eq('phone dash/paren', X.normPhone('(040) 123-4567'), '+358401234567');
eq('phone 358 no plus', X.normPhone('358401234567'), '+358401234567');
eq('phone (0)', X.normPhone('+358 (0)40 1234567'), '+358401234567');
ok('isPhone', X.isPhone('+358401234567') && !X.isPhone('123') && !X.isPhone('abc'));
eq('email norm', X.normEmail('  Maija.Meikalainen@Valio.FI '), 'maija.meikalainen@valio.fi');
ok('isEmail', X.isEmail('a@b.fi') && !X.isEmail('a@b') && !X.isEmail('a b@c.fi'));
eq('addrKey email', X.addrKey('Foo@Bar.fi'), 'e:foo@bar.fi');
eq('addrKey phone', X.addrKey('040 1234567'), 'p:+358401234567');
eq('addrKey name', X.addrKey('Maija  Meikä'), 'n:maija meikä');
eq('company valio', X.companyFromEmail('rekry@valio.example.fi'), 'Valio');
eq('company mail.valio.fi', X.companyFromEmail('x@mail.valio.fi'), 'Mail'.length ? 'Valio' : '');
eq('company gmail', X.companyFromEmail('a@gmail.com'), '');
eq('company simple', X.companyFromEmail('a@kesko.fi'), 'Kesko');

// ---- Osoitteet ----
eq('addr list', X.parseAddrHeader('"Meikäläinen, Maija" <Maija@Valio.fi>, pekka@x.fi, Teppo <teppo@y.fi>').map(a => [a.name, a.email]),
  [['Meikäläinen, Maija', 'maija@valio.fi'], ['', 'pekka@x.fi'], ['Teppo', 'teppo@y.fi']]);

// ---- Encoded-words ----
eq('ew B utf8', X.decodeMimeWords('=?UTF-8?B?SMOkaGvDpHDDpMOkIQ==?='), 'Hähkäpää!');
eq('ew Q utf8', X.decodeMimeWords('=?utf-8?Q?Ty=C3=B6paikka_ty=C3=B6ntekij=C3=A4lle?='), 'Työpaikka työntekijälle');
eq('ew Q latin1', X.decodeMimeWords('=?iso-8859-1?Q?Hakemus_ty=F6paikkaan?='), 'Hakemus työpaikkaan');
eq('ew 1252', X.decodeMimeWords('=?windows-1252?Q?Caf=E9_=80?='), 'Café €');
eq('ew ascii', X.decodeMimeWords('=?us-ascii?Q?Hello_World?='), 'Hello World');
eq('ew adjacent split multibyte', X.decodeMimeWords('=?UTF-8?B?w6TDpA==?= =?UTF-8?B?w6TDpA==?='), 'ääää');
eq('ew keeps text', X.decodeMimeWords('Re: =?utf-8?Q?Hei?= maailma'), 'Re: Hei maailma');

// ---- parseEml: yksinkertainen + encoded subject + QP ----
const eml1 = [
  'From: =?UTF-8?Q?Heli_Ranta?= <Rekry@Valio.Example.fi>',
  'To: Eero Esimerkki <oma.esimerkki@gmail.com>',
  'Cc: mikko@valio.example.fi',
  'Subject: =?UTF-8?B?' + Buffer.from('Kutsu haastatteluun – myyntiassistentti', 'utf8').toString('base64') + '?=',
  'Date: Mon, 12 Oct 2026 10:05:00 +0300',
  'Message-ID: <abc123@valio.example.fi>',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'Hei Eero,',
  '',
  'haluamme kutsua sinut haastatteluun torstaina 15.10. klo 13.00. T=C3=A4m=C3=A4 on pitk=C3=A4 rivi joka katkeaa =',
  'kesken sanan.',
  '',
  'Terveisin',
  'Heli',
  '',
  'On Sun, 11 Oct 2026 at 12:00, Eero Esimerkki <oma.esimerkki@gmail.com> wrote:',
  '> Hei, haen tehtävää.',
  '> Terveisin Eero'
].join('\r\n');
const r1 = X.parseEml(u8(eml1));
eq('eml1 from', r1.from, 'rekry@valio.example.fi');
eq('eml1 fromName', r1.fromName, 'Heli Ranta');
eq('eml1 to', r1.to, ['oma.esimerkki@gmail.com', 'mikko@valio.example.fi']);
eq('eml1 subject', r1.subject, 'Kutsu haastatteluun – myyntiassistentti');
eq('eml1 at', r1.at, '2026-10-12T07:05:00.000Z');
eq('eml1 mid', r1.messageId, 'abc123@valio.example.fi');
ok('eml1 qp body', r1.body.includes('Tämä on pitkä rivi joka katkeaa kesken sanan.'), r1.body);
ok('eml1 quote stripped', !r1.body.includes('wrote:') && !r1.body.includes('haen tehtävää'), r1.body);
ok('eml1 sig kept', r1.body.endsWith('Heli'), JSON.stringify(r1.body));

// ---- multipart/alternative + sisäkkäinen mixed + base64 ----
const b64 = Buffer.from('Hei!\nTämä on base64-koodattu tekstiosa ääkkösillä.\n', 'utf8').toString('base64').replace(/(.{60})/g, '$1\r\n');
const eml2 = [
  'From: pekka@firma.fi',
  'To: oma.esimerkki@gmail.com',
  'Subject: Testi',
  'Date: Tue, 13 Oct 2026 08:00:00 +0300',
  'Content-Type: multipart/mixed; boundary="OUTER"',
  '',
  'This is a multi-part message',
  '--OUTER',
  'Content-Type: multipart/alternative; boundary="INNER"',
  '',
  '--INNER',
  'Content-Type: text/plain; charset="utf-8"',
  'Content-Transfer-Encoding: base64',
  '',
  b64,
  '--INNER',
  'Content-Type: text/html; charset="utf-8"',
  'Content-Transfer-Encoding: 7bit',
  '',
  '<html><body><p>HTML-versio ei pitäisi näkyä</p></body></html>',
  '--INNER--',
  '--OUTER',
  'Content-Type: application/pdf; name="cv.pdf"',
  'Content-Disposition: attachment; filename="cv.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  'JVBERi0xLjQK',
  '--OUTER--',
  ''
].join('\r\n');
const r2 = X.parseEml(u8(eml2));
ok('eml2 plain preferred', r2.body.includes('base64-koodattu tekstiosa ääkkösillä') && !r2.body.includes('HTML-versio'), r2.body);
eq('eml2 from', r2.from, 'pekka@firma.fi');

// ---- HTML-only (regex-fallback node:ssa) + iso-8859-1 QP ----
const eml3 = [
  'From: =?iso-8859-1?Q?P=E4iv=E4?= <paiva@x.fi>',
  'To: oma.esimerkki@gmail.com',
  'Subject: =?iso-8859-1?Q?Ty=F6haastattelu?=',
  'Date: Wed, 14 Oct 2026 09:00:00 +0300',
  'Content-Type: text/html; charset=iso-8859-1',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  '<html><head><style>p{color:red}</style></head><body><p>Hei, ty=F6haastattelu on huomenna.</p><p>Terv. P=E4iv=E4<br>Rekrytoija</p></body></html>'
].join('\r\n');
const r3 = X.parseEml(l1(eml3));
eq('eml3 from name', r3.fromName, 'Päivä');
eq('eml3 subject', r3.subject, 'Työhaastattelu');
ok('eml3 html->text', r3.body.includes('Hei, työhaastattelu on huomenna.') && r3.body.includes('Terv. Päivä\nRekrytoija') && !r3.body.includes('color:red') && !r3.body.includes('<'), JSON.stringify(r3.body));

// ---- Folded header + Finnish quote ----
const eml4 = [
  'From: maija@x.fi',
  'To: oma.esimerkki@gmail.com,',
  ' toinen@x.fi',
  'Subject: Re: Hakemus',
  ' jatkuu',
  'Date: Thu, 15 Oct 2026 12:00:00 +0300',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Kiitos viestistä!',
  '',
  'ke 14. lokak. 2026 klo 10.15 Eero Esimerkki <oma.esimerkki@gmail.com> kirjoitti:',
  '> vanha viesti'
].join('\n');
const r4 = X.parseEml(u8(eml4));
eq('eml4 folded to', r4.to, ['oma.esimerkki@gmail.com', 'toinen@x.fi']);
eq('eml4 folded subject', r4.subject, 'Re: Hakemus jatkuu');
eq('eml4 fi quote', r4.body, 'Kiitos viestistä!');

// ---- 8bit utf-8 ilman charsetia ----
const r5 = X.parseEml(u8('From: a@b.fi\nTo: c@d.fi\nSubject: x\nDate: Fri, 16 Oct 2026 12:00:00 +0300\nContent-Type: text/plain\nContent-Transfer-Encoding: 8bit\n\nÄäkköset toimivat.'));
eq('eml5 8bit utf8', r5.body, 'Ääkköset toimivat.');

// ---- mbox-jakaja: paloissa mielivaltaisista kohdista ----
const mbox = [
  'From 1234567890@xxx Mon Oct 12 10:05:00 +0000 2026', 'From: a@x.fi', 'Subject: Yksi', '', 'Eka viesti', 'From the desk of nobody (ei erotin, edellinen rivi ei tyhjä)', '',
  'From MAILER-DAEMON Tue Oct 13 08:00:00 2026', 'From: b@x.fi', 'Subject: Kaksi', '', 'Toka viesti',
  '', 'From 99@xxx Wed Oct 14 09:00:00 +0000 2026', 'From: c@x.fi', 'Subject: Kolme', '', 'Kolmas'
].join('\n');
for (const step of [1, 2, 7, 33, 1000]) {
  const got = [];
  const sp = X.createMboxSplitter((raw, d) => got.push([raw, d]));
  for (let i = 0; i < mbox.length; i += step) sp.push(mbox.slice(i, i + step));
  sp.end();
  eq('mbox count step ' + step, got.length, 3);
  if (got.length === 3) {
    ok('mbox msg1 content step ' + step, got[0][0].includes('Subject: Yksi') && got[0][0].includes('From the desk'), got[0][0]);
    ok('mbox msg3 step ' + step, got[2][0].includes('Subject: Kolme'));
  }
}
ok('looksLikeMbox', X.looksLikeMbox(mbox) && !X.looksLikeMbox('From: a@b.fi\nTo: x'));

// ---- WhatsApp ----
const wa1 = [
  '25.10.2026 klo 14.03 - Viestit ja puhelut on salattu päästä päähän.',
  '25.10.2026 klo 14.03 - Maija: Hei Eero!',
  '25.10.2026 klo 14.04 - Eero: Moi!',
  'Toinen rivi samaa viestiä',
  '25.10.2026 klo 14.05 - Maija: <Media jätetty pois>',
  '25.10.2026 klo 14.06 - Maija muutti ryhmän kuvaa'
].join('\n');
const w1 = X.parseWhatsApp(wa1);
eq('wa1 count', w1.messages.length, 3);
eq('wa1 names', w1.names.sort(), ['Eero', 'Maija']);
eq('wa1 multiline', w1.messages[1].body, 'Moi!\nToinen rivi samaa viestiä');
eq('wa1 media', w1.messages[2].body, '[media]');
const d1 = new Date(w1.messages[0].at);
eq('wa1 date', [d1.getFullYear(), d1.getMonth() + 1, d1.getDate(), d1.getHours(), d1.getMinutes()], [2026, 10, 25, 14, 3]);

const w2 = X.parseWhatsApp('25.10.2026 14.03 - Maija: Terve\n26.10.2026 08.15 - Eero: Huomenta');
eq('wa2 count', w2.messages.length, 2);
eq('wa2 time', new Date(w2.messages[1].at).getHours() * 100 + new Date(w2.messages[1].at).getMinutes(), 815);

const w3 = X.parseWhatsApp('[25.10.2026 14.03.12] Maija: Hei\n[25.10.2026 14.04.40] Eero: Moi\njatkuu');
eq('wa3 count', w3.messages.length, 2);
eq('wa3 body', w3.messages[1].body, 'Moi\njatkuu');
eq('wa3 sec', new Date(w3.messages[0].at).getSeconds(), 12);

const w4 = X.parseWhatsApp('10/25/26, 2:03 PM - Maija: Hello\n10/25/26, 12:05 AM - Eero: Night');
eq('wa4 count', w4.messages.length, 2);
const d4 = new Date(w4.messages[0].at), d4b = new Date(w4.messages[1].at);
eq('wa4 mdy 12h', [d4.getMonth() + 1, d4.getDate(), d4.getFullYear(), d4.getHours(), d4b.getHours()], [10, 25, 2026, 14, 0]);

const w5 = X.parseWhatsApp('25/10/2026, 14:03 - Maija: Hello\n26/10/2026, 09:03 - Eero: Hi');
const d5 = new Date(w5.messages[0].at);
eq('wa5 dmy', [d5.getMonth() + 1, d5.getDate(), d5.getHours()], [10, 25, 14]);
const w6 = X.parseWhatsApp('‎[25.10.2026 14.03.12] Maija: ‎<Media omitted>');
eq('wa6 omitted+LRM', w6.messages.map(m => m.body), ['[media]']);

// ---- Tilastot ja viestikohtaus ----
const ms = [
  { at: '2026-10-01T10:00:00+03:00', dir: 'out', channel: 'email', subject: 'Hakemus', body: 'Hei' },
  { at: '2026-10-03T10:00:00+03:00', dir: 'in', channel: 'sms', subject: '', body: 'Kiitos\nviestistä' },
  { at: '2026-10-02T10:00:00+03:00', dir: 'out', channel: 'sms', subject: '', body: 'Seuranta' }
];
const st = X.computeStats(ms);
eq('stats counts', [st.sent, st.received], [2, 1]);
eq('stats last', [st.lastAt, st.lastDir, st.lastChannel, st.lastPreview], ['2026-10-03T10:00:00+03:00', 'in', 'sms', 'Kiitos viestistä']);
eq('stats lastSent', st.lastSentAt, '2026-10-02T10:00:00+03:00');
eq('stats empty', X.computeStats([]).sent, 0);

const own = X.buildOwnSet([{ type: 'email', value: 'Oma.Esimerkki@gmail.com' }, { type: 'phone', value: '040 123 4567' }]);
eq('ownSet', [...own].sort(), ['e:oma.esimerkki@gmail.com', 'p:+358401234567']);
const pin = X.partiesOf({ dir: 'in', from: 'rekry@valio.fi', fromName: 'Heli', to: ['oma.esimerkki@gmail.com', 'cc@x.fi'], _toNames: ['', ''] }, own);
eq('parties in', pin.map(p => p.key), ['e:rekry@valio.fi', 'e:cc@x.fi']);
const pout = X.partiesOf({ dir: 'out', from: 'oma.esimerkki@gmail.com', to: ['0501110001', 'x@y.fi'], _toNames: ['Heli', ''] }, own);
eq('parties out', pout.map(p => [p.key, p.name, p.phone]), [['p:+358501110001', 'Heli', '+358501110001'], ['e:x@y.fi', '', '']]);
eq('id deterministic', X.msgIdOf({ from: 'a', at: 'b', subject: 'c', body: 'd' }), X.msgIdOf({ from: 'a', at: 'b', subject: 'c', body: 'd' }));
ok('id differs', X.msgIdOf({ from: 'a', at: 'b', subject: 'c', body: 'd' }) !== X.msgIdOf({ from: 'a', at: 'b', subject: 'c', body: 'e' }));
ok('id format', /^m[0-9a-f]{16}$/.test(X.msgIdOf({ messageId: '<X@y>' })));
eq('id by Message-ID', X.msgIdOf({ messageId: 'X@y', from: '1' }), X.msgIdOf({ messageId: 'x@Y', from: '2' }));

// ---- ensureMember ----
const mem = [{ id: 'p1', name: 'Heli Ranta', role: '', emails: ['rekry@valio.fi'], phones: [] }];
X.ensureMember(mem, { name: 'Heli R.', email: 'rekry@valio.fi', phone: '+358501110001' }, () => 'new1');
eq('ensureMember adds phone', mem[0].phones, ['+358501110001']);
X.ensureMember(mem, { name: 'Uusi Henkilö', email: 'uusi@x.fi', phone: '' }, () => 'new1');
eq('ensureMember new', [mem.length, mem[1].id, mem[1].emails], [2, 'new1', ['uusi@x.fi']]);

// ---- Päivämäärät ----
const now = new Date(2026, 9, 25, 15, 0); // su 25.10.2026
eq('list today', X.fmtListDate(new Date(2026, 9, 25, 14, 3).toISOString(), now), '14.03');
eq('list this week', X.fmtListDate(new Date(2026, 9, 21, 14, 3).toISOString(), now), 'ke');
eq('list older', X.fmtListDate(new Date(2026, 9, 12, 14, 3).toISOString(), now), '12.10.');
eq('list other year', X.fmtListDate(new Date(2025, 9, 25, 14, 3).toISOString(), now), '25.10.2025');
eq('day label', [X.fmtDayLabel(new Date(2026, 9, 25), now), X.fmtDayLabel(new Date(2026, 9, 24), now), X.fmtDayLabel(new Date(2026, 9, 19), now)], ['Tänään', 'Eilen', 'Maanantai 19.10.2026']);
eq('waitDays 9', X.waitDays({ lastDir: 'out', lastAt: new Date(2026, 9, 16, 12, 0).toISOString() }, now), 9);
eq('waitDays recent', X.waitDays({ lastDir: 'out', lastAt: new Date(2026, 9, 20, 12, 0).toISOString() }, now), 0);
eq('waitDays in', X.waitDays({ lastDir: 'in', lastAt: new Date(2026, 9, 1).toISOString() }, now), 0);
eq('isoWeek', [X.isoWeek(new Date(2026, 9, 25)), X.isoWeek(new Date(2026, 9, 26)), X.isoWeek(new Date(2027, 0, 1))], [43, 44, 53]);
const wb = X.weeklyBuckets([new Date(2026, 9, 25, 10).toISOString(), new Date(2026, 9, 19, 10).toISOString(), new Date(2026, 9, 18, 10).toISOString(), new Date(2020, 0, 1).toISOString()], now, 12);
eq('buckets', [wb.length, wb[11].week, wb[11].count, wb[10].count, wb[0].week], [12, 43, 2, 1, 32]);

// ---- Esimerkkidata ----
const ex = X.buildExampleDocs();
const exChats = ex.filter(d => /^chats\/[^/]+$/.test(d.path));
const exMsgs = ex.filter(d => /\/messages\//.test(d.path));
eq('example counts', [ex.length, exChats.length, exMsgs.length > 20], [1 + exChats.length + exMsgs.length, 5, true]);
ok('example all flagged', ex.filter(d => d.path !== 'meta/profile').every(d => d.data.example === true));
const kesko = exChats.find(d => d.path === 'chats/ex-kesko').data;
eq('kesko wait', X.waitDays(kesko.stats, new Date(2026, 9, 25, 12)) >= 12, true);
ok('paths ok', ex.every(d => d.path.split('/').every(s => /^[A-Za-z0-9_-]+$/.test(s))));


// ---- parseAddressList / nameFromAddress / planEmailChats ----
const PA = X.parseAddressList;
const em = l => l.filter(e => e.ok).map(e => e.email);
eq('PA erottimet (pilkku, puolipiste, väli, rivinvaihto)', em(PA('a@b.fi, c@d.fi; e@f.fi g@h.fi\ni@j.fi')), ['a@b.fi', 'c@d.fi', 'e@f.fi', 'g@h.fi', 'i@j.fi']);
eq('PA Nimi <osoite> + isot kirjaimet', PA('Mikko Laine <Mikko.Laine@Valio.FI>').map(e => [e.name, e.email, e.company]), [['Mikko Laine', 'mikko.laine@valio.fi', 'Valio']]);
eq('PA lainausmerkit ja pilkku nimessä', PA('"Meikäläinen, Matti" <matti@x.fi>, Sari <sari@x.fi>').map(e => [e.name, e.email]), [['Meikäläinen, Matti', 'matti@x.fi'], ['Sari', 'sari@x.fi']]);
eq('PA ääkköset', PA('pekka.mäkinen@yritys.fi ÄÄ.Ö@Esim.fi').map(e => [e.ok, e.name]), [[true, 'Pekka Mäkinen'], [true, 'Ää Ö']]);
const dup = PA('a@b.fi, A@B.FI, Joku <a@b.fi>, c@d.fi');
eq('PA duplikaatit poistetaan, nimi säilyy', [dup.length, dup[0].name, dup[0].nameGiven], [2, 'Joku', true]);
const bad = PA('foo, bar@, @baz.fi, x@y, a@@b.fi, hyvä@ok.fi');
eq('PA virheelliset syineen', bad.map(e => e.ok ? 'ok' : e.error), ['Ei sähköpostiosoite (puuttuu @-merkki)', 'Osoitteesta puuttuu verkkotunnus @-merkin jälkeen', 'Osoitteesta puuttuu osa ennen @-merkkiä', 'Verkkotunnuksesta puuttuu pääte (esim. .fi)', 'Osoitteessa on useita @-merkkejä', 'ok']);
eq('PA To/Cc-rivi', em(PA('To: Mikko Laine <m@valio.fi>, Cc: Sari <s@valio.fi>\nBcc: x@y.fi')), ['m@valio.fi', 's@valio.fi', 'x@y.fi']);
eq('PA mailto ja kulmasulut ilman nimeä', em(PA('mailto:a@b.fi <c@d.fi> (e@f.fi),')), ['a@b.fi', 'c@d.fi', 'e@f.fi']);
eq('PA tyhjä ja välilyönnit', [PA('').length, PA('  \n ; , ').length], [0, 0]);
eq('PA nimi ilman kulmasulkeita', PA('Mikko Laine mikko@valio.fi').map(e => [e.name, e.email]), [['Mikko Laine', 'mikko@valio.fi']]);
eq('PA kaksi nimeä+osoitetta samalla rivillä', PA('Ville <v@a.fi> Pekka <p@b.fi>').map(e => e.email), ['v@a.fi', 'p@b.fi']);
const NA = X.nameFromAddress;
eq('nimi pisteestä', NA('mikko.laine@valio.fi'), 'Mikko Laine');
eq('nimi väliviivasta ja numerosta', NA('anna-liisa.virtanen2@x.fi'), 'Anna-Liisa Virtanen');
eq('nimi roolista ja plus-tagista', [NA('rekry@valio.fi'), NA('info+cv@x.fi'), NA('Matti_Meikäläinen@X.FI')], ['Rekry', 'Info', 'Matti Meikäläinen']);
eq('yritys domainista', [PA('rekry@valio.fi')[0].company, PA('x@gmail.com')[0].company, PA('x@outlook.com')[0].company, PA('x@hotmail.com')[0].company, PA('x@icloud.com')[0].company, PA('x@yahoo.com')[0].company, PA('x@live.com')[0].company, PA('x@msn.com')[0].company, PA('a@mail.kesko.fi')[0].company], ['Valio', '', '', '', '', '', '', '', 'Kesko']);
// suunnitelma
const chatsP = { c1: { name: 'Valio – myyntiassistentti', company: 'Valio', members: [{ name: 'Heli', emails: ['heli@valio.fi'], phones: [] }] } };
const pl1 = X.planEmailChats(PA('heli@valio.fi, mikko.laine@valio.fi, sari@kesko.fi, ville@kesko.fi, jussi@gmail.com, pekka@gmail.com, huono@'), 'company', chatsP);
eq('plan company: tunnettu ohitetaan, domainin chatiin lisätään', [pl1.known, pl1.invalid, pl1.added, pl1.newChats], [1, 1, 1, 3]);
eq('plan company: Kesko yhteen, gmailit erikseen', pl1.groups.filter(g => g.kind === 'new').map(g => [g.name, g.members.length]), [['Kesko', 2], ['Jussi', 1], ['Pekka', 1]]);
const pl2 = X.planEmailChats(PA('mikko.laine@valio.fi, sari@kesko.fi, ville@kesko.fi'), 'person', chatsP, { 'mikko.laine@valio.fi': 'new' });
eq('plan person + valinta uusi', [pl2.newChats, pl2.added, pl2.groups.map(g => g.name)], [3, 0, ['Mikko Laine', 'Sari', 'Ville']]);
const pl3 = X.planEmailChats(PA('mikko.laine@valio.fi'), 'person', chatsP);
eq('plan: domainin chat tarjotaan oletuksena', [pl3.rows[0].domainChatId, pl3.rows[0].choice, pl3.newChats, pl3.added], ['c1', 'addto', 0, 1]);

// ---- Gmail ----
const GQ = X.gmailQueryForChat;
const gch = { members: [{ emails: ['Anna.Testi@valio.example.fi', 'kolmas@gmail.com'] }, { emails: ['anna.testi@valio.example.fi', 'bob@kesko.example.fi'] }] };
const gq = GQ(gch);
eq('Gmail query: kaikki osoitteet from/to/cc', ['from:anna.testi@valio.example.fi', 'to:anna.testi@valio.example.fi', 'cc:anna.testi@valio.example.fi', 'from:kolmas@gmail.com', 'cc:bob@kesko.example.fi'].every(t => gq.includes(t)), true);
eq('Gmail query: domain vain ei-ilmaisille', [gq.includes('from:valio.example.fi'), gq.includes('to:kesko.example.fi'), gq.includes('from:gmail.com'), gq.includes('to:gmail.com')], [true, true, false, false]);
eq('Gmail query: sulut ja -in:chats, ei duplikaatteja', [/^\(.*\) -in:chats$/.test(gq), gq.split('from:anna.testi@valio.example.fi').length], [true, 2]);
eq('Gmail query: tyhjä kun ei osoitteita', [GQ({ members: [{ emails: [] }, { emails: ['ei-osoite'] }] }), GQ({}), GQ(null)], ['', '', '']);
eq('FREE_MAIL sisältää vaaditut', ['gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.fi', 'outlook.com', 'live.com', 'msn.com', 'yahoo.com', 'icloud.com', 'me.com', 'suomi24.fi', 'luukku.com', 'kolumbus.fi'].every(d => X.FREE_MAIL.has(d)), true);
const SQ = X.stripQuotedMail;
eq('stripQuoted: Outlook suomi', SQ('Hei Eero,\n\nkiitos viestistä.\n\n________________________________\nLähettäjä: Eero Esimerkki <eero@example.fi>\nLähetetty: 3. marraskuuta 2026 9.12\nAihe: Hakemus\n\nVanha viesti'), 'Hei Eero,\n\nkiitos viestistä.');
eq('stripQuoted: Gmail On..wrote', SQ('Sounds good.\n\nOn Tue, 3 Nov 2026 at 09:12, Anna Testi <anna@example.fi> wrote:\n> Vanha\n> viesti'), 'Sounds good.');
eq('stripQuoted: kirjoitti', SQ('Kiitos!\n\nti 3. marrask. 2026 klo 9.12 Anna Testi <anna@example.fi> kirjoitti:\n> vanha'), 'Kiitos!');
eq('stripQuoted: Original Message + From-rivi tyhjän jälkeen', [SQ('Moi\n-----Original Message-----\nFrom: a@example.fi\nvanha'), SQ('Moi\n\nFrom: a@example.fi\nSent: x\nvanha')], ['Moi', 'Moi']);
eq('stripQuoted: lopun >-rivit ja [undefined]', SQ('[undefined]\nRivi yksi\n[undefined]\nRivi kaksi\n\n> lainaus\n> lisää'), 'Rivi yksi\nRivi kaksi');
eq('stripQuoted: pelkkä lainaus -> alkuperäinen', SQ('On Tue, 3 Nov 2026 at 09:12, X <x@example.fi> wrote:\n> vanha'), 'On Tue, 3 Nov 2026 at 09:12, X <x@example.fi> wrote:');
eq('stripQuoted: raja 20 000', [SQ('a'.repeat(30000)).length, SQ('abcdef', 3)], [20000, 'abc']);
eq('stripQuoted: "kirjoitti" ilman päivämäärää ei leikkaa', SQ('Hän sanoi ensin.\nSitten Mikko kirjoitti:\nMuuta tekstiä.'), 'Hän sanoi ensin.\nSitten Mikko kirjoitti:\nMuuta tekstiä.');
const gm = { id: '18f3A-bc/9', threadId: 't1', internalDate: '1793689973000', date: '2026-11-03T07:12:53Z', labelIds: ['INBOX'], sender: 'Anna.Testi@Valio.Example.fi', toRecipients: ['eero@example.fi'], ccRecipients: ['x@example.fi', 'eero@example.fi'], addressDisplayNames: [{ displayName: 'Anna Testi', emailAddress: 'anna.testi@valio.example.fi' }], subject: 'Haastattelu', snippet: 'snip', plaintextBody: 'Hei!\n\nOn Tue, 3 Nov 2026 at 09:12, E <eero@example.fi> wrote:\n> vanha', attachments: [{ filename: 'cv.pdf', mimeType: 'application/pdf' }] };
const am = X.gmailMsgToAppMsg(gm, ['eero@example.fi']);
eq('map: in-viesti', [am.dir, am.channel, am.from, am.fromName, am.to, am.subject, am.body, am.source, am.gmail, am.attachments], ['in', 'email', 'anna.testi@valio.example.fi', 'Anna Testi', ['eero@example.fi', 'x@example.fi'], 'Haastattelu', 'Hei!', 'gmail', { messageId: '18f3A-bc/9', threadId: 't1' }, ['cv.pdf']]);
eq('map: at internalDate-millisekunneista (ISO)', am.at, new Date(1793689973000).toISOString());
eq('map: id siivottu', [am.id, X.gmailDocId('a.b c'), /^[A-Za-z0-9_-]+$/.test(am.id)], ['gm-18f3A-bc_9', 'gm-a_b_c', true]);
eq('map: SENT-label -> out', X.gmailMsgToAppMsg(Object.assign({}, gm, { labelIds: ['SENT'] }), []).dir, 'out');
eq('map: oma osoite (isot kirjaimet) -> out', X.gmailMsgToAppMsg(Object.assign({}, gm, { sender: 'EERO@example.fi', labelIds: [] }), new Set(['eero@example.fi'])).dir, 'out');
eq('map: at date-kentästä kun internalDate puuttuu, null jos ei kumpaakaan', [X.gmailMsgToAppMsg(Object.assign({}, gm, { internalDate: undefined }), []).at, X.gmailMsgToAppMsg(Object.assign({}, gm, { internalDate: undefined, date: undefined }), [])], ['2026-11-03T07:12:53.000Z', null]);
eq('map: body snippet-varalla', X.gmailMsgToAppMsg(Object.assign({}, gm, { plaintextBody: undefined }), []).body, 'snip');
const E = X.gmailErrorInfo;
eq('virheet: tekstit', ['needs_reauth', 'server_not_connected', 'selection_required', 'blocked_by_policy'].map(c => E({ code: c }).text), [
  'Gmail-yhteys vanhentui. Yhdistä Gmail uudelleen: claude.ai → Asetukset → Yhdistäjät.', 'Gmail ei ole yhdistetty. Lisää se: claude.ai → Asetukset → Yhdistäjät.',
  'Valitse käytettävä Gmail-tili claude.ai:n kehotteesta.', 'Organisaation asetukset estävät tämän.']);
eq('virheet: luvat', [E({ code: 'not_in_manifest' }), E({ code: 'approval_required' })].map(e => [e.text, e.openPerms, e.retry]), [['Gmail-lupa puuttuu tältä sivulta.', true, false], ['Gmail-lupa puuttuu tältä sivulta.', true, true]]);
eq('virheet: tool_error näyttää viestin, default näyttää koodin', [E({ code: 'tool_error', message: 'Huono <b>haku</b>' }).text, E({ code: 'weird' }).text], ['Huono <b>haku</b>', 'Gmail-virhe: weird']);
eq('virheet: pois käytöstä -ja epävarmat', [E({ code: 'not_granted' }).unavailable, E({ code: 'capability_removed' }).unavailable, E({ code: 'server_unavailable' }).uncertain, E({ code: 'upstream_error' }).uncertain, E({ code: 'cancelled' }).uncertain, E({ code: 'needs_reauth' }).uncertain], [true, true, true, true, true, false]);
eq('replySubject', [X.replySubject('Hakemus'), X.replySubject('Re: Re: VS: Hakemus'), X.replySubject('VS: Hakemus'), X.replySubject('')], ['Re: Hakemus', 'Re: Hakemus', 'Re: Hakemus', '']);

// ---- Työpaikkakeskustelujen etsintä ----
const mk = (id, msgs) => ({ id, messages: msgs });
const dm = (sender, to, o) => Object.assign({ id: id9++, threadId: 'x', sender, toRecipients: to, ccRecipients: [], addressDisplayNames: [], labelIds: ['INBOX'], date: '2026-10-20T10:00:00Z', subject: '' }, o || {});
let id9 = 1;
const OWN = new Set(['oma@gmail.com', 'oma.toinen@gmail.com']);
const dth = [
  mk('t1', [dm('rekry@valio.example.fi', ['oma@gmail.com'], { subject: 'Hakemuksesi vastaanotettu', date: '2026-10-01T10:00:00Z', addressDisplayNames: [{ displayName: 'Heli Ranta', emailAddress: 'rekry@valio.example.fi' }] }), dm('oma@gmail.com', ['rekry@valio.example.fi'], { labelIds: ['SENT'], subject: 'Re: Hakemuksesi vastaanotettu', date: '2026-10-02T10:00:00Z' })]),
  mk('t2', [dm('mikko.laine@valio.example.fi', ['oma@gmail.com', 'oma.toinen@gmail.com'], { subject: 'Haastattelu', date: '2026-10-10T10:00:00Z', ccRecipients: ['sari@valio.example.fi'] })]),
  mk('t3', [dm('noreply@kesko.example.fi', ['oma@gmail.com'], { subject: 'Kiitos hakemuksestasi', date: '2026-10-05T10:00:00Z' })]),
  mk('t4', [dm('kaveri@gmail.com', ['oma@gmail.com'], { subject: 'Illalla?', date: '2026-10-12T10:00:00Z', addressDisplayNames: [{ displayName: 'Kaveri', emailAddress: 'kaveri@gmail.com' }] })]),
  mk('t5', [dm('toinen.kaveri@gmail.com', ['oma@gmail.com'], { subject: 'Moi', date: '2026-10-13T10:00:00Z' })]),
  mk('t6', [dm('noreply@gmail.com', ['oma@gmail.com'], { subject: 'Turvallisuusilmoitus', date: '2026-10-14T10:00:00Z' })]),
  mk('t7', [dm('myynti@kauppa.example.fi', ['oma@gmail.com'], { subject: 'Tilaus 123 kuitti', date: '2026-09-01T10:00:00Z' })])
];
const grp = X.discoverCounterparts(dth, OWN);
const gv = grp.find(g => g.key === 'valio.example.fi');
eq('discover: ryhmittely domainin mukaan, järjestys uusin ensin', [grp.map(g => g.key).slice(0, 2), gv.count, gv.threadIds.sort(), gv.lastAt], [['valio.example.fi', 'toinen.kaveri@gmail.com'].slice(0, 0).length ? [] : grp.map(g => g.key).slice(0, 2), 2, ['t1', 't2'], '2026-10-10T10:00:00.000Z']);
eq('discover: omat osoitteet pois, jäsenet ja nimet', [gv.addresses.map(a => a.email).sort(), gv.addresses.find(a => a.email === 'rekry@valio.example.fi').name, gv.sentByMe, gv.automationOnly], [['mikko.laine@valio.example.fi', 'rekry@valio.example.fi', 'sari@valio.example.fi'], 'Heli Ranta', 1, false]);
eq('discover: ilmaiset postit osoitteittain', [grp.some(g => g.key === 'kaveri@gmail.com' && g.domain === '' && g.free), grp.some(g => g.key === 'toinen.kaveri@gmail.com'), grp.some(g => g.key === 'gmail.com')], [true, true, false]);
const gk = grp.find(g => g.key === 'kesko.example.fi');
eq('discover: noreply lasketaan domainiin mutta ei jäseneksi', [gk.count, gk.automationOnly, gk.addresses.map(a => a.email), gk.subjects], [1, true, ['noreply@kesko.example.fi'], ['Kiitos hakemuksestasi']]);
eq('discover: ilmaisen postin automaatio pudotetaan', grp.some(g => g.key === 'noreply@gmail.com'), false);
eq('discover: aiheet viimeisimmät ensin, max 5', X.discoverCounterparts([mk('a', [dm('a@x.example.fi', ['oma@gmail.com'], { subject: 'Vanha', date: '2026-01-01T00:00:00Z' })]), mk('b', [dm('a@x.example.fi', ['oma@gmail.com'], { subject: 'Uusi', date: '2026-02-01T00:00:00Z' })])], OWN)[0].subjects, ['Uusi', 'Vanha']);
eq('discover: tyhjä ja viallinen syöte', [X.discoverCounterparts([], OWN).length, X.discoverCounterparts(null, OWN).length, X.discoverCounterparts([{ id: 'z', messages: [] }], OWN).length], [0, 0, 0]);
eq('discover: oma-osoite taulukkona (isot kirjaimet)', X.discoverCounterparts([mk('q', [dm('OMA@gmail.com', ['a@y.example.fi'], { labelIds: [] })])], ['oma@gmail.com'])[0].addresses.map(a => a.email), ['a@y.example.fi']);
const WS = X.workScore;
eq('workScore: työpaikka', [WS(gv), X.isWorkGroup(gv), WS(gk) >= 2], [4, true, true]);
eq('workScore: kaveri ja kauppa', [WS(grp.find(g => g.key === 'kaveri@gmail.com')), X.isWorkGroup(grp.find(g => g.key === 'kauppa.example.fi')), X.isWorkGroup(grp.find(g => g.key === 'kaveri@gmail.com'))], [0, false, false]);
eq('workScore: pelkkä ei-ilmainen domain ei riitä, kaksi pistettä riittää', [WS({ domain: 'x.example.fi', subjects: ['Moi'], sentByMe: 0 }), X.isWorkGroup({ domain: 'x.example.fi', subjects: ['Moi'], sentByMe: 1 }), WS({ domain: '', subjects: ['Job offer: kassa'], sentByMe: 0 })], [1, true, 2]);
eq('workScore: uutiskirje vie pisteet', WS({ domain: 'x.example.fi', subjects: ['Uutiskirje: hakemus tarjous'], sentByMe: 1 }), 1);
eq('groupCompany', [X.groupCompany(gv), X.groupCompany(grp.find(g => g.key === 'kaveri@gmail.com'))], ['Valio', 'Kaveri']);
const DQ = X.discoveryQueries('2y');
eq('queries: A ja B', [DQ.A, DQ.B.startsWith('-in:sent -in:chats category:primary newer_than:2y ('), DQ.B.includes('hakemus OR hakemuksesi') && DQ.B.includes('"job offer")'), X.discoveryQueries('all').A, X.periodTerm('6m'), X.periodTerm('1y')], ['in:sent -in:chats newer_than:2y', true, true, 'in:sent -in:chats', 'newer_than:6m', 'newer_than:1y']);
eq('connected account', [X.connectedAccountFromThreads([mk('s', [dm('Oma@Gmail.com', ['a@b.fi'], { labelIds: ['SENT'] })])]), X.connectedAccountFromThreads([mk('s', [dm('a@b.fi', ['oma@gmail.com'])])]), X.connectedAccountFromThreads(null)], ['oma@gmail.com', '', '']);
const dChats = { c1: { name: 'Valio', company: 'Valio', members: [{ emails: ['heli@valio.example.fi'] }] }, c2: { name: 'Muu', company: '', members: [{ emails: ['x@kauppa.example.fi'] }] } };
eq('matchExistingChat: osoite, domain, yritys, ei', [X.matchExistingChat({ addresses: [{ email: 'heli@valio.example.fi' }], domain: 'valio.example.fi' }, dChats), X.matchExistingChat({ addresses: [{ email: 'uusi@valio.example.fi' }], domain: 'valio.example.fi' }, dChats), X.matchExistingChat({ addresses: [{ email: 'a@kauppa.example.fi' }], domain: 'kauppa.example.fi' }, dChats), X.matchExistingChat({ addresses: [{ email: 'a@uusi.example.fi' }], domain: 'uusi.example.fi' }, dChats), X.matchExistingChat({ addresses: [{ email: 'k@gmail.com' }], domain: '' }, dChats)], ['c1', 'c1', 'c2', null, null]);
eq('isAutomationAddr', ['noreply@x.fi', 'no-reply@x.fi', 'DoNotReply@x.fi', 'mailer-daemon@x.fi', 'rekry@x.fi', 'info@x.fi'].map(X.isAutomationAddr), [true, true, true, true, false, false]);

// ---- Työpaikkahakupalvelut, ATS ja uutiskirjeet ----
const mk2 = (id, msgs) => ({ id, messages: msgs });
let id8 = 100;
const dm2 = (sender, to, o) => Object.assign({ id: 'z' + id8++, threadId: 'x', sender, toRecipients: to, ccRecipients: [], addressDisplayNames: [], labelIds: ['INBOX'], date: '2026-10-20T10:00:00Z', subject: '' }, o || {});
const OWN2 = new Set(['oma@gmail.com']);
const alertThreads = Array.from({ length: 30 }, (_, i) => mk2('al' + i, [dm2('alerts@duunitori.fi', ['oma@gmail.com'], { subject: 'Duunitori löysi sinulle ' + (i + 3) + ' työpaikkaa – rekrytoi nyt!', date: '2026-10-' + String(1 + (i % 28)).padStart(2, '0') + 'T08:00:00Z' })]));
const liThreads = [mk2('li1', [dm2('jobs-noreply@mail.linkedin.com', ['oma@gmail.com'], { subject: 'Uusia työpaikkoja sinulle: interview' })])];
const atsThreads = [
  mk2('k1', [dm2('noreply@kuntarekry.fi', ['oma@gmail.com'], { subject: 'Kiitos hakemuksestasi', addressDisplayNames: [{ displayName: 'Kuntarekry / Esimerkkikaupunki', emailAddress: 'noreply@kuntarekry.fi' }] })]),
  mk2('k2', [dm2('noreply@kuntarekry.fi', ['oma@gmail.com'], { subject: 'Kiitos hakemuksestasi', addressDisplayNames: [{ displayName: 'Kuntarekry / Toinenkaupunki', emailAddress: 'noreply@kuntarekry.fi' }] })]),
  mk2('k3', [dm2('noreply@teamtailor.com', ['oma@gmail.com'], { subject: 'Application received', addressDisplayNames: [{ displayName: 'Esimerkkifirma Careers', emailAddress: 'noreply@teamtailor.com' }] })])
];
const nlThreads = Array.from({ length: 6 }, (_, i) => mk2('nl' + i, [dm2('vahti@tyovahti.example.fi', ['oma@gmail.com'], { subject: 'Uusia työpaikkoja: rekrytoi nyt ' + i })]));
const empThreads = Array.from({ length: 6 }, (_, i) => mk2('em' + i, [dm2('info@tyonantaja.example.fi', ['oma@gmail.com'], { subject: 'Työvuorot viikolle ' + i }), dm2('oma@gmail.com', ['info@tyonantaja.example.fi'], { labelIds: ['SENT'], subject: 'Re: Työvuorot viikolle ' + i })]));
const g2 = X.discoverCounterparts([].concat(alertThreads, liThreads, atsThreads, nlThreads, empThreads), OWN2);
const gb = g2.find(g => g.key === 'duunitori.fi'), gl = g2.find(g => g.domain === 'mail.linkedin.com');
eq('JOB_BOARDS + ATS_DOMAINS sisältävät vaaditut', [['duunitori.fi', 'linkedin.com', 'jobly.fi', 'monster.fi', 'monster.com', 'indeed.com', 'indeedemail.com', 'oikotie.fi', 'glassdoor.com', 'tyomarkkinatori.fi', 'te-palvelut.fi', 'mol.fi', 'jobindex.dk', 'stepstone.fi'].every(d => X.JOB_BOARDS.has(d)), ['kuntarekry.fi', 'varbi.com', 'teamtailor.com', 'reachmee.com', 'smartrecruiters.com', 'myworkday.com', 'lyyti.fi'].every(d => X.ATS_DOMAINS.has(d)), X.JOB_BOARDS.has('kuntarekry.fi')], [true, true, false]);
const DQb = X.discoveryQueries('1y');
eq('Kysely B: -from jokaiselle hakupalvelulle, A ei, ATS ei pois', [[...X.JOB_BOARDS].every(d => DQb.B.includes(' -from:' + d)), DQb.A.includes('-from:'), DQb.B.includes('-from:kuntarekry.fi'), DQb.B.includes('"job offer") -from:duunitori.fi')], [true, false, false, true]);
eq('hakupalvelu: ryhmä jobBoard, work=false, pisteet < 0', [gb.jobBoard, gb.count, X.isWorkGroup(gb), X.workScore(gb) < 0, gb.ats], [true, 30, false, true, false]);
eq('hakupalvelu aliverkkotunnus (mail.linkedin.com) tunnistetaan', [gl.jobBoard, X.isWorkGroup(gl)], [true, false]);
eq('hakupalvelu ei koskaan työ, vaikka sentByMe tai avainsanat', X.isWorkGroup({ domain: 'duunitori.fi', jobBoard: true, subjects: ['hakemus haastattelu'], sentByMe: 3, count: 1, addresses: [] }), false);
const ga = g2.filter(g => g.ats);
eq('ATS: ryhmä per lähettäjä+näyttönimi, työtä, yritys nimestä', [ga.length, ga.map(g => X.groupCompany(g)).sort(), ga.every(g => X.isWorkGroup(g) && g.key.startsWith('ats:'))], [3, ['Esimerkkifirma Careers', 'Esimerkkikaupunki', 'Toinenkaupunki'], true]);
eq('ATS: ei ole hakupalvelu eikä uutiskirje', ga.every(g => !g.jobBoard && !g.newsletterLike), true);
const gn = g2.find(g => g.key === 'tyovahti.example.fi'), ge = g2.find(g => g.key === 'tyonantaja.example.fi');
eq('uutiskirjemäinen ei-hakupalvelu (6 ketjua + työsana) -> ei työtä', [gn.count, gn.newsletterLike, X.isWorkGroup(gn), X.workScore(gn)], [6, true, false, -1]);
eq('työnantaja jolle olet vastannut ei saa uutiskirjerangaistusta', [ge.sentByMe, ge.newsletterLike, X.isWorkGroup(ge)], [6, false, true]);
eq('uutiskirje vaatii vähintään 5 ketjua', [X.isWorkGroup({ domain: 'x.example.fi', subjects: ['Uusia työpaikkoja rekrytoi'], sentByMe: 0, count: 4, addresses: [{ email: 'news@x.example.fi' }] }), X.workScore({ domain: 'x.example.fi', subjects: ['Uusia työpaikkoja rekrytoi'], sentByMe: 0, count: 5, addresses: [{ email: 'news@x.example.fi' }] })], [true, -1]);
eq('chat-kysely: ATS-osoite rajataan yrityksellä, ei domain-termejä', [X.gmailQueryForChat({ company: 'Esimerkkikaupunki', members: [{ emails: ['noreply@kuntarekry.fi'] }] }), X.gmailQueryForChat({ company: '', members: [{ emails: ['noreply@kuntarekry.fi'] }] })], ['((from:noreply@kuntarekry.fi "Esimerkkikaupunki")) -in:chats', '(from:noreply@kuntarekry.fi OR to:noreply@kuntarekry.fi OR cc:noreply@kuntarekry.fi) -in:chats']);
eq('chat-kysely: hakupalvelun domainia ei haeta kokonaan', X.gmailQueryForChat({ members: [{ emails: ['alerts@duunitori.fi'] }] }).includes('from:duunitori.fi'), false);
const atsChats = { c1: { name: 'Esimerkkikaupunki', company: 'Esimerkkikaupunki', members: [{ emails: ['noreply@kuntarekry.fi'] }] }, c2: { name: 'Toinen', company: '', members: [{ emails: ['x@kuntarekry.fi'] }] } };
eq('matchExistingChat: ATS vain yrityksen nimellä', [X.matchExistingChat(ga.find(g => X.groupCompany(g) === 'Esimerkkikaupunki'), atsChats), X.matchExistingChat(ga.find(g => X.groupCompany(g) === 'Toinenkaupunki'), atsChats), X.matchExistingChat(gb, atsChats)], ['c1', null, null]);
{ // saman yrityksen eri rekrytoijat (teamtailor-mail.com-aliverkkotunnus) yhdistyvät yhdeksi työpaikaksi
  const tt = X.discoverCounterparts([
    { id: 't1', messages: [{ id: 'm1', threadId: 't1', sender: 'no-reply@esim.teamtailor-mail.com', toRecipients: ['oma@gmail.com'], addressDisplayNames: [{ displayName: 'Esimerkki Oy', emailAddress: 'no-reply@esim.teamtailor-mail.com' }], subject: 'Kiitos hakemuksestasi', date: '2026-03-01T10:00:00Z', labelIds: ['INBOX'] }] },
    { id: 't2', messages: [{ id: 'm2', threadId: 't2', sender: 'maija.m@esim.teamtailor-mail.com', toRecipients: ['oma@gmail.com'], addressDisplayNames: [{ displayName: 'Maija M - Esimerkki Oy', emailAddress: 'maija.m@esim.teamtailor-mail.com' }], subject: 'Haastattelu', date: '2026-03-05T10:00:00Z', labelIds: ['INBOX'] }] },
    { id: 't3', messages: [{ id: 'm3', threadId: 't3', sender: 'noreply@msg.jobylon.com', toRecipients: ['oma@gmail.com'], addressDisplayNames: [{ displayName: 'Kauppa-ryhmä', emailAddress: 'noreply@msg.jobylon.com' }], subject: 'Hakemuksesi', date: '2026-03-06T10:00:00Z', labelIds: ['INBOX'] }] }
  ], OWN);
  const e = tt.find(g => X.groupCompany(g) === 'Esimerkki Oy');
  eq('ATS: rekrytoijat yhdistyvät ja jobylon tunnistetaan', [tt.length, e && e.threadIds.length, e && e.ats, X.isWorkGroup(e), X.groupCompany(tt.find(g => g !== e))], [2, 2, true, true, 'Kauppa-ryhmä']);
}

{ // findSentMatch / mailtoHref
  const T0 = Date.parse('2026-11-01T10:00:00Z');
  const mk = (o) => Object.assign({ id: 'm1', threadId: 't1', internalDate: String(T0), labelIds: ['SENT'], toRecipients: ['rekry@valio.fi'], subject: 'Hakemus', snippet: '' }, o);
  const F = (msgs, q) => X.findSentMatch([{ id: 't1', messages: msgs }], Object.assign({ to: 'rekry@valio.fi', subject: 'Hakemus', body: 'Kiitos paljon haastattelukutsusta, tulen mielelläni!', sinceMs: T0 }, q));
  eq('findSentMatch: snippet match', F([mk({ snippet: 'Kiitos paljon haastattelukutsusta, tulen mielelläni! On Mon wrote' })]), { id: 'm1', threadId: 't1' });
  eq('findSentMatch: short body -> subject match (Re: ignored)', F([mk({ subject: 'Re: Hakemus', snippet: 'Joo' })], { body: 'Kyllä', subject: 'VS: Hakemus' }), { id: 'm1', threadId: 't1' });
  eq('findSentMatch: wrong recipient -> null', F([mk({ toRecipients: ['muu@x.fi'], snippet: 'Kiitos paljon haastattelukutsusta, tulen mielelläni!' })]), null);
  eq('findSentMatch: too old -> null', F([mk({ internalDate: String(T0 - 600000), snippet: 'Kiitos paljon haastattelukutsusta, tulen mielelläni!' })]), null);
  eq('findSentMatch: within 2 min slack', F([mk({ internalDate: String(T0 - 60000), snippet: 'Kiitos paljon haastattelukutsusta, tulen mielelläni!' })]) !== null, true);
  eq('findSentMatch: Name <addr> recipient, case-insens., date fallback', F([mk({ internalDate: undefined, date: '2026-11-01T10:01:00Z', toRecipients: ['Heli Ranta <Rekry@Valio.fi>'], snippet: 'Kiitos paljon haastattelukutsusta, tulen mielelläni!' })]), { id: 'm1', threadId: 't1' });
  eq('findSentMatch: entities decoded', F([mk({ snippet: 'Se on &quot;hyv&auml;&quot; &amp; it&#39;s ok &#x41;' })], { body: 'Se on "hyv&auml;" & it\'s ok A' }) !== null || F([mk({ snippet: 'It&#39;s ok &amp; fine &lt;3 tästä &#228;' })], { body: "It's ok & fine <3 tästä ä" }) !== null, true);
  eq('findSentMatch: not SENT -> null; missing labelIds ok', [F([mk({ labelIds: ['INBOX'], snippet: 'Kiitos paljon haastattelukutsusta, tulen mielelläni!' })]), F([mk({ labelIds: undefined, snippet: 'Kiitos paljon haastattelukutsusta, tulen mielelläni!' })]) !== null], [null, true]);
  eq('findSentMatch: defensive on junk', [X.findSentMatch(null, {}), X.findSentMatch([{}, { messages: [null, {}] }], { to: 'a@b.fi', body: 'x' })], [null, null]);
  eq('mailtoHref: ä, space, newline, &, ?', X.mailtoHref('a@b.fi', 'Hei ä & ?', 'Rivi 1\nRivi 2 = x?y&z'), 'mailto:a@b.fi?subject=Hei%20%C3%A4%20%26%20%3F&body=Rivi%201%0D%0ARivi%202%20%3D%20x%3Fy%26z');
  eq('gmailComposeUrl: encodes to/su/body (ä, space, newline, &)', X.gmailComposeUrl('a@b.fi', 'Hei ä & ?', 'Rivi 1\nRivi 2'), 'https://mail.google.com/mail/?view=cm&fs=1&to=a%40b.fi&su=Hei%20%C3%A4%20%26%20%3F&body=Rivi%201%0ARivi%202');
  eq('gmailComposeUrl: empty', X.gmailComposeUrl(), 'https://mail.google.com/mail/?view=cm&fs=1&to=&su=&body=');
  { const P0 = Date.parse('2026-11-01T10:00:00Z'), pend = { at: '2026-11-01T10:00:00Z', body: 'Kiitos paljon haastattelukutsusta, tulen mielelläni!', subject: 'Re: Hakemus' };
    const G = o => Object.assign({ id: 'gm-1', dir: 'out', at: '2026-11-01T10:01:00Z', body: 'Kiitos paljon haastattelukutsusta, tulen mielelläni!\n\nTerveisin Eero', subject: 'Re: Hakemus' }, o);
    eq('matchPending: body match', (X.matchPending(pend, [G()]) || {}).id, 'gm-1');
    eq('matchPending: normalized (case, whitespace, entities) via snippet', (X.matchPending(pend, [G({ body: '', snippet: 'KIITOS  paljon haastattelukutsusta,\ntulen mielelläni! &amp; muuta' })]) || {}).id, 'gm-1');
    eq('matchPending: incoming ignored', X.matchPending(pend, [G({ dir: 'in' })]), null);
    eq('matchPending: too old -> null, within 2 min ok', [X.matchPending(pend, [G({ at: new Date(P0 - 300000).toISOString() })]), (X.matchPending(pend, [G({ at: new Date(P0 - 60000).toISOString() })]) || {}).id], [null, 'gm-1']);
    eq('matchPending: different body -> null', X.matchPending(pend, [G({ body: 'Aivan eri viesti kokonaan, ei täsmää' })]), null);
    eq('matchPending: short body -> subject match (Re: ignored)', (X.matchPending({ at: pend.at, body: 'Kyllä', subject: 'Hakemus' }, [G({ body: 'Joo', subject: 'VS: Hakemus' })]) || {}).id, 'gm-1');
    eq('matchPending: short body, other subject -> null', X.matchPending({ at: pend.at, body: 'Kyllä', subject: 'Hakemus' }, [G({ body: 'Joo', subject: 'Muu' })]), null);
    eq('matchPending: defensive on junk', [X.matchPending(null, null), X.matchPending({ body: 'x' }, [null, {}])], [null, null]); }
}


// ---- Biometrinen avaus: alustakohtaiset tekstit ----
{
  const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const AND = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
  const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
  eq('bioLabel: iPhone/iPad/Mac -> Face ID', [X.bioLabel(IOS), X.bioLabel('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), X.bioLabel(MAC)], ['Face ID', 'Face ID', 'Face ID']);
  eq('bioLabel: Android', X.bioLabel(AND), 'sormenjälki tai kasvojentunnistus');
  eq('bioLabel: other/empty', [X.bioLabel(WIN), X.bioLabel(''), X.bioLabel(undefined)], ['biometrinen tunnistus', 'biometrinen tunnistus', 'biometrinen tunnistus']);
  const bi = X.bioStrings(IOS), ba = X.bioStrings(AND), bo = X.bioStrings(WIN);
  eq('bioStrings iOS: button texts', [bi.on, bi.off, bi.unlock, bi.fail], ['Ota Face ID käyttöön', 'Poista Face ID käytöstä', 'Avaa Face ID:llä', 'Face ID -avaus epäonnistui. Kirjoita salasana.']);
  eq('bioStrings iOS: unsupported', bi.unsupported, 'Face ID ei ole käytettävissä tässä näkymässä. Toimii Safarissa tai Koti-valikkoon lisätyssä sovelluksessa (iOS 18 tai uudempi): avaa sivu Safarilla ja valitse Jaa → Lisää Koti-valikkoon.');
  eq('bioStrings offer: iOS + Android texts', [bi.offerTitle, bi.offerText, ba.offerTitle, /sormenjäljellä tai kasvojentunnistuksella ilman salasanaa./.test(ba.offerText)], ['Face ID käyttöön?', 'Avaa Hakuviestit jatkossa Face ID:llä ilman salasanaa. Salasana suojataan laitteen tunnistuksella eikä sitä tallenneta selväkielisenä.', 'Sormenjälki tai kasvojentunnistus käyttöön?', true]);
  eq('bioStrings Android: texts', [ba.on, ba.unlock, ba.unsupported], ['Ota sormenjälki tai kasvojentunnistus käyttöön', 'Avaa biometrisellä tunnistuksella', 'Sormenjälki tai kasvojentunnistus ei ole käytettävissä tässä näkymässä. Toimii Chromessa tai aloitusnäytölle lisätyssä sovelluksessa (Android 9 tai uudempi, Google Play -palvelut).']);
  eq('bioStrings other: label + no Face ID wording', [bo.on, bo.unlock, bo.fail.includes('Face ID')], ['Ota biometrinen tunnistus käyttöön', 'Avaa biometrisellä tunnistuksella', false]);
  { const bn = X.bioStrings(IOS, true), bna = X.bioStrings(AND, true);
    eq('bioStrings native iOS: unsupported text (no Safari/Koti-valikko)', bn.unsupported, 'Face ID ei ole käytettävissä. Ota Face ID käyttöön iPhonen asetuksista (Asetukset → Face ID ja pääsykoodi).');
    ok('bioStrings native: no Safari/Koti-valikko anywhere', !/Safari|Koti-valikko/.test(JSON.stringify([bn, bna])));
    eq('bioStrings native iOS: invalidated text', bn.invalidated, 'Face ID -avaus ei ole enää käytössä. Avaa salasanalla ja ota Face ID uudelleen käyttöön Tietosuoja-osiossa.');
    eq('bioStrings native: other texts unchanged vs web', [bn.on, bn.off, bn.unlock, bn.fail, bn.offerTitle], [bi.on, bi.off, bi.unlock, bi.fail, bi.offerTitle]); }
  ok('bioStrings Android/other: no Face ID mentioned anywhere', !JSON.stringify([ba, bo]).includes('Face ID'));
  // ---- Suojausvinkit alustan mukaan ----
  const tI = X.secTips(IOS), tA = X.secTips(AND), tU = X.secTips(WIN);
  eq('secTips iPhone: one group, 6 tips, no Android items', [tI.length, tI[0].title, tI[0].items.length, JSON.stringify(tI).includes('Play Protect')], [1, '', 6, false]);
  ok('secTips iPhone: exact first and last tip', tI[0].items[0] === 'Laita päälle Varastetun laitteen suojaus: Asetukset → Face ID ja pääsykoodi.' && tI[0].items[5] === 'Lukitustila (Lockdown Mode) vain, jos epäilet kohdennettua hyökkäystä.');
  eq('secTips Android: one group, 7 tips, no iPhone items', [tA.length, tA[0].items.length, JSON.stringify(tA).includes('App Store'), JSON.stringify(tA).includes('Lockdown')], [1, 7, false, false]);
  ok('secTips Android: Play Protect + Theft protection', tA[0].items[0] === 'Laita päälle varkaussuoja: Asetukset → Google → Kaikki palvelut → Varkaussuoja (Theft protection).' && tA[0].items[2] === 'Pidä Play Protect päällä: Play Kauppa → profiilikuva → Play Protect.');
  eq('secTips unknown: both lists with iPhone/Android headings', [tU.map(g => g.title).join(), tU[0].items.length, tU[1].items.length], ['iPhone,Android', 6, 7]);
}
// ---- Avauksen jarrutus ----
eq('unlockDelayMs: 0-4 failures free', [0, 1, 2, 3, 4].map(X.unlockDelayMs), [0, 0, 0, 0, 0]);
eq('unlockDelayMs: 5 -> 30 s, doubling', [5, 6, 7, 8].map(X.unlockDelayMs), [30000, 60000, 120000, 240000]);
eq('unlockDelayMs: cap at 15 min', [10, 11, 12, 50, 1e9].map(X.unlockDelayMs), [900000, 900000, 900000, 900000, 900000]);
eq('unlockDelayMs: junk input', [X.unlockDelayMs(undefined), X.unlockDelayMs(-3), X.unlockDelayMs('x')], [0, 0, 0]);
// ---- Linkit viesteissä ----
{
  const L = X.safeLink;
  eq('safeLink: https host lowercased', (({ kind, host }) => ({ kind, host }))(L('HTTPS://Example.COM/Path?x=1')), { kind: 'web', host: 'example.com' });
  eq('safeLink: port and userinfo -> real host', (({ host, port, userinfo }) => ({ host, port, userinfo }))(L('https://paypal.com@evil.example:8443/x')), { host: 'evil.example', port: '8443', userinfo: true });
  eq('safeLink: javascript/data/vbscript/file/blob rejected', ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x', 'file:///etc/passwd', 'blob:https://x/y', 'ftp://x.fi', '//evil.example', 'http:/x'].map(L), [null, null, null, null, null, null, null, null, null]);
  eq('safeLink: whitespace/control chars/quotes rejected', [L('https://exa mple.com'), L('https://x.fi/\u0001'), L('https://x.fi/"onmouseover=1')], [null, null, null]);
  eq('safeLink: mailto + tel ok, bad ones null', [(L('mailto:eero@example.fi?subject=Hei') || {}).kind, (L('tel:+358401234567') || {}).kind, L('mailto:ei-osoite'), L('tel:abc')], ['mail', 'tel', null, null]);
  ok('safeLink: idn flag for punycode and unicode hosts', L('https://xn--pypal-4ve.com/').idn === true && L('https://pаypal.com/').idn === true && L('https://paypal.com/').idn === false);
  eq('safeLink: ipv6 host', L('http://[::1]:80/x').host, '[::1]');
  const seg = t => X.linkifyText(t).map(x => x.t === 'link' ? 'L:' + x.link.kind + ':' + x.s : 'T:' + x.s);
  eq('linkifyText: plain text unchanged', seg('Ei linkkejä tässä.'), ['T:Ei linkkejä tässä.']);
  eq('linkifyText: https link, trailing punctuation excluded', seg('Katso https://example.com/a. Kiitos'), ['T:Katso ', 'L:web:https://example.com/a', 'T:. Kiitos']);
  eq('linkifyText: <url> and (url) wrappers', seg('Linkki <https://example.com/x> ja (https://example.org/y)'), ['T:Linkki <', 'L:web:https://example.com/x', 'T:> ja (', 'L:web:https://example.org/y', 'T:)']);
  eq('linkifyText: javascript:/data: stay plain text, not clickable', seg('klikkaa javascript:alert(1) tai data:text/html,x'), ['T:klikkaa javascript:alert(1) tai data:text/html,x']);
  eq('linkifyText: markdown link with javascript: url is plain text', seg('[Avaa](javascript:alert(1)) ja [ok](https://example.com/)'), ['T:[Avaa](javascript:alert(1)) ja ', 'L:web:ok']);
  eq('linkifyText: mailto + tel', seg('mailto:a@b.fi tai tel:+358401234567'), ['L:mail:mailto:a@b.fi', 'T: tai ', 'L:tel:tel:+358401234567']);
  const ph = X.linkifyText('Vahvista: paypal.com <https://secure-paypal.evil.example/login>').find(x => x.t === 'link');
  eq('phishing: label text differs from real host -> mismatch reported', [ph.label, ph.link.host, X.linkMismatch(ph.label, ph.link)], ['paypal.com', 'secure-paypal.evil.example', 'paypal.com']);
  const md = X.linkifyText('[https://www.nordea.fi](https://nordea-login.evil.example/)').find(x => x.t === 'link');
  eq('phishing: markdown label with other domain', [md.link.host, X.linkMismatch(md.label, md.link)], ['nordea-login.evil.example', 'www.nordea.fi']);
  eq('linkMismatch: same host or subdomain -> empty; non-url label -> empty', [X.linkMismatch('example.com', L('https://www.example.com/x')), X.linkMismatch('https://example.com', L('https://example.com/y')), X.linkMismatch('Klikkaa tästä', L('https://evil.example/'))], ['', '', '']);
  eq('linkMismatch: look-alike suffix is a mismatch', X.linkMismatch('paypal.com', L('https://paypal.com.evil.example/')), 'paypal.com');
}
// ---- Lähetysdiagnostiikka ----
{
  const R = X.redactDiag;
  eq('redactDiag: emails -> <email>', R('Invalid to: eero.virtanen@example.fi and "x@y.com", <a@b.fi>', 400), 'Invalid to: <email> and "<email>", <<email>>');
  eq('redactDiag: no @ survives (encoded variants too)', /@|%40/i.test(R('a%40b.fi c@d.fi e' + String.fromCharCode(92) + 'u0040f.fi', 400)), false);
  eq('redactDiag: truncation after redaction', [R('x'.repeat(50) + ' a@b.fi', 10).length, R('abc@example.com ' + 'y'.repeat(500), 400).length], [10, 400]);
  eq('redactDiag: junk input', [R(null, 10), R(undefined, 10), R(123, 10)], ['', '', '123']);
  eq('redactDiag: secrets (body/subject) removed, short ones ignored', R('Virhe: Kiitos paljon viestistä, nähdään! ok', 400, ['Kiitos paljon viestistä, nähdään!', 'ok']), 'Virhe: <removed> ok');
  const D = X.buildSendDiag({ attempt: 'reply', tool: 'reply', at: '2026-11-01T10:00:00.000Z', ua: 'Mozilla/5.0 test', standalone: false, secrets: ['Salainen viestin teksti tässä'],
    err: { code: 'tool_error', message: 'Bad recipient eero@example.fi: Salainen viestin teksti tässä', retryable: false, retryAfterMs: 1500,
      result: { isError: true, content: [{ type: 'text', text: 'Error for to=eero@example.fi' }], structuredContent: { body: 'Salainen viestin teksti tässä', subject: 'Aihe', to: ['eero@example.fi'], code: 400 } } } });
  eq('buildSendDiag: fields', Object.keys(D).sort().join(), 'at,attempt,code,message,resultText,retryAfterMs,retryable,standalone,tool,ua');
  ok('buildSendDiag: values', D.attempt === 'reply' && D.tool === 'reply' && D.code === 'tool_error' && D.retryable === false && D.retryAfterMs === 1500 && D.standalone === false && D.at === '2026-11-01T10:00:00.000Z', D);
  ok('buildSendDiag: no @, no body/subject/recipient', !JSON.stringify(D).includes('@') && !JSON.stringify(D).includes('Salainen') && !JSON.stringify(D).includes('"Aihe"') && D.message.includes('<email>') && D.resultText.includes('<email>') && D.resultText.includes('"code":400'), D);
  ok('buildSendDiag: limits (message 400, resultText 600, ua 120)', (() => { const d = X.buildSendDiag({ err: { message: 'm'.repeat(900), result: { content: [{ text: 't'.repeat(2000) }] } }, ua: 'u'.repeat(300) }); return d.message.length === 400 && d.resultText.length === 600 && d.ua.length === 120 && d.retryAfterMs === null; })());
  ok('buildSendDiag: defensive on missing err', (() => { const d = X.buildSendDiag({}); return d.code === '' && d.message === '' && d.resultText === '' && d.retryable === false; })());
}

// ---- Laitteen tila ----
{
  const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1';
  const IPAD_CPU = 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
  const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15';
  const AND_FULL = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
  const AND_REDUCED = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
  const D = X.detectDeviceInfo, S = X.deviceStatus;
  eq('device: iOS UA -> 18.3, Safari 18', D({ ua: IOS }), { platform: 'ios', osVersion: '18.3', browser: 'Safari', browserMajor: 18 });
  eq('device: iPad CPU OS 17_4', D({ ua: IPAD_CPU }).osVersion, '17.4');
  eq('device: iPadOS desktop UA (Macintosh + touch) -> ios, version unknown', [D({ ua: IPAD_DESKTOP, maxTouchPoints: 5 }).platform, D({ ua: IPAD_DESKTOP, maxTouchPoints: 5 }).osVersion], ['ios', null]);
  eq('device: real Mac (no touch) -> other', D({ ua: IPAD_DESKTOP, maxTouchPoints: 0 }).platform, 'other');
  eq('device: Android with high-entropy platformVersion beats UA', [D({ ua: AND_FULL, platformVersion: '15.0.0' }).platform, D({ ua: AND_FULL, platformVersion: '15.0.0' }).osVersion, D({ ua: AND_FULL }).osVersion], ['android', '15.0.0', '13']);
  eq('device: reduced Android UA ("Android 10; K") is not trusted', [D({ ua: AND_REDUCED }).osVersion, D({ ua: AND_REDUCED }).browserMajor], [null, 140]);
  eq('device: reduced UA + high-entropy value gives version', D({ ua: AND_REDUCED, platformVersion: '14.0.0' }).osVersion, '14.0.0');
  const FF = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';
  eq('device: browsers (CriOS, Firefox, Samsung, Edge)', [
    D({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1' }),
    D({ ua: FF }).browser + D({ ua: FF }).browserMajor,
    D({ ua: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36' }).browser,
    D({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0' }).browser], [{ platform: 'ios', osVersion: '17.5', browser: 'Chrome', browserMajor: 126 }, 'Firefox128', 'Samsung', 'Edge']);
  eq('device: unknown UA', D({ ua: 'Node.js/22' }), { platform: 'other', osVersion: null, browser: '', browserMajor: null });
  eq('cmpVersion', [X.cmpVersion('18.3', '18.6'), X.cmpVersion('18.6', '18.6.0'), X.cmpVersion('18.10', '18.6'), X.cmpVersion('19', '18.9.9'), X.cmpVersion('17_4', '18.0')], [-1, 0, 1, 1, -1]);
  eq('SEC_MIN shape (update on republish)', Object.keys(X.SEC_MIN).sort().join(), 'android,checked,chrome,ios,safari');
  const NOTE = 'Sovellus ei voi asentaa päivityksiä itse, mutta se käyttää aina puhelimen ja selaimen uusimpia suojauksia, kun ne on päivitetty.';
  const PLAY = 'Tarkista myös Google Play -järjestelmäpäivitys ja tietoturvapäivityksen päivämäärä (Asetukset → Tietoturva ja yksityisyys).';
  const MIN = { ios: '18.6', android: 14, chrome: 130, safari: 18, checked: '2026-11' };
  eq('status: old iOS -> update + exact Finnish line', S({ platform: 'ios', osVersion: '18.3', browser: 'Safari', browserMajor: 18 }, MIN), { level: 'update', lines: ['iOS 18.3 – päivitys suositeltu (vähintään 18.6). Asetukset → Yleiset → Ohjelmistopäivitys.', NOTE] });
  eq('status: current iOS -> ok', S({ platform: 'ios', osVersion: '18.7', browser: 'Safari', browserMajor: 18 }, MIN).lines[0], 'iOS 18.7 – ajan tasalla.');
  eq('status: Android 15 + Chrome 140 -> ok with Play note', S({ platform: 'android', osVersion: '15.0.0', browser: 'Chrome', browserMajor: 140 }, MIN), { level: 'ok', lines: ['Android 15 – ajan tasalla.', PLAY, 'Selain Chrome 140 – ajan tasalla.', NOTE] });
  eq('status: old Chrome -> update', [S({ platform: 'android', osVersion: '15', browser: 'Chrome', browserMajor: 120 }, MIN).level, S({ platform: 'android', osVersion: '15', browser: 'Chrome', browserMajor: 120 }, MIN).lines[2]], ['update', 'Selain Chrome 120 – päivitys suositeltu (vähintään 130). Päivitä selain sovelluskaupasta.']);
  eq('status: old Android -> update', S({ platform: 'android', osVersion: '12.0.0', browser: 'Chrome', browserMajor: 140 }, MIN).lines[0], 'Android 12 – päivitys suositeltu (vähintään 14). Asetukset → Järjestelmä → Ohjelmistopäivitys.');
  eq('status: reduced Android UA (unknown version) -> unknown, Finnish line, still Chrome line', S(D({ ua: AND_REDUCED }), MIN), { level: 'unknown', lines: ['Versiota ei voitu tunnistaa. Tarkista päivitykset puhelimen asetuksista.', PLAY, 'Selain Chrome 140 – ajan tasalla.', NOTE] });
  eq('status: iPad desktop UA -> unknown', S(D({ ua: IPAD_DESKTOP, maxTouchPoints: 5 }), MIN).level, 'unknown');
  eq('status: update beats unknown', S({ platform: 'android', osVersion: null, browser: 'Chrome', browserMajor: 100 }, MIN).level, 'update');
  eq('status: nothing known -> unknown + note', S({}, MIN), { level: 'unknown', lines: ['Versiota ei voitu tunnistaa. Tarkista päivitykset puhelimen asetuksista.', NOTE] });
  eq('status: desktop Safari 17 -> update, iOS Safari line skipped (follows OS)', [S({ platform: 'other', browser: 'Safari', browserMajor: 17 }, MIN).level, S({ platform: 'ios', osVersion: '18.7', browser: 'Safari', browserMajor: 17 }, MIN).level], ['update', 'ok']);
  eq('status: uses default SEC_MIN when no min given', S({ platform: 'ios', osVersion: '17.0' }).level, 'update');
  eq('ios line 26: 26.7.0 needs 26.7.3', S({ platform: 'ios', osVersion: '26.7' }).level, 'update');
  eq('ios line 18: 18.7.12 ok', S({ platform: 'ios', osVersion: '18.7.12' }).level, 'ok');
  eq('ios 27.3 ok', S({ platform: 'ios', osVersion: '27.3' }).level, 'ok');
  eq('ios 28.0 newer than list ok', S({ platform: 'ios', osVersion: '28.0' }).level, 'ok');
  eq('ios 17.5 unsupported -> update to latest line', /27.2.1/.test(S({ platform: 'ios', osVersion: '17.5' }).lines.join()), true);
}
// ---- Arkaluonteiset ----
{
  eq('isSensitive: only strict true', [X.isSensitive({ sensitive: true }), X.isSensitive({ sensitive: 'true' }), X.isSensitive({}), X.isSensitive(null)], [true, false, false, false]);
}

// ---- Suora Gmail-yhteys (PWA): OAuth ja Gmail API -muunnos (kuvitteellista dataa) ----
{
  ok('client id ok', X.GOOGLE_CLIENT_RE.test('123456789012-abcdefgh1234.apps.googleusercontent.com'));
  ok('client id bad', !X.GOOGLE_CLIENT_RE.test('abc.apps.googleusercontent.com') && !X.GOOGLE_CLIENT_RE.test('123456789012-abcdefgh1234.apps.googleusercontent.com.evil.example'));
  eq('redirect uri strips hash/query/index.html', [X.oauthRedirectUri('https://esim.example/hv/index.html?x=1#a=b'), X.oauthRedirectUri('https://esim.example/hv/')], ['https://esim.example/hv/', 'https://esim.example/hv/']);
  const u = X.oauthAuthUrl({ clientId: '1-abc', redirectUri: 'https://esim.example/hv/', state: 'st&1', loginHint: 'oma@example.com' });
  ok('auth url: implicit token, readonly scope, encoded state', u.startsWith('https://accounts.google.com/o/oauth2/v2/auth?') && u.includes('response_type=token') && u.includes('scope=' + encodeURIComponent(X.GMAIL_SCOPE)) && u.includes('state=st%261') && u.includes('redirect_uri=https%3A%2F%2Fesim.example%2Fhv%2F') && u.includes('login_hint=oma%40example.com') && !/gmail\.(send|modify)|mail\.google\.com\/?&/.test(decodeURIComponent(u)), u);
  eq('fragment: token', X.parseOAuthFragment('#access_token=ya29.x-y&token_type=Bearer&expires_in=3599&scope=' + encodeURIComponent(X.GMAIL_SCOPE) + '&state=abc'), { token: 'ya29.x-y', state: 'abc', expiresIn: 3599, scope: X.GMAIL_SCOPE, error: '' });
  eq('fragment: error', X.parseOAuthFragment('#error=access_denied&state=abc').error, 'access_denied');
  eq('fragment: not oauth', [X.parseOAuthFragment(''), X.parseOAuthFragment('#chat=1')], [null, null]);
  const b64 = s => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const full = { id: 'm1', threadId: 't1', internalDate: '1793000000000', labelIds: ['INBOX'], snippet: 'Kiitos &amp; tervetuloa &#39;huomenna&#39;',
    payload: { mimeType: 'multipart/mixed', headers: [{ name: 'From', value: '"Heli Ranta" <Rekry@Yritys.example.fi>' }, { name: 'To', value: 'Oma Esimerkki <oma.esimerkki@gmail.com>' }, { name: 'Cc', value: 'toinen@yritys.example.fi' }, { name: 'Subject', value: '=?UTF-8?Q?Haastattelu_k=C3=A4ynnist=C3=A4?=' }, { name: 'Date', value: 'Mon, 26 Oct 2026 10:00:00 +0200' }],
      parts: [{ mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset=UTF-8' }], body: { data: b64('Hei, tervetuloa haastatteluun ä.') } }, { mimeType: 'text/html', body: { data: b64('<p>Hei</p>') } }] },
        { mimeType: 'application/pdf', filename: 'ohje.pdf', body: { attachmentId: 'a1', size: 10 } }] } };
  const gm = X.gmailApiMsg(full, true);
  eq('api msg: connector shape', [gm.id, gm.threadId, gm.sender, gm.toRecipients, gm.ccRecipients, gm.subject, gm.plaintextBody, gm.attachments, gm.snippet, gm.addressDisplayNames.length],
    ['m1', 't1', 'rekry@yritys.example.fi', ['oma.esimerkki@gmail.com'], ['toinen@yritys.example.fi'], 'Haastattelu käynnistä', 'Hei, tervetuloa haastatteluun ä.', [{ filename: 'ohje.pdf' }], "Kiitos & tervetuloa 'huomenna'", 2]);
  const am = X.gmailMsgToAppMsg(gm, new Set(['oma.esimerkki@gmail.com']));
  ok('api msg -> app msg', am.id === 'gm-m1' && am.dir === 'in' && am.fromName === 'Heli Ranta' && am.body === 'Hei, tervetuloa haastatteluun ä.' && am.at === new Date(1793000000000).toISOString(), am);
  const htmlOnly = X.gmailApiMsg({ id: 'm2', payload: { mimeType: 'text/html', headers: [{ name: 'From', value: 'x@y.example' }], body: { data: b64('<div>Rivi 1<br>Rivi 2</div>') } } }, true);
  eq('api msg: html fallback', htmlOnly.plaintextBody, 'Rivi 1\nRivi 2');
  const meta = X.gmailApiMsg(Object.assign({}, full, { labelIds: ['SENT'] }), false);
  ok('api msg: metadata has no body', meta.plaintextBody === undefined && meta.labelIds[0] === 'SENT');
  eq('http errors', [X.gmailHttpError(401, null).code, X.gmailHttpError(429, null, '3').retryAfterMs, X.gmailHttpError(403, { error: { errors: [{ reason: 'insufficientPermissions' }] } }).code, X.gmailHttpError(403, { error: { errors: [{ reason: 'accessNotConfigured' }] } }).code, X.gmailHttpError(503, null).retryable, X.gmailHttpError(400, null).code],
    ['oauth_expired', 3000, 'oauth_scope', 'api_disabled', true, 'tool_error']);
  ok('error info: reauth codes', X.gmailErrorInfo({ code: 'oauth_expired' }).reauth === true && X.gmailErrorInfo({ code: 'oauth_scope' }).reauth === true && /Gmail API/.test(X.gmailErrorInfo({ code: 'api_disabled' }).text));
}

console.log(`\n${pass} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
