/* ================= ميزانية Hassan — الواجهة =================
   البيانات كلها على الجهاز (localStorage) وبتتزامن مع سكربت جوجل بعمليات صغيرة.
   أي تغيير: commit() ← بيتطبق فوراً + بيتحفظ + بيروح طابور الإرسال + تقدر ترجع فيه (Ctrl+Z / زرار تراجع). */

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem('bud_' + k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('bud_' + k, JSON.stringify(v)); return true; } catch (e) { logErr('storage', 'مساحة التخزين على الجهاز اتملت — نزّل نسخة احتياطية'); return false; } },
  del(k) { try { localStorage.removeItem('bud_' + k); } catch (e) { } }
};
const todayISO = () => new Date().toLocaleDateString('en-CA');
const nowLocal = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19); };
const clone = o => JSON.parse(JSON.stringify(o));
const money = n => `<bdi class="n">${fmtMoney(n)}</bdi><span class="cur">ج.م</span>`;
const moneyS = (n, signed) => `<bdi class="n">${signed && n > 0 ? '+' : ''}${fmtMoney(n)}</bdi>`;
const IS_TOUCH = matchMedia('(pointer:coarse)').matches;
const isMobile = () => innerWidth <= 900;

/* ---------- سجل الأخطاء بالعربي ---------- */
function logErr(where, msg) {
  const L = LS.get('errs') || [];
  L.unshift({ at: nowLocal(), where, msg: String(msg).slice(0, 400), means: explainErr(msg) });
  LS.set('errs', L.slice(0, 40));
}
function explainErr(m) {
  m = String(m || '');
  if (/failed to fetch|networkerror|load failed|offline/i.test(m)) return 'النت فصل وقت المزامنة — هيتبعت لوحده أول ما يرجع';
  if (/كود الربط/.test(m)) return 'كود الربط غلط أو اتغير — حط الكود الجديد من الإعدادات';
  if (/quota|مساحة/i.test(m)) return 'مساحة الموبايل للبرنامج اتملت — نزّل نسخة احتياطية';
  if (/is not defined|cannot read|undefined/i.test(m)) return 'غلطة في البرنامج نفسه — دوس «إعادة تشغيل الشاشة»، ولو اتكررت ابعت السجل';
  return '';
}
function showCrash(msg) {
  const el = document.createElement('div'); el.className = 'crash';
  el.innerHTML = `⚠ حصلت مشكلة في الشاشة: ${esc(String(msg).slice(0, 120))}<button onclick="this.parentNode.remove();render()">إعادة تشغيل الشاشة</button>`;
  document.body.appendChild(el);
}
window.addEventListener('error', e => { logErr('js', e.message + (e.lineno ? ' @' + e.lineno : '')); });
window.addEventListener('unhandledrejection', e => { logErr('promise', (e.reason && (e.reason.message || e.reason.error)) || e.reason); });

