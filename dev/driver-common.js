const PW = 'testi-salasana-1';
const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 15000)) { if (fn()) return true; await new Promise(r => setTimeout(r, 40)); } return false; };
const doSetup = async () => {
  await waitFor(() => document.querySelector('#sec-setup-form'));
  document.querySelector('#sec-pw1').value = PW; document.querySelector('#sec-pw2').value = PW;
  document.querySelector('#sec-setup-form').dispatchEvent({ type: 'submit' });
  const ok = await waitFor(() => !S.locked && S.chatsReady);
  await new Promise(r => setTimeout(r, 500));
  return ok;
};
const doUnlock = async (pw) => {
  await waitFor(() => document.querySelector('#lock-form'));
  document.querySelector('#lock-pw').value = pw; document.querySelector('#lock-form').dispatchEvent({ type: 'submit' });
  const ok = await waitFor(() => !S.locked, 6000);
  await new Promise(r => setTimeout(r, 500));
  return ok;
};
const SECRET_NAMES = ['Valio', 'Kesko', 'Fazer', 'Posti', 'Mäkinen', 'Heli', 'Mikko', 'Sari', 'Pekka', 'example.fi', 'oma.esimerkki', 'Hakemus', 'Esimerkki'];
