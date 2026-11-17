(async () => {
  const txt = el => el ? el.textContent : null;
  const byId = id => document.querySelector('#' + id);
  const key = (k, o) => document.fire(Object.assign({ type: 'keydown', key: k }, o || {}));
  await doSetup();
  const root = document.documentElement;
  T.ok('desktop detected', S.device === 'desktop' && root.dataset.device === 'desktop' && root.dataset.input === 'mouse' && root.dataset.layout === 'split', [S.device, root.dataset]);
  T.ok('chat list in left panel', views.chats.root.parentNode.id === 'left-list');
  T.ok('tabbar in left nav, visible', byId('tabbar').parentNode.id === 'left-nav' && byId('tabbar').hidden === false);
  T.ok('main hidden, split shown', byId('split').hidden === false && byId('main').hidden === true);
  T.ok('right empty state shown', byId('right-empty').hidden === false && views.chat.root.hidden === true);
  T.ok('fab hidden in split', byId('fabwrap').hidden === true);
  T.ok('5 rows in split', document.querySelectorAll('.row').length === 5 && S.visibleIds.length === 5);
  T.ok('new-chat button has text', /Uusi keskustelu/.test(txt(byId('new-chat-btn'))));

  byId('chat-ex-valio').click(); await sleepT(200);
  T.ok('chat opens in right panel', S.view === 'chat' && views.chat.root.parentNode.id === 'right' && views.chat.root.hidden === false && byId('right-empty').hidden === true);
  T.ok('left list still visible', views.chats.root.hidden === false);
  T.ok('selected row marked', byId('chat-ex-valio').classList.contains('sel'));
  T.ok('scroll element is msgs-scroll', scrollEl().id === 'msgs-scroll');

  const ta = byId('c-body'); ta.value = 'Enterilla kirjattu';
  ta.dispatchEvent({ type: 'keydown', key: 'Enter', shiftKey: true }); await sleepT(200);
  T.ok('shift+enter does not send', document.querySelectorAll('.bubble').length === 11);
  ta.dispatchEvent({ type: 'keydown', key: 'Enter', shiftKey: false }); await sleepT(300);
  T.ok('enter sends', document.querySelectorAll('.bubble').length === 12 && ta.value === '', document.querySelectorAll('.bubble').length);

  let q = key('k', { ctrlKey: true });
  T.ok('ctrl+k focuses search', document.activeElement && document.activeElement.id === 'q');
  byId('q').value = 'fazer'; byId('q').dispatchEvent({ type: 'input', target: byId('q') });
  T.ok('search filters list', S.visibleIds.join() === 'ex-fazer', S.visibleIds);
  key('Escape');
  T.ok('esc clears search first', byId('q').value === '' && S.openId === 'ex-valio', [byId('q').value, S.openId]);
  T.ok('list restored', S.visibleIds.length === 5);
  const before = S.openId; const i0 = S.visibleIds.indexOf(before);
  key('ArrowDown', { altKey: true }); await sleepT(200);
  T.ok('alt+down opens next chat', S.openId === S.visibleIds[i0 + 1], [before, S.openId]);
  key('ArrowUp', { altKey: true }); await sleepT(200);
  T.ok('alt+up back', S.openId === before);
  byId('ch-who').click();
  T.ok('info panel is side sheet', sheetStack.length === 1 && sheetStack[0].layer.classList.contains('side'));
  key('Escape'); T.ok('esc closes sheet only', sheetStack.length === 0 && S.openId === before);
  key('Escape'); T.ok('esc deselects chat', S.openId === null && S.view === 'chats' && byId('right-empty').hidden === false);

  // modaali ei ole sivupaneeli
  byId('new-chat-btn').click();
  T.ok('new chat is centered modal', sheetStack.length === 1 && !sheetStack[0].layer.classList.contains('side'));
  sheetStack[0].close();

  // tuonti-taulukko ja yhteenveto oikeassa paneelissa
  document.querySelector('#tab-summary').click(); await sleepT(300);
  T.ok('summary in right panel', views.summary.root.parentNode.id === 'right' && views.summary.root.hidden === false && views.chats.root.hidden === false);
  document.querySelector('#tab-accounts').click();
  T.ok('device line desktop', /Laite: Tietokone . hiiri/.test(txt(byId('acc-device'))), txt(byId('acc-device')));

  // koonmuutos 1440 -> 390 -> 1440 avoimen chatin kanssa
  document.querySelector('#tab-chats').click();
  byId('chat-ex-valio').click(); await sleepT(200);
  innerWidth = 390; window.dispatchEvent(new Event('resize')); await sleepT(400);
  T.ok('mobile after shrink', S.device === 'mobile' && root.dataset.layout === 'single' && byId('main').hidden === false && byId('split').hidden === true);
  T.ok('chat kept open on mobile', S.openId === 'ex-valio' && S.view === 'chat' && views.chat.root.parentNode.id === 'main' && views.chat.root.hidden === false && views.chats.root.hidden === true);
  T.ok('mobile: tabbar hidden in chat, back in body', byId('tabbar').hidden === true && byId('tabbar').parentNode === document.body);
  T.ok('mobile: messages intact', document.querySelectorAll('.bubble').length === 12);
  innerWidth = 1440; window.dispatchEvent(new Event('resize')); await sleepT(400);
  T.ok('desktop again, chat kept', S.device === 'desktop' && S.openId === 'ex-valio' && S.view === 'chat' && views.chat.root.parentNode.id === 'right' && document.querySelectorAll('.bubble').length === 12);
  // debounce: monta resize kerralla
  for (let i = 0; i < 5; i++) window.dispatchEvent(new Event('resize'));

  // tabletti: kapea leveys ja kosketus
  innerWidth = 1024; window.dispatchEvent(new Event('resize')); await sleepT(400);
  T.ok('1024 mouse = tablet (width rule)', S.device === 'tablet' && root.dataset.layout === 'split');
  globalThis.matchMedia = q => ({ matches: q === '(pointer: coarse)', addEventListener() { } });
  innerWidth = 1440; window.dispatchEvent(new Event('resize')); await sleepT(400);
  T.ok('wide touch-only stays tablet', S.device === 'tablet' && root.dataset.input === 'touch', [S.device, root.dataset.input]);
  document.querySelector('#tab-accounts').click();
  T.ok('device line tablet', /Laite: Tabletti . kosketus/.test(txt(byId('acc-device'))), txt(byId('acc-device')));
  T.ok('tablet: enter does not send', (() => { ta.value = 'x'; let sent = false; ta.dispatchEvent({ type: 'keydown', key: 'Enter', shiftKey: false }); return ta.value === 'x'; })());
  innerWidth = 390; window.dispatchEvent(new Event('resize')); await sleepT(400);
  T.ok('phone touch', S.device === 'mobile' && root.dataset.input === 'touch');
  T.ok('device line mobile', /Laite: Puhelin . kosketus/.test(txt(byId('acc-device'))));
  T.done();
})().catch(e => { console.error(e); T.ok('driver exception', false, String(e && e.stack)); T.done(); });
