/* ===== Suora Gmail-yhteys puhelinversiossa (PWA) =====
   Google-kirjautuminen (OAuth implicit, vain lukulupa gmail.readonly). Pääsytunnus pidetään VAIN muistissa:
   sitä ei tallenneta, se vanhenee tunnissa ja unohdetaan lukittaessa. Pyynnöt menevät vain gmail.googleapis.com:iin (CSP).
   Gmail API -vastaukset muunnetaan samaan muotoon kuin claude.ai:n Gmail-yhdistäjän, joten haku ja etsintä toimivat samalla koodilla. */
const GOAUTH = { token: '', exp: 0, error: '', intent: '', announced: false, editClient: false };
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me/';
// Vain selaimessa ajettava PWA (https tai localhost); ei claude.ai-versiossa eikä natiivisovelluksessa (paluuosoite ei toimi siellä)
function gmailRestCapable() {
  try {
    if (window.HAKUVIESTIT_STANDALONE !== true || isNativeApp() || typeof location === 'undefined' || !location) return false;
    return location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  } catch (e) { return false; }
}
const gmailRestReady = () => !!GOAUTH.token && Date.now() < GOAUTH.exp;
const gmailClientId = () => String(settings().gmailClientId || '').trim();
const gmailRestMinutes = () => Math.max(0, Math.round((GOAUTH.exp - Date.now()) / 60000));

