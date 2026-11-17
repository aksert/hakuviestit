// Kevyt DOM-savutesti: ajaa sovelluksen skriptin valekäyttöliittymää vasten (ei selainta).
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const SP = path.dirname(process.argv[1]);
const NATIVE = process.argv[2] === 'native';            // Capacitor-natiivikuori (valekäyttöliittymä): standalone + natiivit liitännäiset
const STANDALONE = process.argv[2] === 'standalone' || NATIVE;
const GMMODE = ['gmail', 'gmail-null', 'disc', 'disc-nosample'].includes(process.argv[2]) ? process.argv[2] : '';

class Node { }
class Text extends Node { constructor(t) { super(); this.data = String(t); this.nodeType = 3; this.parentNode = null; } get textContent() { return this.data; } set textContent(v) { this.data = String(v); } }
function parseSimple(s) {
  s = s.replace(/:not\([^)]*\)/g, '').trim();
  const m = /^([a-zA-Z0-9]*)((?:[#.][\w-]+|\[[^\]]+\])*)$/.exec(s);
  if (!m) return null;
  const out = { tag: m[1].toUpperCase(), id: null, cls: [], attrs: [] };
  (m[2].match(/[#.][\w-]+|\[[^\]]+\]/g) || []).forEach(p => {
    if (p[0] === '#') out.id = p.slice(1); else if (p[0] === '.') out.cls.push(p.slice(1));
    else { const a = /\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]/.exec(p); out.attrs.push([a[1], a[2]]); }
  });
  return out;
}
class El extends Node {
  constructor(tag) {
    super(); this.tagName = String(tag).toUpperCase(); this.nodeType = 1; this.children = []; this.attrs = {}; this.listeners = {};
    this.style = {}; this.parentNode = null; this._cls = new Set(); this.hidden = false; this._value = undefined; this.checked = false; this.disabled = false;
    this.files = []; this.offsetParent = {}; this.scrollHeight = 0; this.clientHeight = 0; this.selected = false;
  }
  get id() { return this.attrs.id || ''; }
  get className() { return [...this._cls].join(' '); } set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() { const s = this._cls; return { add: (...a) => a.forEach(x => s.add(x)), remove: (...a) => a.forEach(x => s.delete(x)), toggle: (c, f) => { const on = f === undefined ? !s.has(c) : f; if (on) s.add(c); else s.delete(c); return on; }, contains: c => s.has(c) }; }
  get dataset() { const self = this; self._ds = self._ds || {}; return new Proxy(self._ds, { get: (t, k) => (k in t ? t[k] : self.attrs['data-' + String(k)]), set: (t, k, v) => { t[k] = v; return true; } }); }
  get value() {
    if (this.tagName === 'OPTION') return this.attrs.value !== undefined ? this.attrs.value : this.textContent;
    if (this.tagName === 'SELECT') {
      if (this._value !== undefined) return this._value;
      const opts = this.querySelectorAll('option'); const sel = opts.find(o => o.selected) || opts[0]; return sel ? sel.value : '';
    }
    return this._value === undefined ? '' : this._value;
  }
  set value(v) { if (this.tagName === 'OPTION') this.attrs.value = String(v); else this._value = String(v); }
  set placeholder(v) { this.attrs.placeholder = v; } get placeholder() { return this.attrs.placeholder; }
  set accept(v) { this.attrs.accept = v; }
  set inputMode(v) { this.attrs.inputmode = v; }
  append(...k) { k.forEach(x => { if (typeof x === 'string') x = new Text(x); if (x.parentNode) x.parentNode.removeChild(x); x.parentNode = this; this.children.push(x); }); }
  prepend(x) { if (typeof x === 'string') x = new Text(x); if (x.parentNode) x.parentNode.removeChild(x); x.parentNode = this; this.children.unshift(x); }
  appendChild(x) { this.append(x); return x; }
  insertBefore(n, ref) { if (n.parentNode) n.parentNode.removeChild(n); const i = this.children.indexOf(ref); n.parentNode = this; if (i < 0) this.children.push(n); else this.children.splice(i, 0, n); return n; }
  get lastChild() { return this.children[this.children.length - 1] || null; }
  removeChild(x) { const i = this.children.indexOf(x); if (i >= 0) this.children.splice(i, 1); x.parentNode = null; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  replaceChildren(...k) { this.children.forEach(c => { c.parentNode = null; }); this.children = []; this.append(...k); }
  get textContent() { return this.children.map(c => c.textContent).join(''); }
  set textContent(v) { this.replaceChildren(); if (v !== '') this.append(String(v)); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = v; if (k === 'value') this._value = String(v); }
  getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  dispatchEvent(e) { e.target = e.target || this; if (!e.preventDefault) e.preventDefault = () => { }; (this.listeners[e.type] || []).forEach(f => f(e)); }
  click() { if (this.disabled) return; if (typeof this.onclick === 'function') this.onclick({ type: 'click', target: this }); this.dispatchEvent({ type: 'click' }); }
  focus() { document.activeElement = this; } blur() { } select() { }
  closest(sel) { let e = this; while (e && e.nodeType === 1) { if (matches(e, sel)) return e; e = e.parentNode; } return null; }
  querySelectorAll(sel) { const out = []; const walk = n => n.children.forEach(c => { if (c.nodeType === 1) { if (matches(c, sel)) out.push(c); walk(c); } }); walk(this); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function matches(el, sel) {
  return sel.split(',').some(part => {
    const p = parseSimple(part); if (!p) { return false; }
    if (p.tag && el.tagName !== p.tag) return false;
    if (p.id && el.id !== p.id) return false;
    if (!p.cls.every(c => el._cls.has(c))) return false;
    return p.attrs.every(([k, v]) => v === undefined ? el.attrs[k] !== undefined : el.attrs[k] === v);
  });
}
const body = new El('body'), docEl = new El('html');
const document = {
  body, documentElement: docEl, activeElement: null,
  createElement: t => new El(t), createElementNS: (ns, t) => new El(t), createTextNode: t => new Text(t),
  querySelector: s => body.querySelector(s), querySelectorAll: s => body.querySelectorAll(s),
  _l: {}, addEventListener(t, fn) { (this._l[t] = this._l[t] || []).push(fn); }, removeEventListener(t, fn) { this._l[t] = (this._l[t] || []).filter(f => f !== fn); }, fire(e) { e.preventDefault = e.preventDefault || (() => { }); (this._l[e.type] || []).forEach(fn => fn(e)); return e; }, contains: () => true
};
docEl.scrollHeight = 1000;
function mk(tag, id, extra) { const e = new El(tag); if (id) e.setAttribute('id', id); if (extra) Object.keys(extra).forEach(k => e.setAttribute(k, extra[k])); return e; }
const app = mk('div', 'app'); const split = mk('div', 'split'); split.hidden = true; const left = mk('aside', 'left'); const lhead = mk('div', 'left-head'); lhead.append(mk('button', 'new-chat-btn'), mk('button', 'email-chat-btn')); left.append(lhead, mk('div', 'left-nav'), mk('div', 'left-list')); const right = mk('section', 'right'); const rempty = mk('div', 'right-empty'); rempty.hidden = true; right.append(rempty); split.append(left, right);
app.append(mk('div', 'banner'), mk('main', 'main'), split); app.querySelector('#banner').hidden = true;
const fabwrap = mk('div', 'fabwrap'); fabwrap.append(mk('button', 'fab'));
const tabbar = mk('nav', 'tabbar');
const lockEl = mk('div', 'lock'); lockEl.hidden = true; const lockfab = mk('button', 'lockfab'); lockfab.hidden = true; lhead.append(mk('button', 'lock-left'));
body.append(app, fabwrap, tabbar, lockEl, lockfab, mk('div', 'layers'), mk('div', 'toasts'));

const ss = {};
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: k => (k in ss ? ss[k] : null), setItem: (k, v) => { ss[k] = String(v); }, removeItem: k => { delete ss[k]; } } });
document.hidden = false;
const et = new EventTarget();
const store = {};
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } });
Object.assign(globalThis, {
  window: globalThis, document, Node, requestAnimationFrame: f => setTimeout(f, 0), scrollTo() { }, scrollY: 0, innerHeight: 800,
  getSelection: () => ({ removeAllRanges() { }, addRange() { } }),
  addEventListener: et.addEventListener.bind(et), removeEventListener: et.removeEventListener.bind(et), dispatchEvent: et.dispatchEvent.bind(et)
});
if (STANDALONE) globalThis.HAKUVIESTIT_STANDALONE = true;
globalThis.HV_SENT_CHECK_DELAYS = [0, 0];
if (process.argv[2] === 'layout') { globalThis.innerWidth = 1440; }
if (process.argv[2] !== 'layout') { globalThis.innerWidth = 390; }