/* ---------- toast / نوافذ ---------- */
function toast(msg, kind, undo) {
  const r = $('#toastRoot');
  r.innerHTML = `<div class="toast ${kind || ''}" role="status"><span>${esc(msg)}</span>${undo ? '<button onclick="undo()">↩ تراجع</button>' : ''}</div>`;
  clearTimeout(toast._t); toast._t = setTimeout(() => r.innerHTML = '', undo ? 5000 : 3000);
}
function modal(title, body, footer, wide, cls) {
  $('#modalRoot').innerHTML = `<div class="ov" onclick="if(event.target===this)closeModal()">
    <div class="modal ${wide ? 'wide' : ''} ${cls || ''}" role="dialog" aria-modal="true"><div class="modal-h"><span class="t">${esc(title)}</span><button class="x" onclick="closeModal()" aria-label="قفل">✕</button></div>
    <div class="modal-b" id="mBody">${body}</div><div class="modal-f">${footer}</div></div></div>`;
  wireInputs($('#modalRoot'));
  wireModalEnter();
}
function closeModal() { $('#modalRoot').innerHTML = ''; }
function modalOpen() { return !!$('#modalRoot .ov'); }
function askYesNo(title, msg, onYes, yesLabel, danger) {
  window._askYes = () => { closeModal(); try { onYes(); } catch (e) { logErr('ask', e.message); showCrash(e.message); } };
  $('#modalRoot').innerHTML = `<div class="ov"><div class="modal" style="max-width:440px">
    <div class="modal-h"><span class="t">${esc(title)}</span></div>
    <div class="modal-b"><div style="font-size:14px;line-height:1.8">${msg}</div></div>
    <div class="modal-f"><button class="btn ${danger ? 'danger' : 'navy'}" id="askYesBtn" onclick="_askYes()">${esc(yesLabel || 'أيوه')}</button><button class="btn" onclick="closeModal()">إلغاء</button></div></div></div>`;
  setTimeout(() => { const b = $('#askYesBtn'); if (b) b.focus(); }, 50);
}
/* «الحاجة دي موجودة قبل كده» — التحديد على «لا» عشان Enter بالغلط مايضيفش مكرر */
function dupAsk(similar, onYes, onOpen) {
  window._dupYes = () => { closeModal(); onYes(); };
  window._dupOpen = i => { closeModal(); onOpen && onOpen(similar[i]); };
  const prev = $('#modalRoot').innerHTML;
  window._dupBack = () => { $('#modalRoot').innerHTML = prev; wireInputs($('#modalRoot')); };
  $('#modalRoot').innerHTML = `<div class="ov"><div class="modal dup" style="max-width:480px">
    <div class="modal-h"><span class="t">⚠ الحاجة دي موجودة قبل كده</span></div>
    <div class="modal-b">${similar.map((s, i) => `<div class="alert amber" style="cursor:default"><span style="flex:1">${s.html}</span>${onOpen ? `<button class="btn sm" onclick="_dupOpen(${i})">افتحه</button>` : ''}</div>`).join('')}
      <div style="margin-top:10px">تحب تضيفها برضه؟</div></div>
    <div class="modal-f"><button class="btn gold" onclick="_dupYes()">أيوه، ضيفه برضه</button><button class="btn" id="dupNo" onclick="_dupBack()">لا، ارجع أعدّل</button></div></div></div>`;
  setTimeout(() => { const b = $('#dupNo'); if (b) b.focus(); }, 50);
}