async function gmailFetch(path) {
  if (!gmailRestReady()) { gmailRestForget(); throw { code: 'oauth_expired', message: 'Ei kirjautumista' }; }
  let res;
  try {
    res = await fetch(GMAIL_API + path, { headers: { Authorization: 'Bearer ' + GOAUTH.token }, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch (e) { throw { code: 'server_unavailable', retryable: true, retryAfterMs: 1500, message: 'Ei yhteyttä Gmailiin' }; }
  if (res.ok) return res.json();
  let body = null; try { body = await res.json(); } catch (e) { body = null; }
  const err = gmailHttpError(res.status, body, res.headers && res.headers.get ? res.headers.get('Retry-After') : null);
  if (err.code === 'oauth_expired') gmailRestForget();
  throw err;
}
// Rajattu rinnakkaisuus (Gmailin kiintiö): enintään n pyyntöä kerralla
async function gmailMapLimit(items, n, fn) {
  const out = new Array(items.length); let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}
const META_Q = 'format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date';
// Yhdistäjän työkalut REST-kutsuina. Vain lukeminen: lähetys ei ole mahdollista (ei lähetyslupaa).
async function gmailRestTool(tool, input) {
  if (tool === 'search_threads') {
    const q = ['q=' + encodeURIComponent(input.query || ''), 'maxResults=' + Math.min(100, Math.max(1, Number(input.pageSize) || 20))];
    if (input.pageToken) q.push('pageToken=' + encodeURIComponent(input.pageToken));
    const j = await gmailFetch('threads?' + q.join('&'));
    const ids = (j.threads || []).map(t => t && t.id).filter(Boolean);
    if (input.view === 'THREAD_VIEW_IDS_ONLY') return { threads: ids.map(id => ({ id })), nextPageToken: j.nextPageToken || undefined };
    const threads = await gmailMapLimit(ids, 5, async id => {
      const t = await gmailFetch('threads/' + encodeURIComponent(id) + '?' + META_Q);
      return { id, messages: (t.messages || []).map(m => gmailApiMsg(m, false)).filter(Boolean) };
    });
    return { threads, nextPageToken: j.nextPageToken || undefined };
  }
  if (tool === 'get_thread') {
    const t = await gmailFetch('threads/' + encodeURIComponent(input.threadId) + '?format=full');
    return { id: t.id, messages: (t.messages || []).map(m => gmailApiMsg(m, true)).filter(Boolean) };
  }
  throw { code: 'not_supported', message: 'Ei tuettu puhelinversiossa' };
}
const gmailRestBackend = { rest: true, callTool: async (server, tool, input) => ({ payload: await gmailRestTool(tool, input || {}) }) };

function gmailRestForget() {
  GOAUTH.token = ''; GOAUTH.exp = 0;
  if (S.mcp === gmailRestBackend) S.mcp = null;
}
function gmailRestUse() { if (gmailRestReady()) S.mcp = gmailRestBackend; }

// Paluu Googlen kirjautumisesta: token talteen muistiin ja fragmentti heti pois osoiteriviltä/historiasta
function gmailCaptureOAuth() {
  if (!gmailRestCapable()) return;
  let r = null; try { r = parseOAuthFragment(location.hash); } catch (e) { r = null; }
  if (!r) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { try { location.hash = ''; } catch (e2) { /* ok */ } }
  const want = lsGet('hv-oauth-state') || '';
  GOAUTH.intent = lsGet('hv-oauth-intent') || '';
  lsDel('hv-oauth-state'); lsDel('hv-oauth-intent');
  if (r.error) { GOAUTH.error = r.error === 'access_denied' ? 'denied' : 'error'; return; }
  if (!want || r.state !== want || !r.token) { GOAUTH.error = 'state'; return; }
  if (r.scope && !r.scope.split(/\s+/).includes(GMAIL_SCOPE)) { GOAUTH.error = 'scope'; return; }
  GOAUTH.token = r.token; GOAUTH.exp = Date.now() + Math.max(60, r.expiresIn - 60) * 1000;
  gmailRestUse();
}
gmailCaptureOAuth();

function randomState() {
  const b = _rand(16);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}
// Siirtyy Googlen kirjautumissivulle. intent: 'discover' = avaa työpaikkakeskustelujen etsintä palattua.
async function gmailConnect(intent) {
  if (!gmailRestCapable()) return;
  const cid = gmailClientId();
  if (!GOOGLE_CLIENT_RE.test(cid)) { showView('accounts'); toast('Lisää ensin Google-asiakastunnus (ohjeet Gmail-kohdassa).'); setTimeout(() => { const i = $('#gm-client'); if (i) i.focus(); }, 50); return; }
  const go = await confirmSheet({ title: 'Kirjaudu Googleen', ok: 'Jatka Googleen',
    text: 'Siirryt Googlen kirjautumiseen ja annat sovellukselle luvan lukea Gmailia (ei lähetystä). Palattuasi avaa sovellus salasanallasi. Viestit haetaan suoraan tähän puhelimeen eikä niitä lähetetä minnekään muualle.' });
  if (!go) return;
  const state = randomState();
  lsSet('hv-oauth-state', state); lsSet('hv-oauth-intent', intent || '');
  location.assign(oauthAuthUrl({ clientId: cid, redirectUri: oauthRedirectUri(location.href), state, loginHint: myEmail() }));
}
function gmailDisconnect() {
  gmailRestForget(); refreshGmailUi(); updateImportCaps();
  toast('Gmail-yhteys katkaistu');
}
// Kutsutaan lukituksen avauksen jälkeen: kerrotaan kirjautumisen tulos kerran ja jatketaan aloitettua toimintoa
function gmailAfterUnlock() {
  if (!gmailRestCapable() || GOAUTH.announced) return;
  if (!GOAUTH.error && !GOAUTH.token) return;
  GOAUTH.announced = true;
  if (GOAUTH.error) {
    const t = { denied: 'Google-kirjautuminen peruttiin.', scope: 'Gmailin lukulupaa ei annettu. Kirjaudu uudelleen ja salli sähköpostien lukeminen.', state: 'Kirjautumista ei voitu varmistaa. Yritä uudelleen.' }[GOAUTH.error] || 'Google-kirjautuminen epäonnistui.';
    setTimeout(() => toast(t, 'bad'), 0);
    return;
  }
  gmailRestUse();
  setTimeout(() => {
    refreshGmailUi();
    if (GOAUTH.intent === 'discover') openDiscoverPrompt();
    else toast('Gmail yhdistetty');
    GOAUTH.intent = '';
  }, 0);
}

/* ----- Asetusnäkymä (Omat tilit → Gmail) puhelinversiossa ----- */
function gmailSetupBlock() {
  const redirect = gmailRestCapable() ? oauthRedirectUri(location.href) : '';
  const inp = h('input', { id: 'gm-client', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', inputmode: 'url', placeholder: '1234567890-abc….apps.googleusercontent.com' });
  const err = h('p', { class: 'err', id: 'gm-client-err', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn primary block', type: 'button', id: 'gm-client-save', text: 'Tallenna tunnus', onclick: async () => {
    const v = inp.value.trim();
    if (!GOOGLE_CLIENT_RE.test(v)) { err.textContent = 'Tunnus ei näytä oikealta. Se päättyy .apps.googleusercontent.com.'; err.hidden = false; return; }
    err.hidden = true;
    if (await saveSettings({ gmailClientId: v })) { GOAUTH.editClient = false; renderGmailRest(); toast('Tunnus tallennettu'); }
  } });
  const steps = [
    'Avaa console.cloud.google.com ja luo uusi projekti (esim. "Hakuviestit").',
    'APIs & Services → Library → hae "Gmail API" → Enable.',
    'OAuth consent screen (Google Auth Platform): tyyppi External, sovelluksen nimi ja oma sähköpostisi. Audience → Test users → lisää oma Gmail-osoitteesi.',
    'Credentials (Clients) → Create OAuth client ID → Web application.',
    'Authorized JavaScript origins: lisää alla oleva origin. Authorized redirect URIs: lisää alla oleva paluuosoite täsmälleen.',
    'Kopioi Client ID ja liitä se tähän. (Client secretiä ei tarvita.)'
  ];
  const origin = redirect ? redirect.replace(/^(https?:\/\/[^/]+).*$/, '$1') : '';
  const copyLine = (id, label, val) => h('div', { class: 'field' }, h('span', { class: 'lbl', text: label }),
    h('div', { class: 'copyline' }, h('span', { class: 'mono', id, text: val }), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Kopioi ' + label, onclick: e => copyText(val, $('#' + id)) }, ico('copy', 18))));
  return h('div', { id: 'gm-setup' },
    h('details', { class: 'fold', id: 'gm-howto', style: 'margin-bottom:10px' }, h('summary', { text: 'Ohje: Google-asiakastunnus (kerran, n. 10 min)' }),
      h('ol', { class: 'privlist', style: 'list-style:decimal' }, steps.map(s => h('li', { text: s }))),
      origin ? copyLine('gm-origin', 'JavaScript origin', origin) : null,
      redirect ? copyLine('gm-redirect', 'Paluuosoite (redirect URI)', redirect) : null,
      h('p', { class: 'hint', text: 'Google näyttää kirjautuessa varoituksen "Google hasn\'t verified this app", koska sovellus on omassa testikäytössäsi. Valitse Continue.' })),
    field('gm-client', 'Google-asiakastunnus (Client ID)', inp), err, save);
}
function renderGmailRest() {
  const card = $('#gm-rest'); if (!card) return;
  const cap = gmailRestCapable();
  card.hidden = !cap;
  if (!cap) return;
  const cid = gmailClientId(), ready = gmailRestReady() && S.mcp === gmailRestBackend;
  $('#gm-setup-wrap').hidden = !!cid && !GOAUTH.editClient;
  $('#gm-connect').hidden = !cid || ready;
  $('#gm-disconnect').hidden = !ready;
  $('#gm-client-edit').hidden = !cid || !$('#gm-setup-wrap').hidden;
  const st = $('#gm-rest-status');
  st.textContent = ready ? 'Yhdistetty. Kirjautuminen voimassa vielä noin ' + gmailRestMinutes() + ' min.' : cid ? 'Ei yhdistetty. Kirjaudu Googleen, niin voit hakea työviestit suoraan Gmailista.' : 'Lisää ensin oma Google-asiakastunnus (ohje alla).';
  const inp = $('#gm-client'); if (inp && !inp.value && cid) inp.value = cid;
}
function gmailRestSection() {
  const setupWrap = h('div', { id: 'gm-setup-wrap' }, gmailSetupBlock());
  return h('div', { id: 'gm-rest', hidden: true },
    h('p', { class: 'hint', id: 'gm-rest-status', style: 'margin-bottom:10px' }),
    h('button', { class: 'btn primary block', type: 'button', id: 'gm-connect', style: 'margin-bottom:8px', onclick: () => gmailConnect('discover') }, ico('mail', 18), 'Yhdistä Gmail (Google-kirjautuminen)'),
    setupWrap,
    h('button', { class: 'btn ghost block', type: 'button', id: 'gm-client-edit', text: 'Vaihda Google-asiakastunnus', onclick: () => { GOAUTH.editClient = true; renderGmailRest(); } }),
    h('button', { class: 'btn block', type: 'button', id: 'gm-disconnect', style: 'margin-top:8px', text: 'Katkaise Gmail-yhteys', onclick: gmailDisconnect }),
    h('p', { class: 'hint', id: 'gm-rest-privacy', style: 'margin:8px 0 0', text: 'Vain lukulupa: sovellus ei voi lähettää eikä poistaa sähköposteja. Kirjautumista ei tallenneta, se unohtuu lukittaessa ja vanhenee tunnissa. Luvan voi perua: myaccount.google.com → Tietoturva → Kolmannen osapuolen yhteydet.' }));
}