const errors = [];
process.on('unhandledRejection', e => { errors.push('unhandledRejection: ' + (e && e.stack || e)); });
const origErr = console.error; console.error = (...a) => { errors.push('console.error: ' + a.map(x => x && x.stack || x).join(' ')); };

let pass = 0, fail = 0;
globalThis.T = {
  ok(name, cond, info) { if (cond) pass++; else { fail++; origErr('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } },
  done() { origErr(`\nDOM-testit: ${pass} ok, ${fail} fail, ${errors.length} virhettä`); errors.forEach(e => origErr('  ' + e)); process.exit(fail || errors.length ? 1 : 0); }
};
globalThis.sleepT = ms => new Promise(r => setTimeout(r, ms));
globalThis.root = body;

if (STANDALONE) {
  const idbData = { docs: new Map(), meta: new Map() };
  globalThis.IDB_DATA = idbData;
  const rq = fn => { const r = {}; setTimeout(() => { try { r.result = fn(); r.onsuccess && r.onsuccess(); } catch (e) { r.error = e; r.onerror && r.onerror(); } }, 1); return r; };
  const storeOf = n => { const m = idbData[n]; return { getAllKeys: () => rq(() => [...m.keys()]), getAll: () => rq(() => [...m.values()]), get: k => rq(() => m.get(k)), put: (v, k) => { m.set(k, v); }, delete: k => { m.delete(k); } }; };
  const db = { createObjectStore() { }, transaction() { const tx = { objectStore: storeOf }; setTimeout(() => tx.oncomplete && tx.oncomplete(), 15); return tx; } };
  globalThis.indexedDB = { open() { const r = {}; setTimeout(() => { r.result = db; r.onupgradeneeded && r.onupgradeneeded(); r.onsuccess && r.onsuccess(); }, 1); return r; } };
}
if (NATIVE) {
  // Valeliitännäiset: NativeBiometric (Keychain), Filesystem, Share. Lokit ja käyttäytymiskytkimet testille.
  const NBX = globalThis.NBX = { log: [], setCalls: [], getCalls: [], delCalls: [], stored: null, avail: true, getErr: null, setErr: null, override: null };
  const FSX = globalThis.FSX = { log: [], written: [], deleted: [], failWrite: false };
  const SHX = globalThis.SHX = { log: [], shared: [], err: null, order: [] };
  const plugins = {
    NativeBiometric: {
      isAvailable: async () => { NBX.log.push('isAvailable'); return { isAvailable: NBX.avail, biometryType: NBX.avail ? 2 : 0 }; },
      setData: async o => { NBX.log.push('setData'); NBX.setCalls.push(JSON.parse(JSON.stringify(o))); if (NBX.setErr) throw NBX.setErr; NBX.stored = o.value; },
      getSecureData: async o => {
        NBX.log.push('getSecureData'); NBX.getCalls.push(JSON.parse(JSON.stringify(o))); await new Promise(r => setTimeout(r, 5));
        if (NBX.getErr) throw NBX.getErr;
        if (NBX.stored == null) throw { message: 'No protected data found for key', code: '21' };
        return { value: NBX.override != null ? NBX.override : NBX.stored };
      },
      deleteData: async o => { NBX.log.push('deleteData'); NBX.delCalls.push(JSON.parse(JSON.stringify(o))); NBX.stored = null; }
    },
    Filesystem: {
      writeFile: async o => { FSX.log.push('writeFile'); SHX.order.push('writeFile'); if (FSX.failWrite) throw { message: 'write failed' }; FSX.written.push(Object.assign({}, o)); return { uri: 'file:///cache/' + o.path }; },
      deleteFile: async o => { FSX.log.push('deleteFile'); SHX.order.push('deleteFile'); FSX.deleted.push(Object.assign({}, o)); }
    },
    Share: {
      share: async o => { SHX.log.push('share'); SHX.order.push('share'); SHX.shared.push(Object.assign({}, o)); if (SHX.err) throw SHX.err; return { activityType: 'com.apple.CloudDocsUI.AddToiCloudDrive' }; }
    }
  };
  globalThis.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', registerPlugin: name => plugins[name] };
  globalThis.NATIVE_PLUGINS = plugins;
}
if (GMMODE) {
  // Valekäyttöliittymä claude.ai:n mcp- ja permissions-capabilityille (kuvitteellista dataa)
  globalThis.GMMODE = GMMODE; globalThis.GMLOG = []; globalThis.GMHANDLER = null; globalThis.PERMLOG = []; globalThis.PERMSEQ = []; globalThis.PERMSTATE = 'granted'; globalThis.PERMREQ_TO = 'granted';
  const fakeMcp = { callTool: async (server, tool, input, opts) => {
    GMLOG.push({ server, tool, input: JSON.parse(JSON.stringify(input)), opts: opts ? JSON.parse(JSON.stringify(opts)) : opts }); PERMSEQ.push('call:' + tool);
    await new Promise(r => setTimeout(r, 5));
    const out = GMHANDLER ? await GMHANDLER(tool, input) : {};
    return { payload: out, content: [] };
  } };
  const fakePerm = { state: async n => { PERMSEQ.push('state:' + n); return PERMSTATE; }, request: async l => { PERMSEQ.push('request:' + l.join()); PERMSTATE = PERMREQ_TO; return { [l[0]]: PERMSTATE }; }, manage: async () => { PERMLOG.push('manage'); } };
  // USE_REQUESTED: kaikki capability-nimet, joita sovellus pyytää (sample-capabilityä ei saa koskaan pyytää)
  globalThis.USE_REQUESTED = [];
  globalThis.claude = { use: async n => { USE_REQUESTED.push(n); return n === 'mcp' ? (GMMODE === 'gmail-null' ? null : fakeMcp) : n === 'permissions' ? fakePerm : null; } };
}
const code = fs.readFileSync(path.join(SP, 'script-extracted.js'), 'utf8') + '\n' + fs.readFileSync(path.join(SP, 'driver-common.js'), 'utf8') + '\n' + fs.readFileSync(path.join(SP, NATIVE ? 'driver-native.js' : STANDALONE ? 'driver-standalone.js' : (process.argv[2] === 'layout' ? 'driver-layout.js' : GMMODE.startsWith('disc') ? 'driver-disc.js' : GMMODE ? 'driver-gmail.js' : 'driver.js')), 'utf8');
try { vm.runInThisContext(code, { filename: 'app.js' }); } catch (e) { origErr('ESIAJO-VIRHE', e.stack); process.exit(2); }