/* ---------- خانات الفلوس والتاريخ ---------- */
function wireInputs(root) {
  root.querySelectorAll('input[data-money]').forEach(el => {
    if (el._w) return; el._w = 1;
    el.setAttribute('dir', 'ltr'); el.setAttribute('inputmode', 'decimal'); el.setAttribute('autocomplete', 'off');
    if (!el.placeholder) el.placeholder = '0 — أو ابدأ بـ = لمعادلة';
    el.addEventListener('input', () => {
      if (el.value.startsWith('=')) return;
      const caretFromEnd = el.value.length - el.selectionStart;
      let v = toEnDigits(el.value).replace(/[^0-9.\-]/g, '');
      const neg = el.hasAttribute('data-signed') && v.startsWith('-');
      v = v.replace(/-/g, '');
      const parts = v.split('.');
      const dec = parts.length > 1 ? parts.slice(1).join('').slice(0, 2) : null;
      const intFmt = parts[0] === '' ? '' : Number(parts[0]).toLocaleString('en-US');
      el.value = (neg ? '-' : '') + intFmt + (dec !== null ? '.' + dec : '');
      const pos = Math.max(0, el.value.length - caretFromEnd);
      try { el.setSelectionRange(pos, pos); } catch (e) { }
      if (el.dataset.live && window[el.dataset.live]) window[el.dataset.live]();
    });
    const commitF = () => {
      if (el.value.startsWith('=')) {
        el.value = fmtMoney(r2(safeEvalFormula(el.value.slice(1))));
        if (el.dataset.live && window[el.dataset.live]) window[el.dataset.live]();
      }
    };
    el.addEventListener('blur', commitF);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' && el.value.startsWith('=')) { e.preventDefault(); e.stopPropagation(); commitF(); } });
  });
  root.querySelectorAll('input[data-date]').forEach(el => {
    if (el._w) return; el._w = 1;
    el.setAttribute('dir', 'ltr'); el.setAttribute('inputmode', 'numeric'); el.setAttribute('autocomplete', 'off');
    if (!el.placeholder) el.placeholder = 'يوم-شهر-سنة — اكتب 01022026';
    el.addEventListener('input', () => {
      const d = toEnDigits(el.value).replace(/\D/g, '').slice(0, 8);
      let out = d.slice(0, 2);
      if (d.length > 2) out += '-' + d.slice(2, 4);
      if (d.length > 4) out += '-' + d.slice(4, 8);
      el.value = out;
    });
    el.addEventListener('blur', () => { const iso = parseFlexibleDate(el.value); if (iso) el.value = dsp(iso); });
  });
  // Tab يكمّل الكلمة من الاقتراحات
  root.querySelectorAll('input[list]').forEach(el => {
    if (el._wl) return; el._wl = 1;
    el.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || e.shiftKey || !el.value) return;
      const dl = document.getElementById(el.getAttribute('list')); if (!dl) return;
      const v = normAr(el.value), hit = Array.from(dl.options).map(o => o.value).find(o => normAr(o).startsWith(v) && normAr(o) !== v);
      if (hit) { e.preventDefault(); el.value = hit; }
    });
  });
  const first = root.querySelector('[autofocus]') || root.querySelector('.modal-b input:not([type=checkbox]),.modal-b select,.modal-b textarea');
  if (first && root.id === 'modalRoot' && !IS_TOUCH) setTimeout(() => first.focus(), 40);
  else if (first && first.hasAttribute('autofocus')) setTimeout(() => first.focus(), 60);
}
const mval = id => r2(num(($('#' + id) || {}).value));
const dval = id => parseFlexibleDate((($('#' + id) || {}).value) || '');
const sval = id => ((($('#' + id) || {}).value) || '').trim();
const cval = id => !!(($('#' + id) || {}).checked);
function wireModalEnter() {
  const root = $('#modalRoot');
  if (!root || root._enterWired) return;
  root._enterWired = true;
  root.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON' || e.target.type === 'file') return;
    const btn = root.querySelector('.modal-f .btn'); if (!btn) return;
    e.preventDefault();
    if (e.target.value !== undefined) e.target.blur();   // عشان المعادلات تتحسب الأول
    setTimeout(() => btn.click(), 30);
  });
}

/* ================= الحالة ================= */
let D = ensureShape(LS.get('data') || defaultState());
let CFG = LS.get('cfg');                         // {url, key}
const SYNC = { rev: LS.get('rev') || 0, outbox: LS.get('outbox') || [], busy: false, err: null, lastOk: LS.get('lastOk') || '', saving: false };
let UNDO = [];
const UI = { view: 'home', off: 0, filt: { kind: '', cat: '', acc: '', q: '' }, sel: new Set(), flash: null, lastAdd: null, repTab: 'month' };

function persist() {
  const ok = LS.set('data', D);
  LS.set('outbox', SYNC.outbox); LS.set('rev', SYNC.rev);
  return ok;
}
function put(col, item) { return { act: 'put', col, item: Object.assign({}, item, { u: Date.now() }) }; }
function del(col, id) { return { act: 'del', col, id }; }
function setOp(obj) { return { act: 'set', item: obj, u: Date.now() }; }
function invertOp(op) {
  if (op.act === 'put') { const ex = byId(D[op.col], op.item.id); return ex ? { act: 'put', col: op.col, item: clone(ex) } : { act: 'del', col: op.col, id: op.item.id }; }
  if (op.act === 'del') return { act: 'restore', col: op.col, id: op.id };
  if (op.act === 'restore') return { act: 'del', col: op.col, id: op.id };
  if (op.act === 'set') { const prev = {}; Object.keys(op.item).forEach(k => prev[k] = clone(D.settings[k] === undefined ? null : D.settings[k])); return { act: 'set', item: prev }; }
  return null;
}
function commit(ops, msg, opt) {
  opt = opt || {};
  ops = ops.filter(Boolean);
  if (!ops.length) return;
  const inv = ops.map(invertOp).reverse();
  ops.forEach(o => { o.oid = uid('o'); o.at = nowLocal(); if (!o.u) o.u = Date.now(); applyOp(D, o); SYNC.outbox.push(o); });
  if (opt.undo !== false) { UNDO.push({ msg, inv }); if (UNDO.length > 20) UNDO.shift(); }
  if (opt.flash) UI.flash = opt.flash;
  persist();
  if (msg) toast(msg, 'ok', opt.undo !== false);
  scheduleSync();
  if (opt.render !== false) render();
}
function undo() {
  const u = UNDO.pop();
  if (!u) { toast('مفيش حاجة نرجع فيها'); return; }
  const ops = u.inv.map(o => { const c = clone(o); c.u = Date.now(); if (c.item && c.act === 'put') c.item.u = Date.now(); return c; });
  commit(ops, '', { undo: false });
  toast('↩ رجعت: ' + (u.msg || 'آخر تغيير'), 'ok');
}

/* ================= المزامنة مع سكربت جوجل ================= */
function parseCode(raw) {
  raw = String(raw || '').trim();
  const m = /^(https:\/\/script\.google\.com\/macros\/s\/[^#?\s]+\/exec)(?:\?[^#]*)?#(.+)$/.exec(raw);
  return m ? { url: m[1], key: decodeURIComponent(m[2]) } : null;
}
async function api(op, body, cfg) {
  cfg = cfg || CFG;
  if (!cfg || !cfg.url) throw { code: 'no_cfg', message: 'البرنامج مش مربوط بسكربت جوجل' };
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 45000);
  let r;
  try { r = await fetch(cfg.url, { method: 'POST', body: JSON.stringify(Object.assign({ op, key: cfg.key }, body || {})), signal: ctl.signal }); }
  catch (e) { throw { code: 'offline', message: e && e.name === 'AbortError' ? 'سكربت جوجل اتأخر في الرد' : 'مفيش اتصال بسكربت جوجل (Failed to fetch)' }; }
  finally { clearTimeout(tm); }
  if (!r.ok) throw { code: 'http', message: 'السيرفر رد بـ ' + r.status };
  let j; try { j = await r.json(); } catch (e) { throw { code: 'bad_reply', message: 'رد مش مفهوم — اتأكد إن السكربت منشور «Anyone»' }; }
  if (!j.ok) throw { code: j.code || 'script', message: j.error || 'رد غلط' };
  return j;
}
let syncTimer = null;
function scheduleSync(ms) { clearTimeout(syncTimer); if (!CFG) { syncState(); return; } SYNC.saving = true; syncState(); syncTimer = setTimeout(() => sync(), ms == null ? 1200 : ms); }
function rebase(data) {
  D = ensureShape(data);
  SYNC.outbox.forEach(o => applyOp(D, o));   // اللي لسه ما اتبعتش يتطبق فوق
}
async function sync(manual) {
  if (!CFG) { syncState(); if (manual) toast('البرنامج شغال على الجهاز ده بس — اربطه من الإعدادات'); return; }
  if (SYNC.busy) { scheduleSync(1500); return; }
  SYNC.busy = true; syncState();
  const before = JSON.stringify([D.tx.length, D.meta.rev]);
  try {
    let j;
    if (SYNC.outbox.length) {
      const send = SYNC.outbox.slice(0, 400);
      j = await api('push', { ops: send, have: SYNC.rev });
      const done = new Set(j.applied || []);
      SYNC.outbox = SYNC.outbox.filter(o => !done.has(o.oid));
    } else j = await api('pull', { have: SYNC.rev });
    if (j.data) rebase(j.data);
    SYNC.rev = j.rev; SYNC.err = null; SYNC.lastOk = nowLocal(); LS.set('lastOk', SYNC.lastOk);
    persist();
    if (SYNC.outbox.length) { SYNC.busy = false; return sync(manual); }
    if (manual) toast('اتزامن ✓', 'ok');
    if (j.data && JSON.stringify([D.tx.length, D.meta.rev]) !== before && !modalOpen()) render(true);
  } catch (e) {
    SYNC.err = e; logErr('sync', e.message || e.code);
    if (e.code === 'key') { if (manual) toast('كود الربط غلط — حط الكود الجديد من الإعدادات', 'err'); }
    else if (manual) toast(e.code === 'offline' ? 'مفيش نت — هيتبعت لوحده أول ما يرجع' : 'ما اتزامنش: ' + (e.message || e.code), 'err');
    clearTimeout(syncTimer); syncTimer = setTimeout(() => sync(), e.code === 'offline' ? 30000 : 90000);
  } finally { SYNC.busy = false; SYNC.saving = false; syncState(); }
}
function syncState() {
  let dot = 'ok', txt = 'محفوظ ✓';
  const n = SYNC.outbox.length;
  if (!CFG) { dot = 'off'; txt = 'على الجهاز ده بس'; }
  else if (SYNC.busy || SYNC.saving) { dot = 'warn'; txt = 'بيحفظ…'; }
  else if (SYNC.err) { dot = SYNC.err.code === 'offline' ? 'warn' : 'bad'; txt = SYNC.err.code === 'offline' ? 'من غير نت' + (n ? ' · ' + n + ' مستني' : '') : SYNC.err.code === 'key' ? 'كود الربط غلط' : 'مشكلة مزامنة'; }
  else if (n) { dot = 'warn'; txt = n + ' مستني يتبعت'; }
  $$('.syncbox').forEach(el => el.innerHTML = `<span class="dot ${dot}"></span><span>${esc(txt)}</span>`);
}
window.addEventListener('online', () => scheduleSync(300));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { checkAutoLock(); scheduleSync(200); } else { LS.set('hiddenAt', Date.now()); } });
setInterval(() => { if (document.visibilityState === 'visible' && CFG && !SYNC.busy) sync(); }, 120000);

/* ================= الرسومات (SVG من غير مكتبات) ================= */
const PAL = ['#1B3A5C', '#C9A227', '#047857', '#1D4ED8', '#B45309', '#24507D', '#7A5C00', '#059669', '#2563EB', '#64748B', '#D97706', '#0F766E'];
const C_INC = '#059669', C_EXP = '#1B3A5C', C_GOLD = '#C9A227';
function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
function kfmt(v) { const a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'K' : String(Math.round(v)); }
const tipA = s => `data-tip="${esc(s)}"`;
function niceRange(mn, mx) {
  if (mx <= mn) mx = mn + 1;
  const step = niceMax((mx - mn) / 4);
  return [Math.floor(mn / step) * step, Math.ceil(mx / step) * step, step];
}
function axisY(W, H, pl, pt, pb, min, max) {
  let g = ''; const steps = Math.round((max - min) / niceRange(min, max)[2]) || 4;
  for (let i = 0; i <= steps; i++) {
    const v = min + (max - min) * i / steps, y = H - pb - (H - pt - pb) * i / steps;
    g += `<line class="${v === 0 && min < 0 ? 'zero' : 'gl'}" x1="${pl}" x2="${W - 6}" y1="${y}" y2="${y}"/><text x="${pl - 6}" y="${y + 4}" text-anchor="end">${kfmt(v)}</text>`;
  }
  return g;
}
/* أعمدة: مجموعات أو متراكبة */
function barChart(o) {
  const W = 640, H = o.h || 230, pl = 44, pt = 10, pb = 28, n = o.labels.length;
  if (!n) return '';
  let mx = 0, mn = 0;
  o.labels.forEach((_, i) => {
    if (o.stacked) { let s = 0; o.series.forEach(se => s += Math.max(0, se.vals[i] || 0)); mx = Math.max(mx, s); }
    else o.series.forEach(se => { mx = Math.max(mx, se.vals[i] || 0); mn = Math.min(mn, se.vals[i] || 0); });
    if (o.line) { mx = Math.max(mx, o.line.vals[i] || 0); mn = Math.min(mn, o.line.vals[i] || 0); }
  });
  [mn, mx] = niceRange(Math.min(0, mn), Math.max(mx, 1));
  const y = v => H - pb - (H - pt - pb) * (v - mn) / (mx - mn), gw = (W - pl - 8) / n;
  let s = axisY(W, H, pl, pt, pb, mn, mx);
  o.labels.forEach((lb, i) => {
    const x0 = pl + gw * i, inner = gw * 0.72, ox = x0 + (gw - inner) / 2;
    if (o.stacked) {
      let acc = 0;
      o.series.forEach(se => { const v = Math.max(0, se.vals[i] || 0); if (!v) return; const y1 = y(acc + v), y2 = y(acc); s += `<rect x="${ox}" y="${y1}" width="${inner}" height="${Math.max(0.5, y2 - y1)}" fill="${se.color}" ${tipA(lb + '\n' + se.name + ': ' + fmtMoney(v))}/>`; acc += v; });
    } else {
      const bw = inner / o.series.length;
      o.series.forEach((se, k) => { const v = se.vals[i] || 0, y1 = y(Math.max(0, v)), y2 = y(Math.min(0, v)); s += `<rect x="${ox + bw * k + 1}" y="${y1}" width="${Math.max(1, bw - 2)}" height="${Math.max(0.5, y2 - y1)}" rx="2" fill="${se.color}" opacity="${o.hi === i || o.hi == null ? 1 : .55}" ${tipA(lb + '\n' + se.name + ': ' + fmtMoney(v))}/>`; });
    }
    if (n <= 14 || i % 2 === 0) s += `<text x="${x0 + gw / 2}" y="${H - 9}" text-anchor="middle" ${o.hi === i ? 'style="fill:#1B3A5C;font-weight:700"' : ''}>${esc(lb)}</text>`;
  });
  if (o.line) {
    const pts = o.line.vals.map((v, i) => `${pl + gw * i + gw / 2},${y(v || 0)}`).join(' ');
    s += `<polyline points="${pts}" fill="none" stroke="${o.line.color}" stroke-width="2.2" stroke-linejoin="round"/>`;
    o.line.vals.forEach((v, i) => s += `<circle cx="${pl + gw * i + gw / 2}" cy="${y(v || 0)}" r="3.2" fill="#fff" stroke="${o.line.color}" stroke-width="2" ${tipA(o.labels[i] + '\n' + o.line.name + ': ' + fmtMoney(v || 0))}/>`);
  }
  const lg = o.series.map(se => `<span><i style="background:${se.color}"></i>${esc(se.name)}</span>`).join('') + (o.line ? `<span><i style="background:${o.line.color}"></i>${esc(o.line.name)}</span>` : '');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img">${s}</svg></div><div class="legend">${lg}</div>`;
}
/* خطوط: x رقمي (أيام)، وممكن خط متقطع ومنطقة */
function lineChart(o) {
  const W = 640, H = o.h || 220, pl = 48, pt = 12, pb = 28, n = o.n;
  let mx = -Infinity, mn = Infinity;
  o.series.forEach(se => se.pts.forEach(p => { if (p[1] == null) return; mx = Math.max(mx, p[1]); mn = Math.min(mn, p[1]); }));
  if (!isFinite(mx)) return '';
  [mn, mx] = niceRange(Math.min(0, mn), Math.max(mx, 1));
  const x = i => pl + (W - pl - 10) * (n > 1 ? i / (n - 1) : 0.5), y = v => H - pb - (H - pt - pb) * (v - mn) / (mx - mn);
  let s = axisY(W, H, pl, pt, pb, mn, mx);
  (o.xlabels || []).forEach(l => { s += `<text x="${x(l[0])}" y="${H - 9}" text-anchor="middle">${esc(l[1])}</text>`; });
  if (o.marker != null) s += `<line x1="${x(o.marker)}" x2="${x(o.marker)}" y1="${pt}" y2="${H - pb}" stroke="#C9A227" stroke-dasharray="3 3"/>`;
  o.series.forEach(se => {
    const pts = se.pts.filter(p => p[1] != null);
    if (!pts.length) return;
    const d = pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join(' ');
    if (se.fill) s += `<path d="${d} L${x(pts[pts.length - 1][0])} ${y(Math.max(0, mn))} L${x(pts[0][0])} ${y(Math.max(0, mn))} Z" fill="${se.color}" opacity=".10"/>`;
    s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${se.w || 2.4}" ${se.dash ? 'stroke-dasharray="6 5"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
    if (se.tips) pts.forEach(p => { if (p[2]) s += `<circle cx="${x(p[0])}" cy="${y(p[1])}" r="7" fill="transparent" ${tipA(p[2])}/>`; });
  });
  (o.dots || []).forEach(dt => s += `<circle cx="${x(dt[0])}" cy="${y(dt[1])}" r="4.5" fill="${dt[2]}" stroke="#fff" stroke-width="2" ${dt[3] ? tipA(dt[3]) : ''}/>`);
  const lg = o.series.filter(se => se.name).map(se => `<span style="color:${se.color}"><i class="${se.dash ? 'dash' : ''}" style="background:${se.dash ? 'transparent' : se.color}"></i><b style="color:#334155;font-weight:500">${esc(se.name)}</b></span>`).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img">${s}</svg></div><div class="legend">${lg}</div>`;
}
function donut(segs, top, bottom) {
  const tot = segs.reduce((a, s) => a + s.v, 0);
  if (!tot) return '';
  const R = 80, r = 52, cx = 95, cy = 95;
  let a0 = -Math.PI / 2, s = '';
  segs.forEach(sg => {
    const a1 = a0 + 2 * Math.PI * sg.v / tot, large = a1 - a0 > Math.PI ? 1 : 0;
    if (sg.v / tot > 0.9999) { s += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${sg.c}" stroke-width="${R - r}" ${tipA(sg.l + ': ' + fmtMoney(sg.v))}/>`; }
    else {
      const p = (rad, a) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)].map(v => v.toFixed(2)).join(' ');
      s += `<path d="M${p(R, a0)} A${R} ${R} 0 ${large} 1 ${p(R, a1)} L${p(r, a1)} A${r} ${r} 0 ${large} 0 ${p(r, a0)} Z" fill="${sg.c}" stroke="#fff" stroke-width="1.5" ${tipA(sg.l + ': ' + fmtMoney(sg.v) + ' (' + Math.round(sg.v / tot * 100) + '%)')}/>`;
    }
    a0 = a1;
  });
  s += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" style="font-size:17px;font-weight:800;fill:#1B3A5C">${esc(top || kfmt(tot))}</text><text x="${cx}" y="${cy + 16}" text-anchor="middle" style="font-size:10.5px">${esc(bottom || '')}</text>`;
  return `<div class="chart"><svg viewBox="0 0 190 190" role="img">${s}</svg></div>`;
}
/* tooltip للرسومات: hover على الكمبيوتر، ولمسة على الموبايل */
(function () {
  let tip = null;
  function show(el, x, y) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; document.body.appendChild(tip); }
    tip.textContent = el.getAttribute('data-tip'); tip.style.display = 'block';
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(innerWidth - w - 8, Math.max(8, x - w / 2)) + 'px'; tip.style.top = Math.max(8, y - h - 14) + 'px';
  }
  function hide() { if (tip) tip.style.display = 'none'; }
  document.addEventListener('pointermove', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el && e.pointerType === 'mouse') show(el, e.clientX, e.clientY); else if (e.pointerType === 'mouse') hide(); });
  document.addEventListener('pointerdown', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el && e.pointerType !== 'mouse') show(el, e.clientX, e.clientY); else hide(); });
  document.addEventListener('scroll', hide, true);
})();
