/* ================= الشاشات ================= */
const NAV = [
  ['home', '📊', 'الرئيسية'], ['tx', '🧾', 'الحركات'], ['budget', '🎯', 'الميزانية'], ['forecast', '🔮', 'التوقعات'], '-',
  ['income', '💼', 'الدخل والمرتب'], ['bills', '📅', 'الالتزامات'], ['accounts', '🏦', 'الحسابات'], ['goals', '💰', 'الأهداف والادخار'], ['debts', '🤝', 'السلف'], '-',
  ['reports', '📈', 'التقارير'], ['settings', '⚙️', 'الإعدادات'], ['trash', '🗑', 'سلة المحذوفات']
];
const VIEWS = {};
const cd = () => cycleDayOf(D);
const curCycle = () => cycleOf(todayISO(), cd());
const cyc = () => cycleShift(curCycle(), UI.off, cd());
function shiftCyc(n) { UI.off = n === 0 ? 0 : UI.off + n; UI.sel.clear(); render(); }
function cycleNav() {
  const c = cyc();
  return `<div class="cyclenav"><button onclick="shiftCyc(-1)" title="الشهر اللي فات" aria-label="الشهر اللي فات">›</button><b>${esc(cycleLabel(c, cd()))}</b><button onclick="shiftCyc(1)" title="الشهر الجاي" aria-label="الشهر الجاي">‹</button></div>${UI.off ? ' <button class="btn sm" onclick="shiftCyc(0)">الشهر ده</button>' : ''}`;
}
function badges() {
  const t = todayISO(), al = alertsFor(D, t);
  return { home: al.filter(a => a.lvl === 'red').length, bills: al.filter(a => a.go === 'bills').length, income: al.filter(a => a.go === 'income').length, debts: al.filter(a => a.go === 'debts').length };
}
function go(v) { UI.view = v; UI.off = 0; UI.sel.clear(); closeDrawer(); render(); scrollTo(0, 0); }
function closeDrawer() { const d = $('#drawer'); if (d) d.classList.remove('open'); }
function openDrawer() { renderChrome(); $('#drawer').classList.add('open'); }
function renderChrome() {
  const b = badges();
  $('#nav').innerHTML = NAV.map(n => n === '-' ? '<div class="sep"></div>' : `<a class="${UI.view === n[0] ? 'on' : ''}" onclick="go('${n[0]}')"><span class="ico">${n[1]}</span>${n[2]}${b[n[0]] ? `<span class="badge ${n[0] === 'home' || n[0] === 'bills' ? 'red' : ''}">${b[n[0]]}</span>` : ''}</a>`).join('');
  const more = ['income', 'bills', 'accounts', 'goals', 'debts', 'reports', 'settings', 'trash'];
  const moreBadge = more.reduce((s, k) => s + (b[k] || 0), 0);
  const tab = (v, i, l, bd) => `<button class="${UI.view === v ? 'on' : ''}" onclick="go('${v}')"><span class="i">${i}</span>${l}${bd ? `<span class="badge">${bd}</span>` : ''}</button>`;
  $('#mtabs').innerHTML = tab('home', '📊', 'الرئيسية', b.home) + tab('tx', '🧾', 'الحركات') +
    `<button class="add" onclick="txModal()" aria-label="حركة جديدة"><span>+</span></button>` + tab('budget', '🎯', 'الميزانية') +
    `<button class="${more.includes(UI.view) || UI.view === 'forecast' ? 'on' : ''}" onclick="openDrawer()"><span class="i">☰</span>المزيد${moreBadge ? `<span class="badge">${moreBadge}</span>` : ''}</button>`;
  $('#drawer').innerHTML = `<div class="pane" onclick="event.stopPropagation()"><div class="grip"></div><div class="g">${['forecast'].concat(more).map(v => { const n = NAV.find(x => x[0] === v); return `<button class="${UI.view === v ? 'on' : ''}" onclick="go('${v}')"><span class="i">${n[1]}</span>${n[2]}${b[v] ? `<span class="badge" style="position:absolute;top:6px;left:8px;background:#B91C1C;color:#fff;border-radius:10px;font-size:10px;padding:0 6px">${b[v]}</span>` : ''}</button>`; }).join('')}</div></div>`;
  const nm = NAV.find(x => x[0] === UI.view); $('#mTitle').textContent = nm ? nm[2] : '';
}
function render() {
  if (LOCKED) return;
  try {
    renderChrome();
    const m = $('#main');
    m.innerHTML = (VIEWS[UI.view] || VIEWS.home)();
    wireInputs(m);
    syncState();
    if (UI.flash) {
      const el = m.querySelector(`[data-id="${CSS.escape(UI.flash)}"]`);
      if (el) { el.classList.add(el.tagName === 'TR' ? 'flashrow' : 'flash'); const r = el.getBoundingClientRect(); if (r.top < 60 || r.bottom > innerHeight - 70) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      UI.flash = null;
    }
  } catch (e) { logErr('render:' + UI.view, e.message + ' ' + (e.stack || '').split('\n')[1]); showCrash(e.message); console.error(e); }
}
const kpi = (cls, lbl, val, hint, vcls) => `<div class="kpi ${cls}"><div class="lbl">${lbl}</div><div class="val ${vcls || ''}">${val}</div>${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
const topbar = (title, sub, btns) => `<div class="topbar"><div><h1 class="page">${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="spacer"></div>${btns || ''}</div>`;
const emptyBox = (ico, txt, btn) => `<div class="empty"><div class="big">${ico}</div><div>${txt}</div>${btn ? `<div style="margin-top:12px">${btn}</div>` : ''}</div>`;
const pctBar = (spent, budget) => { if (!budget) return ''; const p = spent / budget * 100; return `<div class="bar ${p > 100 ? 'over' : p >= 80 ? 'warn' : 'done'}"><i style="width:${Math.min(100, p).toFixed(1)}%"></i></div>`; };
const catLabel = id => { const k = catOf(D, id); return `${k.icon} ${esc(k.name)}`; };
const accLabel = id => { const a = accOf(D, id); return `${a.icon || ''} ${esc(a.name)}`; };

/* ---------- الرئيسية ---------- */
VIEWS.home = () => {
  const t = todayISO(), c = curCycle(), s = summarize(D, c.start, c.end), st = safeToSpend(D, t), p = st.p, bud = totalBudget(D);
  const al = alertsFor(D, t).concat(insights(t));
  let h = topbar('الرئيسية', `${esc(cycleName(c, cd()))} · ${esc(cycleLabel(c, cd()))} · فاضل ${p.left} يوم`,
    `<button class="btn hide-m" onclick="sync(true)" title="Ctrl+S">🔄 زامن</button><button class="btn gold hide-m" onclick="txModal()">+ حركة</button>`);
  if (!D.tx.length) h += onboarding();
  h += `<div class="kpis">
    ${kpi('emer', '💰 دخل الشهر', money(s.inc), p.dueIncLeft ? 'لسه جاي ' + fmtMoney(p.dueIncLeft) : (D.rec.some(r => r.kind === 'inc') ? 'الدخل الثابت اتسجل كله ✓' : '<a href="#" onclick="go(\'income\');return false">سجّل مرتبك الثابت</a>'))}
    ${kpi('navy', '🧾 المصروف', money(s.exp), bud ? `من ميزانية ${fmtMoney(bud)} (${Math.round(s.exp / bud * 100)}%)` : '<a href="#" onclick="go(\'budget\');return false">حدد ميزانية</a>')}
    ${kpi('gold', s.net >= 0 ? '✅ الفاضل' : '⚠️ العجز', money(Math.abs(s.net)), s.rate !== null ? 'نسبة الادخار ' + s.rate + '%' : '', s.net < 0 ? 'neg' : '')}
    ${st.avail === null ? kpi('blue', '💡 تقدر تصرف في اليوم', '—', 'حط أرصدة حساباتك أو حدد ميزانية عشان أحسبها') : kpi('blue', '💡 تقدر تصرف في اليوم', money(st.perDay), `لحد ${dsp(c.end)} · المتاح ${fmtMoney(st.avail)}`, st.avail < 0 ? 'neg' : '')}
  </div>`;
  if (al.length) h += `<div class="card"><div class="card-h"><span class="card-t">🔔 محتاج انتباهك</span><span class="chip ${al.some(a => a.lvl === 'red') ? 'red' : 'amber'}">${al.length}</span></div><div class="card-b">${al.slice(0, 7).map(a => `<div class="alert ${a.lvl}" onclick="${a.rec ? `payDue('${a.rec}','${a.due}')` : a.go ? `go('${a.go}')` : ''}">${esc(a.txt)}</div>`).join('')}${al.length > 7 ? `<div class="small">وكمان ${al.length - 7}…</div>` : ''}</div></div>`;
  h += `<div class="grid2">
    <div class="card"><div class="card-h"><span class="card-t">🍰 المصروف بالأقسام</span><span class="spacer"></span><button class="btn sm ghost" onclick="go('budget')">الميزانية ←</button></div><div class="card-b">${catDonut(s)}</div></div>
    <div class="card"><div class="card-h"><span class="card-t">📈 مصروف الشهر يوم بيوم</span></div><div class="card-b">${cumChart(c, t)}</div></div>
  </div><div class="gap"></div>`;
  h += `<div class="card"><div class="card-h"><span class="card-t">📊 الدخل والمصروف — آخر الشهور</span></div><div class="card-b">${monthsChart(12)}</div></div>`;
  const dues = dueList(D, addDays(t, -10), addDays(t, 14)).filter(x => !x.paid);
  const last = D.tx.slice().sort(txSort).slice(0, 7);
  h += `<div class="grid2">
    <div class="card"><div class="card-h"><span class="card-t">📅 الجاي في أسبوعين</span><span class="spacer"></span><button class="btn sm ghost" onclick="go('bills')">الالتزامات ←</button></div>${dues.length ? `<div class="tbl-wrap free"><table><tbody>${dues.map(dueRow).join('')}</tbody></table></div>` : emptyBox('✓', 'مفيش التزامات أو دخل متوقع في الأسبوعين الجايين')}</div>
    <div class="card"><div class="card-h"><span class="card-t">🧾 آخر الحركات</span><span class="spacer"></span><button class="btn sm ghost" onclick="go('tx')">الكل ←</button></div>${last.length ? `<div class="tbl-wrap free"><table><tbody>${last.map(x => txRow(x, true)).join('')}</tbody></table></div>` : emptyBox('🧾', 'لسه مفيش حركات — دوس «+» وسجّل أول مصروف')}</div>
  </div>`;
  return h;
};
function onboarding() {
  const hasOpen = D.accounts.some(a => num(a.opening)), hasInc = D.rec.some(r => r.kind === 'inc'), hasBud = totalBudget(D) > 0;
  const step = (done, txt, btn) => `<li style="${done ? 'color:#047857' : ''}">${done ? '✓ ' : ''}${txt} ${done ? '' : btn}</li>`;
  return `<div class="card pad" style="border-color:var(--gold)"><div class="card-t" style="margin-bottom:8px">👋 ابدأ في 4 خطوات</div><ol class="steps">
    ${step(hasOpen, 'حط الفلوس اللي معاك دلوقتي في كل حساب (كاش، بنك، محفظة)', `<button class="btn sm" onclick="go('accounts')">الحسابات</button>`)}
    ${step(hasInc, 'سجّل مرتبك أو دخلك الثابت وميعاده', `<button class="btn sm" onclick="recModal(null,'inc')">+ مصدر دخل</button>`)}
    ${step(D.rec.some(r => r.kind === 'exp'), 'سجّل الالتزامات الثابتة (إيجار، نت، أقساط، جمعية…)', `<button class="btn sm" onclick="recModal(null,'exp')">+ التزام</button>`)}
    ${step(hasBud, 'حدد ميزانية لكل قسم — أو خلّي البرنامج يقترح بعد شهر', `<button class="btn sm" onclick="go('budget')">الميزانية</button>`)}
  </ol><div class="small" style="margin-top:6px">ولو عايز تسجل من التليجرام برسالة زي «150 بنزين»: الإعدادات ← بوت التليجرام.</div></div>`;
}
function insights(t) {
  const out = [], c = cycleOf(t, cd()), p = projectCurrent(D, t), hist = history(D, t, 3);
  // قسم ماشي أعلى من المعتاد
  if (hist.length >= 2 && p.gone >= 7) {
    const s = summarize(D, c.start, t), factor = p.total / p.gone;
    let best = null;
    D.cats.filter(k => k.kind === 'exp').forEach(k => {
      const avg = hist.reduce((a, h) => a + (h.varCat[k.id] || 0), 0) / hist.length;
      let cur = 0; txIn(D, c.start, t).forEach(x => { if (x.kind === 'exp' && x.cat === k.id && !x.rec) cur += r2(x.amount); });
      const proj = cur * factor;
      if (avg > 300 && proj > avg * 1.3 && (!best || proj - avg > best.d)) best = { k, d: proj - avg, pct: Math.round((proj / avg - 1) * 100) };
    });
    if (best) out.push({ lvl: 'blue', key: 'ins_up', txt: `📈 ${best.k.icon} ${best.k.name} ماشي أعلى من المعتاد بحوالي ${best.pct}% الشهر ده`, go: 'forecast' });
  }
  // المرتب الجاي
  const nx = D.rec.filter(r => r.kind === 'inc').map(r => ({ r, d: recOccurrences(r, addDays(t, 1), addDays(t, 60))[0] })).filter(x => x.d).sort((a, b) => a.d < b.d ? -1 : 1)[0];
  if (nx) { const n = daysBetween(t, nx.d); if (n <= 10) out.push({ lvl: 'blue', key: 'ins_sal', txt: `💼 ${nx.r.name} الجاي بعد ${n === 1 ? 'يوم' : n + ' أيام'} (${shortDate(nx.d)}) — ${fmtMoney(nx.r.amount)}`, go: 'income' }); }
  return out;
}
function catDonut(s, clickable) {
  const ents = Object.keys(s.byCat).map(k => [k, s.byCat[k]]).sort((a, b) => b[1] - a[1]);
  if (!ents.length) return emptyBox('🍰', 'لسه مفيش مصروف في الشهر ده');
  const top = ents.slice(0, 8), rest = ents.slice(8).reduce((a, x) => a + x[1], 0);
  const segs = top.map((x, i) => ({ l: catOf(D, x[0]).name, v: x[1], c: PAL[i % PAL.length], id: x[0] }));
  if (rest > 0) segs.push({ l: 'باقي الأقسام', v: rest, c: '#CBD5E1' });
  return `<div class="donut-wrap">${donut(segs, kfmt(s.exp), 'ج.م مصروف')}<div class="donut-list">${segs.map(sg => `<div class="li" onclick="${sg.id ? `UI.filt.cat='${sg.id}';UI.filt.kind='exp';UI.view='tx';render()` : ''}"><i style="background:${sg.c}"></i><span>${esc(sg.l)}</span><bdi class="n">${fmtMoney(sg.v)}</bdi><small style="width:34px;text-align:left">${Math.round(sg.v / s.exp * 100)}%</small></div>`).join('')}</div></div>`;
}
function cumChart(c, t) {
  const N = daysBetween(c.start, c.end) + 1, bud = totalBudget(D), s = summarize(D, c.start, c.end);
  const upto = t < c.start ? -1 : Math.min(N - 1, daysBetween(c.start, t));
  const act = []; let cum = 0;
  for (let i = 0; i <= upto; i++) { const d = addDays(c.start, i); cum += s.byDay[d] || 0; act.push([i, r2(cum), dsp(d) + '\nلحد اليوم ده: ' + fmtMoney(cum) + (s.byDay[d] ? '\nفي اليوم ده: ' + fmtMoney(s.byDay[d]) : '')]); }
  const series = [];
  if (bud) series.push({ name: 'الميزانية', color: '#C9A227', pts: [[0, 0], [N - 1, bud]], dash: true, w: 1.8 });
  series.push({ name: 'اللي اتصرف', color: C_EXP, pts: act, fill: true, tips: true });
  const isCur = t >= c.start && t <= c.end;
  if (isCur && upto < N - 1 && D.tx.length) { const p = projectCurrent(D, t); series.push({ name: 'المتوقع لآخر الشهر', color: '#B45309', pts: [[upto, r2(cum)], [N - 1, p.expEnd]], dash: true, w: 2 }); }
  if (!act.length && !bud) return emptyBox('📈', 'الرسمة هتظهر لما تسجل مصروف');
  const xl = [[0, shortDate(c.start)], [Math.round((N - 1) / 2), shortDate(addDays(c.start, Math.round((N - 1) / 2)))], [N - 1, shortDate(c.end)]];
  return lineChart({ n: N, series, xlabels: xl, marker: isCur ? upto : null, h: 210 });
}
function monthsChart(n) {
  const cur = curCycle(), first = D.tx.reduce((m, x) => !m || x.date < m ? x.date : m, '');
  const labels = [], inc = [], exp = [], net = [];
  for (let i = n - 1; i >= 0; i--) {
    const c = cycleShift(cur, -i, cd());
    if (first && c.end < first && i > 2) continue;
    const s = summarize(D, c.start, c.end);
    labels.push(MONTHS[+c.key.slice(5) - 1]); inc.push(s.inc); exp.push(s.exp); net.push(s.net);
  }
  if (!D.tx.length) return emptyBox('📊', 'الرسمة هتظهر لما تسجل دخل ومصروف');
  return barChart({ labels, series: [{ name: 'الدخل', color: C_INC, vals: inc }, { name: 'المصروف', color: C_EXP, vals: exp }], line: { name: 'الفاضل', color: C_GOLD, vals: net }, hi: labels.length - 1 });
}

/* ---------- الحركات ---------- */
const txSort = (a, b) => a.date !== b.date ? (a.date < b.date ? 1 : -1) : ((a.at || '') < (b.at || '') ? 1 : -1);
const KIND_AR = { exp: 'مصروف', inc: 'دخل', xfer: 'تحويل', save: 'للهدف', unsave: 'من الهدف', adj: 'تسوية رصيد' };
function txRow(x, mini) {
  const k = catOf(D, x.cat), cls = x.kind === 'inc' ? 'inrow' : x.kind === 'xfer' || x.kind === 'adj' ? 'adjrow' : x.kind === 'save' || x.kind === 'unsave' ? 'basisrow' : '';
  let title, ic;
  if (x.kind === 'xfer') { ic = '🔁'; title = `تحويل: ${accLabel(x.acc)} ← ${accLabel(x.to)}`; }
  else if (x.kind === 'save' || x.kind === 'unsave') { const g = byId(D.goals, x.goal); ic = '🎯'; title = (x.kind === 'save' ? 'حطيت في: ' : 'سحبت من: ') + esc(g ? g.name : 'هدف ممسوح'); }
  else if (x.kind === 'adj') { ic = '⚖️'; title = 'تسوية رصيد'; }
  else { ic = k.icon; title = esc(k.name); }
  const chips = (x.via === 'telegram' ? ' <span class="chip blue" title="اتسجلت من التليجرام">🤖</span>' : x.via === 'auto' ? ' <span class="chip gray">تلقائي</span>' : '') + (x.rec ? ' <span class="chip gold">ثابت</span>' : '');
  const amtCls = x.kind === 'inc' || x.kind === 'unsave' ? 'amt-in' : x.kind === 'xfer' || x.kind === 'adj' ? 'amt-x' : 'amt-out';
  const amt = x.kind === 'inc' ? moneyS(x.amount, true) : x.kind === 'adj' ? moneyS(x.amount, true) : moneyS(x.amount);
  const sel = UI.sel.has(x.id) ? ' selrow' : '';
  return `<tr data-id="${x.id}" class="clk ${cls}${sel}" onclick="rowClick(event,'${x.id}')" ondblclick="txModal('${x.id}')" oncontextmenu="rowCtx(event,'${x.id}')">
    <td><div style="display:flex;gap:9px;align-items:center;min-width:0"><span style="font-size:19px;flex:0 0 auto">${ic}</span><div style="min-width:0"><b>${title}</b>${chips}<br><small>${mini ? dsp(x.date) + (x.note ? ' · ' : '') : ''}${esc(x.note || '')}${!mini && x.kind !== 'xfer' ? `<span class="hide-m-inline"> · ${accLabel(x.acc)}</span>` : ''}</small></div></div></td>
    ${mini ? '' : `<td class="hide-sm">${x.kind === 'xfer' ? '' : accLabel(x.acc)}</td>`}
    <td class="num ${amtCls}">${amt}</td>
    ${mini ? '' : `<td class="acts hide-sm"><button class="btn ghost" title="تعديل" onclick="event.stopPropagation();txModal('${x.id}')">✎</button><button class="btn ghost" title="مسح" onclick="event.stopPropagation();delTx(['${x.id}'])">🗑</button></td>`}
  </tr>`;
}
VIEWS.tx = () => {
  const c = cyc(), F = UI.filt, q = normAr(F.q);
  let L = q ? D.tx.slice() : txIn(D, c.start, c.end);
  L = L.filter(x => (!F.kind || x.kind === F.kind || (F.kind === 'save' && x.kind === 'unsave')) && (!F.cat || x.cat === F.cat) && (!F.acc || x.acc === F.acc || x.to === F.acc));
  if (q) L = L.filter(x => normAr([x.note, catOf(D, x.cat).name, accOf(D, x.acc).name, fmtMoney(x.amount), String(x.amount), dsp(x.date)].join(' ')).includes(q));
  L.sort(txSort);
  let inc = 0, exp = 0; L.forEach(x => { if (x.kind === 'inc') inc += r2(x.amount); else if (x.kind === 'exp') exp += r2(x.amount); });
  const kinds = [['', 'الكل'], ['exp', 'مصروف'], ['inc', 'دخل'], ['xfer', 'تحويل'], ['save', 'أهداف']];
  let h = topbar('الحركات', q ? 'بيدور في كل الشهور' : '', `<button class="btn hide-m" onclick="exportCSV()">⬇ CSV</button><button class="btn gold hide-m" onclick="txModal()">+ حركة</button>`);
  h += `<div class="card"><div class="card-h">${q ? '' : cycleNav()}<span class="spacer"></span>
    <div class="search"><input id="txq" placeholder="دوّر في الملاحظة أو القسم أو المبلغ…${IS_TOUCH ? '' : ' (Ctrl+F)'}" value="${esc(F.q)}" oninput="UI.filt.q=this.value;clearTimeout(window._qt);window._qt=setTimeout(()=>{render();const e=$('#txq');e.focus();e.setSelectionRange(e.value.length,e.value.length)},250)"></div></div>
    <div class="card-b" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding-top:10px;padding-bottom:10px">
      <div class="picks">${kinds.map(k => `<button class="pick ${F.kind === k[0] ? 'on' : ''}" onclick="UI.filt.kind='${k[0]}';render()">${k[1]}</button>`).join('')}</div>
      <select style="width:auto;max-width:180px" onchange="UI.filt.cat=this.value;render()"><option value="">كل الأقسام</option>${D.cats.map(k => `<option value="${k.id}" ${F.cat === k.id ? 'selected' : ''}>${k.icon} ${esc(k.name)}</option>`).join('')}</select>
      <select style="width:auto;max-width:160px" onchange="UI.filt.acc=this.value;render()"><option value="">كل الحسابات</option>${D.accounts.map(a => `<option value="${a.id}" ${F.acc === a.id ? 'selected' : ''}>${a.icon} ${esc(a.name)}</option>`).join('')}</select>
      ${F.kind || F.cat || F.acc || F.q ? `<button class="btn sm ghost" onclick="UI.filt={kind:'',cat:'',acc:'',q:''};render()">✕ شيل الفلتر</button>` : ''}
    </div>`;
  if (UI.sel.size > 1) {
    let sum = 0; UI.sel.forEach(id => { const x = byId(D.tx, id); if (x) sum += r2(x.amount); });
    h += `<div class="selbar" style="margin:0 12px 10px">✔ <b>${UI.sel.size}</b> محددين — المجموع <b>${fmtMoney(sum)}</b><span class="spacer"></span><button class="btn sm" onclick="bulkCat()">🏷 غيّر القسم</button><button class="btn sm danger" onclick="delTx(Array.from(UI.sel))">🗑 مسح</button><button class="btn sm" onclick="UI.sel.clear();render()">إلغاء</button></div>`;
  }
  if (!L.length) h += emptyBox('🧾', F.q || F.kind || F.cat || F.acc ? 'مفيش حركات بالفلتر ده' : 'مفيش حركات في الشهر ده', `<button class="btn gold" onclick="txModal()">+ سجّل حركة</button>`);
  else {
    let rows = '', lastD = '';
    const dayTot = {}; L.forEach(x => { if (x.kind === 'exp') dayTot[x.date] = r2((dayTot[x.date] || 0) + r2(x.amount)); });
    L.forEach(x => {
      if (x.date !== lastD) { lastD = x.date; rows += `<tr class="dayhead"><td colspan="4">${weekday(x.date)} ${dsp(x.date)}${dayTot[x.date] ? `<span class="pc">مصروف اليوم: ${fmtMoney(dayTot[x.date])}</span>` : ''}</td></tr>`; }
      rows += txRow(x);
    });
    h += `<div class="tbl-wrap"><table><thead><tr><th>البند</th><th class="hide-sm">الحساب</th><th class="num">المبلغ</th><th class="hide-sm"></th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4"><div style="display:flex;gap:16px;flex-wrap:wrap"><span>دخل: <span class="amt-in">${money(inc)}</span></span><span>مصروف: ${money(exp)}</span><span>الفرق: <b style="color:${inc - exp < 0 ? 'var(--red)' : 'var(--emer)'}">${money(inc - exp)}</b></span><span class="small">${L.length} حركة</span></div></td></tr></tfoot></table></div>`;
  }
  return h + '</div>';
};
let selAnchor = null;
function rowClick(e, id) {
  if (IS_TOUCH || UI.view !== 'tx') { txModal(id); return; }
  if (e.ctrlKey || e.metaKey) { UI.sel.has(id) ? UI.sel.delete(id) : UI.sel.add(id); selAnchor = id; }
  else if (e.shiftKey && selAnchor) {
    const ids = $$('#main tr[data-id]').map(r => r.dataset.id), a = ids.indexOf(selAnchor), b = ids.indexOf(id);
    if (a >= 0 && b >= 0) { UI.sel.clear(); ids.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => UI.sel.add(x)); }
  } else { const only = UI.sel.size === 1 && UI.sel.has(id); UI.sel.clear(); if (!only) UI.sel.add(id); selAnchor = id; }
  render();
}
function rowCtx(e, id) {
  e.preventDefault();
  if (!UI.sel.has(id)) { UI.sel.clear(); UI.sel.add(id); render(); }
  const r = $('#ctxRoot');
  r.innerHTML = `<div class="ctx" style="top:${Math.min(e.clientY, innerHeight - 170)}px;left:${Math.min(e.clientX, innerWidth - 230)}px">
    <button onclick="ctxClose();txModal('${id}')">✎ تعديل</button>
    <button onclick="ctxClose();dupTx('${id}')">⧉ تكرار<span class="k">Ctrl+D</span></button>
    <button onclick="ctxClose();bulkCat()">🏷 غيّر القسم</button>
    <div class="sep"></div><button class="danger" onclick="ctxClose();delTx(Array.from(UI.sel))">🗑 مسح<span class="k">Del</span></button></div>`;
  setTimeout(() => document.addEventListener('click', ctxClose, { once: true }), 0);
}
function ctxClose() { $('#ctxRoot').innerHTML = ''; }
function delTx(ids) {
  ids = ids.filter(id => byId(D.tx, id));
  if (!ids.length) return;
  const go = () => { UI.sel.clear(); commit(ids.map(id => del('tx', id)), ids.length > 1 ? `اتمسح ${ids.length} حركات (في السلة)` : 'اتمسحت (في سلة المحذوفات)'); };
  if (ids.length > 1) askYesNo('مسح حركات', `هتمسح <b>${ids.length}</b> حركات. هيروحوا سلة المحذوفات وتقدر ترجعهم.`, go, '🗑 امسح', true);
  else go();
}
function dupTx(id) { const x = byId(D.tx, id); if (!x) return; const n = clone(x); n.id = uid('t'); n.at = nowLocal(); n.via = 'app'; delete n.rec; delete n.due; commit([put('tx', n)], 'اتكررت ✓', { flash: n.id }); }
function bulkCat() {
  const ids = Array.from(UI.sel).filter(id => { const x = byId(D.tx, id); return x && (x.kind === 'exp' || x.kind === 'inc'); });
  if (!ids.length) { toast('اختار حركات مصروف أو دخل الأول'); return; }
  const kind = byId(D.tx, ids[0]).kind;
  modal('غيّر القسم لـ ' + ids.length + ' حركة', `<div class="picks">${D.cats.filter(k => k.kind === kind && !k.archived).map(k => `<button class="pick" onclick="_bulkSet('${k.id}')">${k.icon} ${esc(k.name)}</button>`).join('')}</div>`, '<button class="btn" onclick="closeModal()">إلغاء</button>');
  window._bulkSet = cat => { closeModal(); commit(ids.map(id => { const n = clone(byId(D.tx, id)); n.cat = cat; return put('tx', n); }), 'اتغير القسم ✓'); };
}

/* ---------- الميزانية ---------- */
function avgVar(catId, n) {
  const h = history(D, todayISO(), n || 3);
  if (!h.length) return 0;
  return r2(h.reduce((a, x) => a + (x.varCat[catId] || 0), 0) / h.length);
}
function fixedMonthly(catId) {   // متوسط شهري للالتزامات في القسم ده
  let s = 0; D.rec.forEach(r => { if (r.kind === 'exp' && r.cat === catId && r.active !== false && r.freq !== 'once') s += monthlyEq(r); }); return r2(s);
}
function monthlyEq(r) { const a = num(r.amount); return r.freq === 'y' ? a / 12 : r.freq === 'q' ? a / 3 : r.freq === 'w' ? a * 52 / 12 : r.freq === 'once' ? 0 : a; }
VIEWS.budget = () => {
  const c = cyc(), t = todayISO(), rows = budgetRows(D, c), s = summarize(D, c.start, c.end), bud = totalBudget(D);
  const fc = forecastCycle(D, c, t), expInc = Math.max(s.inc, fc.inc);
  let h = topbar('الميزانية', 'الميزانية رقم ثابت لكل قسم كل شهر — غيّرها في أي وقت من الخانة', `<button class="btn hide-m" onclick="suggestBudget()">✨ اقترح ميزانية</button><button class="btn gold" onclick="catModal(null,'exp')">+ قسم</button>`);
  h += `<div class="kpis">${kpi('gold', '🎯 الميزانية', money(bud), bud ? '' : 'لسه ما اتحددتش')}${kpi('navy', '🧾 اتصرف', money(s.exp), bud ? Math.round(s.exp / bud * 100) + '% من الميزانية' : '')}${kpi(bud - s.exp < 0 ? 'red' : 'emer', bud - s.exp < 0 ? '⚠️ عدّيت بـ' : '✅ فاضل', money(Math.abs(bud - s.exp)), '', bud - s.exp < 0 ? 'neg' : '')}${kpi('blue', '💰 دخلك المتوقع', money(expInc), expInc && bud ? (expInc >= bud ? 'لو التزمت هيفضل ' + fmtMoney(expInc - bud) : 'الميزانية أكبر من الدخل بـ ' + fmtMoney(bud - expInc)) : '')}</div>`;
  if (bud && expInc && bud > expInc) h += `<div class="note">⚠ مجموع الميزانية (${fmtMoney(bud)}) أكبر من دخلك المتوقع (${fmtMoney(expInc)}). قلّل الأقسام اللي تقدر تستغنى فيها.</div>`;
  if (!bud) h += `<div class="note blue">💡 اكتب ميزانية كل قسم في الخانة واطلع منها — بتتحفظ لوحدها. ${D.tx.length > 10 ? 'أو دوس «✨ اقترح ميزانية» وهو يحسبها من مصروفك الفعلي.' : ''}</div>`;
  h += `<div class="card"><div class="card-h">${cycleNav()}<span class="spacer"></span><button class="btn sm" onclick="suggestBudget()">✨ اقترح</button></div>
  <div class="tbl-wrap"><table><thead><tr><th>القسم</th><th>الميزانية</th><th class="num">اتصرف</th><th class="num hide-sm">فاضل</th><th style="min-width:90px">التقدم</th><th class="num hide-sm">متوسط 3 شهور</th></tr></thead><tbody>
  ${rows.map(r => `<tr data-id="${r.cat.id}"><td><span style="font-size:17px">${r.cat.icon}</span> <a href="#" onclick="UI.filt={kind:'exp',cat:'${r.cat.id}',acc:'',q:''};UI.view='tx';render();return false" style="color:inherit;text-decoration:none;font-weight:600">${esc(r.cat.name)}</a></td>
    <td style="width:130px"><input data-money class="bud-in" value="${r.budget ? fmtMoney(r.budget) : ''}" placeholder="—" style="padding:6px 9px;font-weight:700" onchange="saveBudget('${r.cat.id}',this)" onfocus="this.select()"></td>
    <td class="num"><b>${fmtMoney(r.spent)}</b></td><td class="num hide-sm" style="color:${r.left < 0 ? 'var(--red)' : 'inherit'}">${r.budget ? fmtMoney(r.left) : '—'}</td>
    <td>${r.budget ? `<div class="small" style="display:flex;justify-content:space-between"><span>${r.pct}%</span>${r.left < 0 ? '<span style="color:var(--red)">عدّى</span>' : ''}</div>${pctBar(r.spent, r.budget)}` : r.spent ? '<span class="chip gray">من غير ميزانية</span>' : ''}</td>
    <td class="num hide-sm small">${fmtMoney(avgVar(r.cat.id) + fixedMonthly(r.cat.id))}</td></tr>`).join('')}
  </tbody><tfoot><tr><td>الإجمالي</td><td class="num">${fmtMoney(bud)}</td><td class="num">${fmtMoney(s.exp)}</td><td class="num hide-sm">${fmtMoney(bud - s.exp)}</td><td>${pctBar(s.exp, bud)}</td><td class="hide-sm"></td></tr></tfoot></table></div></div>`;
  // ٥٠/٣٠/٢٠
  if (expInc > 0) {
    const needs = ['c_food', 'c_home', 'c_bills', 'c_health', 'c_edu', 'c_car', 'c_debt'], ns = rows.filter(r => needs.includes(r.cat.id)).reduce((a, r) => a + (r.budget || r.spent), 0), ws = rows.filter(r => !needs.includes(r.cat.id)).reduce((a, r) => a + (r.budget || r.spent), 0);
    h += `<div class="card pad"><div class="card-t" style="margin-bottom:6px">📐 قاعدة 50 / 30 / 20 على دخلك المتوقع (${fmtMoney(expInc)})</div>
      <div class="grid3"><div><div class="mini-l">الأساسيات (50%) — أكل، سكن، فواتير، صحة، تعليم، عربية، أقساط</div><div class="mini-v">${fmtMoney(expInc * .5)}</div><div class="small">ميزانيتك فيها: ${fmtMoney(ns)} (${Math.round(ns / expInc * 100)}%)</div></div>
      <div><div class="mini-l">الكماليات (30%)</div><div class="mini-v">${fmtMoney(expInc * .3)}</div><div class="small">ميزانيتك فيها: ${fmtMoney(ws)} (${Math.round(ws / expInc * 100)}%)</div></div>
      <div><div class="mini-l">الادخار (20%)</div><div class="mini-v" style="color:var(--emer)">${fmtMoney(expInc * .2)}</div><div class="small">المتوقع يفضل: ${fmtMoney(expInc - ns - ws)} (${Math.round((expInc - ns - ws) / expInc * 100)}%)</div></div></div></div>`;
  }
  return h;
};
function saveBudget(id, el) {
  const k = byId(D.cats, id); if (!k) return;
  const v = el.value.startsWith('=') ? r2(safeEvalFormula(el.value.slice(1))) : r2(num(el.value));
  if (v === r2(num(k.budget))) return;
  const n = clone(k); n.budget = v;
  commit([put('cats', n)], 'ميزانية ' + k.name + ': ' + fmtMoney(v) + ' ✓', { flash: id });
}
function suggestBudget() {
  const h = history(D, todayISO(), 3);
  if (!h.length) { toast('محتاج شهر كامل على الأقل من الحركات عشان أقترح'); return; }
  const sug = D.cats.filter(k => k.kind === 'exp' && !k.archived).map(k => {
    const base = avgVar(k.id, 3) * 1.05 + fixedMonthly(k.id);
    return { k, v: base > 0 ? Math.ceil(base / 50) * 50 : 0 };
  }).filter(x => x.v > 0 || num(x.k.budget));
  const tot = sug.reduce((a, x) => a + x.v, 0);
  modal('✨ ميزانية مقترحة من مصروفك', `<div class="note blue">حسبتها من متوسط آخر ${h.length} شهور + 5% احتياطي + الالتزامات الثابتة، ومقرّبة لأقرب 50. علّم اللي عايز تطبّقه.</div>
    <table><thead><tr><th></th><th>القسم</th><th class="num">الحالية</th><th class="num">المقترحة</th></tr></thead><tbody>${sug.map((x, i) => `<tr><td><input type="checkbox" id="sg${i}" checked></td><td>${x.k.icon} ${esc(x.k.name)}</td><td class="num">${num(x.k.budget) ? fmtMoney(x.k.budget) : '—'}</td><td class="num"><b>${fmtMoney(x.v)}</b></td></tr>`).join('')}</tbody><tfoot><tr><td></td><td>الإجمالي</td><td class="num">${fmtMoney(totalBudget(D))}</td><td class="num">${fmtMoney(tot)}</td></tr></tfoot></table>`,
    `<button class="btn navy" onclick="_sgApply()">طبّق المعلّم</button><button class="btn" onclick="closeModal()">إلغاء</button>`, true);
  window._sgApply = () => { const ops = sug.filter((x, i) => cval('sg' + i)).map(x => { const n = clone(x.k); n.budget = x.v; return put('cats', n); }); closeModal(); commit(ops, 'الميزانية اتحدثت ✓'); };
}

/* ---------- الدخل والمرتب ---------- */
function recNext(r, from) { return recOccurrences(r, from || todayISO(), addDays(from || todayISO(), 800))[0] || ''; }
function recCount(r) { if (!r.count) return null; const paid = D.tx.filter(x => x.rec === r.id).length; return { paid, total: Math.round(num(r.count)) }; }
function recCard(r, c) {
  const dl = dueList(D, c.start, c.end).filter(x => x.rec.id === r.id), t = todayISO(), nx = recNext(r, t);
  const st = dl.length ? dl.map(x => x.paid ? `<span class="chip pay">${r.kind === 'inc' ? 'اتقبض' : 'اتدفع'} ${shortDate(x.paid.date)}</span>` : x.due < t ? `<span class="chip red">متأخر من ${shortDate(x.due)}</span>` : `<span class="chip gray">${shortDate(x.due)}</span>`).join(' ') : '<span class="chip gray">مالوش ميعاد الشهر ده</span>';
  const open = dl.find(x => !x.paid), cnt = recCount(r);
  return `<div class="acc" data-id="${r.id}" style="${r.active === false ? 'opacity:.55' : ''}"><div class="an"><span class="ic">${catOf(D, r.cat).icon}</span>${esc(r.name)}${r.auto ? ' <span class="chip gray">تلقائي</span>' : ''}${r.active === false ? ' <span class="chip gray">موقوف</span>' : ''}</div>
    <div class="am">${FREQ[r.freq] || ''}${r.freq === 'm' || r.freq === 'q' ? ' · يوم ' + (r.day || (r.start || '').slice(8)) : ''} · ${accLabel(r.acc)}${cnt ? ` · ${cnt.paid} من ${cnt.total} قسط` : ''}</div>
    <div class="big">${money(r.amount)}</div>
    <div class="row" style="margin-top:6px"><span>الشهر ده</span><span>${st}</span></div>
    <div class="row"><span>الجاي</span><b>${nx ? dsp(nx) + ' (' + weekday(nx) + ')' : '—'}</b></div>
    ${cnt ? `<div class="bar ${cnt.paid >= cnt.total ? 'done' : 'prog'}"><i style="width:${Math.min(100, cnt.paid / cnt.total * 100)}%"></i></div>` : ''}
    <div class="acts">${open ? `<button class="btn sm ${r.kind === 'inc' ? 'emer' : 'navy'}" onclick="payDue('${r.id}','${open.due}')">${r.kind === 'inc' ? '✓ اتقبض' : '+ سداد'}</button>` : ''}<button class="btn sm" onclick="recModal('${r.id}')">✎ تعديل</button></div></div>`;
}
VIEWS.income = () => {
  const c = cyc(), t = todayISO(), s = summarize(D, c.start, c.end), recs = D.rec.filter(r => r.kind === 'inc');
  const fixedM = recs.filter(r => r.active !== false).reduce((a, r) => a + monthlyEq(r), 0);
  const h6 = []; for (let i = 1; i <= 6; i++) { const cc = cycleShift(curCycle(), -i, cd()); if (D.tx.some(x => x.date <= cc.end)) h6.push(summarize(D, cc.start, cc.end).inc); }
  const avg6 = h6.length ? h6.reduce((a, b) => a + b, 0) / h6.length : 0;
  const left = dueList(D, c.start, c.end).filter(x => x.rec.kind === 'inc' && !x.paid).reduce((a, x) => a + num(x.rec.amount), 0);
  let h = topbar('الدخل والمرتب', 'المرتب وأي دخل ثابت بميعاده — والبرنامج يفكرك لو ما اتسجلش', `<button class="btn gold" onclick="recModal(null,'inc')">+ مصدر دخل</button>`);
  h += `<div class="kpis">${kpi('emer', '💰 دخل الشهر', money(s.inc), '')}${kpi('navy', '📌 الدخل الثابت كل شهر', money(fixedM), recs.length + ' مصدر')}${kpi('blue', '📊 متوسط آخر 6 شهور', money(avg6), h6.length ? 'من ' + h6.length + ' شهور' : 'لسه مفيش تاريخ')}${kpi('amber', '⏳ لسه جاي الشهر ده', money(left), '')}</div>`;
  h += `<div class="card"><div class="card-h"><span class="card-t">💼 مصادر الدخل الثابتة</span><span class="spacer"></span>${cycleNav()}</div><div class="card-b">${recs.length ? `<div class="accs" style="margin:0">${recs.map(r => recCard(r, c)).join('')}</div>` : emptyBox('💼', 'سجّل مرتبك وميعاده (مثلاً يوم 1 أو 25 كل شهر) — والبرنامج هيحسب منه التوقعات ويفكرك', `<button class="btn gold" onclick="recModal(null,'inc')">+ المرتب</button>`)}</div></div>`;
  // رسمة الدخل بالمصدر
  const cur = curCycle(), labels = [], incCats = D.cats.filter(k => k.kind === 'inc'), ser = incCats.map((k, i) => ({ name: k.name, color: [C_INC, C_GOLD, '#1D4ED8', '#24507D', '#B45309', '#64748B'][i % 6], vals: [] }));
  const first = D.tx.reduce((m, x) => !m || x.date < m ? x.date : m, '');
  for (let i = 11; i >= 0; i--) { const cc = cycleShift(cur, -i, cd()); if (first && cc.end < first && i > 2) continue; const ss = summarize(D, cc.start, cc.end); labels.push(MONTHS[+cc.key.slice(5) - 1]); incCats.forEach((k, j) => ser[j].vals.push(ss.byIncCat[k.id] || 0)); }
  const used = ser.filter(x => x.vals.some(v => v));
  if (used.length) h += `<div class="card"><div class="card-h"><span class="card-t">📊 الدخل بالمصدر</span></div><div class="card-b">${barChart({ labels, series: used, stacked: true })}</div></div>`;
  const L = txIn(D, c.start, c.end).filter(x => x.kind === 'inc').sort(txSort);
  h += `<div class="card"><div class="card-h"><span class="card-t">🧾 دخل ${esc(cycleName(c, cd()))}</span><span class="spacer"></span><button class="btn sm" onclick="txModal(null,{kind:'inc'})">+ دخل</button></div>${L.length ? `<div class="tbl-wrap"><table><tbody>${L.map(x => txRow(x, true)).join('')}</tbody><tfoot><tr><td>الإجمالي</td><td class="num">${money(s.inc)}</td></tr></tfoot></table></div>` : emptyBox('💵', 'مفيش دخل متسجل في الشهر ده')}</div>`;
  return h;
};

/* ---------- الالتزامات ---------- */
function dueRow(x) {
  const t = todayISO(), n = daysBetween(t, x.due), r = x.rec, inc = r.kind === 'inc';
  const chip = x.paid ? `<span class="chip pay">${inc ? 'اتقبض' : 'اتدفع'}</span>` : n < 0 ? `<span class="chip red">${inc ? 'متأخر' : 'متأخر'} ${-n} يوم</span>` : n === 0 ? '<span class="chip amber">النهارده</span>' : n <= (r.remind == null ? 3 : num(r.remind)) ? `<span class="chip amber">بعد ${n} ${n === 1 ? 'يوم' : 'أيام'}</span>` : `<span class="chip gray">بعد ${n} يوم</span>`;
  return `<tr class="${x.paid ? 'payrow' : inc ? 'inrow' : ''}"><td class="dt">${dsp(x.due)}</td><td>${catOf(D, r.cat).icon} <b>${esc(r.name)}</b><br><small>${inc ? 'دخل' : esc(catOf(D, r.cat).name)} · ${chip}</small></td><td class="num ${inc ? 'amt-in' : ''}"><b>${fmtMoney(x.paid ? x.paid.amount : r.amount)}</b></td>
    <td class="acts">${x.paid ? `<button class="btn ghost sm" onclick="txModal('${x.paid.id}')">✎</button>` : `<button class="btn sm ${inc ? 'emer' : 'navy'}" onclick="payDue('${r.id}','${x.due}')">${inc ? '✓ اتقبض' : '+ سداد'}</button>`}</td></tr>`;
}
function payDue(recId, due) {
  const r = byId(D.rec, recId); if (!r) return;
  const t = todayISO();
  txModal(null, { kind: r.kind, amount: r.amount, cat: r.cat, acc: r.acc || D.settings.defAcc, rec: r.id, due, date: due <= t ? t : due, note: r.name });
}
VIEWS.bills = () => {
  const c = cyc(), t = todayISO(), dues = dueList(D, c.start, c.end).filter(x => x.rec.kind === 'exp');
  const tot = dues.reduce((a, x) => a + num(x.rec.amount), 0), paid = dues.filter(x => x.paid).reduce((a, x) => a + num(x.paid.amount), 0);
  const nextOpen = dueList(D, addDays(t, -60), addDays(t, 60)).filter(x => !x.paid && x.rec.kind === 'exp')[0];
  const recs = D.rec.filter(r => r.kind === 'exp').sort((a, b) => (recNext(a) || '9') < (recNext(b) || '9') ? -1 : 1);
  let h = topbar('الالتزامات الثابتة', 'إيجار، فواتير، أقساط، جمعيات، اشتراكات — بميعادها، والبرنامج يفكرك قبلها', `<button class="btn gold" onclick="recModal(null,'exp')">+ التزام</button>`);
  h += `<div class="kpis">${kpi('navy', '📅 التزامات الشهر', money(tot), dues.length + ' استحقاق')}${kpi('emer', '✓ اتدفع', money(paid), dues.filter(x => x.paid).length + ' من ' + dues.length)}${kpi('amber', '⏳ فاضل', money(Math.max(0, tot - paid)), '')}${kpi(nextOpen && nextOpen.due < t ? 'red' : 'blue', '⏰ أقرب ميعاد', nextOpen ? esc(nextOpen.rec.name) : '—', nextOpen ? dsp(nextOpen.due) + ' · ' + fmtMoney(nextOpen.rec.amount) : 'مفيش حاجة مفتوحة ✓')}</div>`;
  h += `<div class="card"><div class="card-h"><span class="card-t">استحقاقات الشهر</span><span class="spacer"></span>${cycleNav()}</div>${dues.length ? `<div class="tbl-wrap"><table><thead><tr><th>الميعاد</th><th>البند</th><th class="num">المبلغ</th><th></th></tr></thead><tbody>${dues.map(dueRow).join('')}</tbody><tfoot><tr><td colspan="2">الإجمالي</td><td class="num">${fmtMoney(tot)}</td><td></td></tr></tfoot></table></div>` : emptyBox('📅', 'مفيش التزامات في الشهر ده')}</div>`;
  h += `<div class="card"><div class="card-h"><span class="card-t">كل الالتزامات</span><span class="chip gray">${recs.length}</span></div><div class="card-b">${recs.length ? `<div class="accs" style="margin:0">${recs.map(r => recCard(r, c)).join('')}</div>` : emptyBox('📌', 'سجّل الحاجات اللي بتدفعها كل شهر: الإيجار، النت، الكهربا، قسط العربية، الجمعية…', `<button class="btn gold" onclick="recModal(null,'exp')">+ التزام</button>`)}</div></div>`;
  return h;
};

/* ---------- التوقعات ---------- */
VIEWS.forecast = () => {
  const t = todayISO(), c = curCycle(), p = projectCurrent(D, t), nx = cycleShift(c, 1, cd()), f = forecastCycle(D, nx, t), tl = balanceTimeline(D, t, 60);
  let h = topbar('التوقعات', 'محسوبة من الالتزامات الثابتة + متوسط مصروفك الفعلي (الأحدث وزنه أكبر)', '');
  if (!D.tx.length) return h + `<div class="card">${emptyBox('🔮', 'التوقعات بتتحسب من حركاتك والتزاماتك — سجّل كام حركة والمرتب والالتزامات وهتظهر هنا')}</div>`;
  // ١) الشهر ده
  h += `<div class="card"><div class="card-h"><span class="card-t">🔭 ${esc(cycleName(c, cd()))} لحد آخره</span><span class="small">فاضل ${p.left} يوم</span></div><div class="card-b">
    <div class="kpis" style="margin-bottom:12px">${kpi('navy', 'هتصرف حوالي', money(p.expEnd), `اتصرف ${fmtMoney(p.s.exp)} + ثابت لسه ${fmtMoney(p.dueExpLeft)}`)}${kpi('emer', 'هيدخلك', money(p.incEnd), p.dueIncLeft ? 'منهم ' + fmtMoney(p.dueIncLeft) + ' لسه جاي' : '')}${kpi(p.netEnd < 0 ? 'red' : 'gold', p.netEnd < 0 ? 'عجز متوقع' : 'هيفضل', money(Math.abs(p.netEnd)), '', p.netEnd < 0 ? 'neg' : 'pos')}${kpi('blue', 'معدلك اليومي', money(p.daily), 'في المصروف المتغير')}</div>
    ${cumChart(c, t)}</div></div>`;
  // ٢) الشهر الجاي
  h += `<div class="card"><div class="card-h"><span class="card-t">🔮 توقع ${esc(cycleName(nx, cd()))}</span><span class="small">${esc(cycleLabel(nx, cd()))}</span></div><div class="card-b">
    ${!f.basis ? '<div class="note">لسه مفيش شهر كامل متسجل — المتغير محسوب من الميزانية اللي حددتها. التوقع هيبقى أدق بعد أول شهر.</div>' : `<div class="note blue">على أساس آخر ${f.basis} ${f.basis === 1 ? 'شهر' : 'شهور'}. المدى = المتوقع ± التذبذب المعتاد في مصروفك.</div>`}
    <div class="kpis" style="margin-bottom:12px">${kpi('emer', 'الدخل المتوقع', money(f.inc), f.varInc ? 'ثابت ' + fmtMoney(f.fixedInc) + ' + متغير ' + fmtMoney(f.varInc) : 'كله ثابت')}${kpi('navy', 'المصروف المتوقع', money(f.exp), 'بين ' + fmtMoney(f.lo) + ' و ' + fmtMoney(f.hi))}${kpi(f.net < 0 ? 'red' : 'gold', f.net < 0 ? 'عجز متوقع' : 'هيفضل حوالي', money(Math.abs(f.net)), f.inc ? 'ادخار ' + Math.round(f.net / f.inc * 100) + '%' : '', f.net < 0 ? 'neg' : 'pos')}${kpi('amber', 'للأهداف', money(f.goals), f.goals ? 'عشان توصل في ميعادك' : 'مفيش أهداف بميعاد')}</div>
    <div class="tbl-wrap free"><table><thead><tr><th>القسم</th><th class="num">ثابت</th><th class="num">متغير</th><th class="num hide-sm">المدى</th><th class="num">المتوقع</th><th class="num hide-sm">الميزانية</th><th class="hide-sm">الاتجاه</th></tr></thead><tbody>
    ${f.rows.map(r => `<tr><td>${r.cat.icon} ${esc(r.cat.name)}</td><td class="num">${r.fixed ? fmtMoney(r.fixed) : '—'}</td><td class="num">${fmtMoney(r.v.avg)}</td><td class="num hide-sm small">${fmtMoney(r.v.lo)} – ${fmtMoney(r.v.hi)}</td><td class="num"><b>${fmtMoney(r.total)}</b></td><td class="num hide-sm" style="color:${r.budget && r.total > r.budget ? 'var(--red)' : 'inherit'}">${r.budget ? fmtMoney(r.budget) : '—'}</td><td class="hide-sm">${r.trend == null ? '' : r.trend > 8 ? `<span class="chip red">↑ ${r.trend}%</span>` : r.trend < -8 ? `<span class="chip emer">↓ ${-r.trend}%</span>` : '<span class="chip gray">ثابت</span>'}</td></tr>`).join('')}
    </tbody><tfoot><tr><td>المصروف</td><td class="num">${fmtMoney(f.fixedExp)}</td><td class="num">${fmtMoney(f.varExp)}</td><td class="num hide-sm small">${fmtMoney(f.lo)} – ${fmtMoney(f.hi)}</td><td class="num">${fmtMoney(f.exp)}</td><td class="num hide-sm">${fmtMoney(totalBudget(D))}</td><td class="hide-sm"></td></tr></tfoot></table></div>
    ${f.incRows.length ? `<div class="tbl-wrap free" style="margin-top:12px"><table><thead><tr><th>الدخل</th><th class="num">ثابت</th><th class="num">متغير (بحذر)</th><th class="num">المتوقع</th></tr></thead><tbody>${f.incRows.map(r => `<tr class="inrow"><td>${r.cat.icon} ${esc(r.cat.name)}</td><td class="num">${r.fixed ? fmtMoney(r.fixed) : '—'}</td><td class="num">${fmtMoney(r.v.avg)}</td><td class="num"><b>${fmtMoney(r.total)}</b></td></tr>`).join('')}</tbody></table></div>` : ''}
    ${forecastTips(f)}
  </div></div>`;
  // ٣) الرصيد المتوقع
  const N = tl.pts.length, xl = [[0, 'النهارده'], [Math.round(N / 2), shortDate(tl.pts[Math.round(N / 2)].d)], [N - 1, shortDate(tl.pts[N - 1].d)]];
  const dueDots = dueList(D, addDays(t, 1), addDays(t, 60)).filter(x => !x.paid).map(x => { const i = daysBetween(t, x.due); return [i, tl.pts[i] ? tl.pts[i].v : 0, x.rec.kind === 'inc' ? '#059669' : '#B45309', dsp(x.due) + '\n' + x.rec.name + ': ' + (x.rec.kind === 'inc' ? '+' : '−') + fmtMoney(x.rec.amount)]; });
  h += `<div class="card"><div class="card-h"><span class="card-t">🏦 رصيدك المتوقع لـ 60 يوم</span></div><div class="card-b">
    ${tl.lowest.v < 0 ? `<div class="note" style="background:#FEF2F2;border-color:#FECACA;color:#7F1D1D">📉 على المعدل ده الرصيد هيبقى بالسالب حوالي ${dsp(tl.lowest.d)} (${fmtMoney(tl.lowest.v)}). يا إما تقلل المتغير، يا إما تأجل حاجة.</div>` : `<div class="note emer">✓ أقل رصيد متوقع ${fmtMoney(tl.lowest.v)} يوم ${dsp(tl.lowest.d)} — مفيش عجز متوقع.</div>`}
    ${lineChart({ n: N, series: [{ name: 'الرصيد المتوقع', color: C_EXP, pts: tl.pts.map((p, i) => [i, p.v, dsp(p.d) + '\n' + fmtMoney(p.v)]), fill: true, tips: true }], xlabels: xl, dots: dueDots, h: 220 })}
    <div class="small">النقط: 🟢 دخل ثابت · 🟠 التزام. الخط بيفترض إنك هتصرف المتغير بنفس معدلك المعتاد. الرصيد من «الحسابات» — لو مش مظبوط ظبّطه هناك.</div></div></div>`;
  return h;
};
function forecastTips(f) {
  const tips = [];
  if (f.net < 0) {
    const up = f.rows.filter(r => r.trend > 8 && r.v.avg > 200).sort((a, b) => b.v.avg - a.v.avg).slice(0, 3);
    tips.push(`⚠ المتوقع إن المصروف يزيد عن الدخل بـ ${fmtMoney(-f.net)}.` + (up.length ? ' أكتر حاجات بتزيد: ' + up.map(r => r.cat.name + ' (↑' + r.trend + '%)').join('، ') + '.' : ''));
  }
  const over = f.rows.filter(r => r.budget && r.total > r.budget * 1.1);
  if (over.length) tips.push('🎯 متوقع تعدّي ميزانية: ' + over.map(r => r.cat.name).join('، ') + ' — يا إما تزوّد الميزانية يا إما تقلل.');
  if (f.net > 0 && f.inc) tips.push(`💡 لو حطيت ${fmtMoney(Math.floor(f.net * 0.7 / 50) * 50)} في هدف أول ما المرتب ينزل، هيفضلك احتياطي ${fmtMoney(f.net - Math.floor(f.net * 0.7 / 50) * 50)}.`);
  return tips.length ? `<div style="margin-top:12px">${tips.map(x => `<div class="alert ${x.startsWith('⚠') ? 'red' : x.startsWith('🎯') ? 'amber' : 'blue'}" style="cursor:default">${esc(x)}</div>`).join('')}</div>` : '';
}

/* ---------- الحسابات ---------- */
VIEWS.accounts = () => {
  const t = todayISO(), b = balances(D, t);
  const tot = D.accounts.filter(a => !a.archived).reduce((s, a) => s + (b[a.id] || 0), 0), goals = D.goals.reduce((s, g) => s + goalSaved(D, g.id), 0);
  let debtIn = 0, debtOut = 0; D.debts.forEach(d => { const l = debtLeft(d); if (l > 0) { if (d.dir === 'in') debtIn += l; else debtOut += l; } });
  let h = topbar('الحسابات', 'الكاش والبنك والمحافظ — والرصيد بيتحسب من «رصيد البداية» + كل الحركات', `<button class="btn hide-m" onclick="txModal(null,{kind:'xfer'})">🔁 تحويل</button><button class="btn gold" onclick="accModal()">+ حساب</button>`);
  h += `<div class="kpis">${kpi('navy', '🏦 الفلوس اللي معاك', money(tot), D.accounts.filter(a => !a.archived).length + ' حسابات')}${kpi('gold', '🎯 في الأهداف', money(goals), '')}${kpi('emer', '🤝 ليك عند الناس', money(debtIn), '')}${kpi('blue', '💎 صافي فلوسك', money(tot + goals + debtIn - debtOut), debtOut ? 'بعد ما تطرح ' + fmtMoney(debtOut) + ' عليك' : '')}</div>`;
  h += `<div class="accs">${D.accounts.map(a => {
    const last = D.tx.filter(x => x.acc === a.id || x.to === a.id).sort(txSort)[0];
    return `<div class="acc" data-id="${a.id}" style="${a.archived ? 'opacity:.55' : ''}"><div class="an"><span class="ic">${a.icon}</span>${esc(a.name)}${a.id === D.settings.defAcc ? ' <span class="chip gold">الأساسي</span>' : ''}${a.archived ? ' <span class="chip gray">مقفول</span>' : ''}</div>
      <div class="am">رصيد البداية ${fmtMoney(a.opening)}${last ? ' · آخر حركة ' + dsp(last.date) : ''}</div>
      <div class="big" style="color:${(b[a.id] || 0) < 0 ? 'var(--red)' : 'var(--navy)'}">${money(b[a.id] || 0)}</div>
      <div class="acts"><button class="btn sm" onclick="adjModal('${a.id}')">⚖️ ظبّط الرصيد</button><button class="btn sm" onclick="UI.filt={kind:'',cat:'',acc:'${a.id}',q:''};UI.view='tx';render()">🧾 الحركات</button><button class="btn sm ghost" onclick="accModal('${a.id}')">✎</button></div></div>`;
  }).join('')}</div>`;
  h += `<div class="note blue">💡 «ظبّط الرصيد»: اكتب الفلوس اللي في إيدك فعلاً والبرنامج يعمل تسوية بالفرق — من غير ما تبوّظ المصروف أو الميزانية.</div>`;
  return h;
};

/* ---------- الأهداف ---------- */
VIEWS.goals = () => {
  const t = todayISO();
  let h = topbar('الأهداف والادخار', 'حط فلوس على جنب لهدف — والبرنامج يقولك محتاج كام كل شهر عشان توصل', `<button class="btn gold" onclick="goalModal()">+ هدف</button>`);
  const tot = D.goals.reduce((s, g) => s + goalSaved(D, g.id), 0), target = D.goals.reduce((s, g) => s + num(g.target), 0);
  if (D.goals.length) h += `<div class="kpis">${kpi('gold', '🎯 اتحوش', money(tot), target ? Math.round(tot / target * 100) + '% من ' + fmtMoney(target) : '')}${kpi('blue', '📅 محتاج كل شهر', money(D.goals.reduce((s, g) => s + goalMonthly(D, g, t), 0)), 'لكل الأهداف اللي ليها ميعاد')}</div>`;
  h += D.goals.length ? `<div class="accs">${D.goals.map(g => {
    const sv = goalSaved(D, g.id), tg = num(g.target), need = goalMonthly(D, g, t), pct = tg ? sv / tg * 100 : 0;
    const months = g.deadline ? Math.max(0, Math.ceil(daysBetween(t, g.deadline) / 30.44)) : null;
    return `<div class="acc" data-id="${g.id}"><div class="an"><span class="ic">${g.icon || '🎯'}</span>${esc(g.name)}${pct >= 100 ? ' <span class="chip pay">وصلت</span>' : ''}</div>
      <div class="am">${g.deadline ? 'الميعاد ' + dsp(g.deadline) + (months !== null ? ' · فاضل ' + months + ' شهر' : '') : 'من غير ميعاد'}</div>
      <div class="big">${money(sv)}</div><div class="row"><span>من ${fmtMoney(tg)}</span><b>${Math.round(pct)}%</b></div>
      <div class="bar ${pct >= 100 ? 'done' : ''}"><i style="width:${Math.min(100, pct)}%"></i></div>
      ${need ? `<div class="row" style="margin-top:6px"><span>محتاج كل شهر</span><b>${fmtMoney(need)}</b></div>` : ''}
      <div class="acts"><button class="btn sm gold" onclick="txModal(null,{kind:'save',goal:'${g.id}'})">+ حط فلوس</button><button class="btn sm" onclick="txModal(null,{kind:'unsave',goal:'${g.id}'})">سحب</button><button class="btn sm ghost" onclick="goalModal('${g.id}')">✎</button></div></div>`;
  }).join('')}</div>` : `<div class="card">${emptyBox('💰', 'اعمل هدف: عربية، شقة، عمرة، جهاز، احتياطي طوارئ (3–6 شهور مصاريف)…', `<button class="btn gold" onclick="goalModal()">+ هدف</button>`)}</div>`;
  const avgExp = history(D, t, 6).reduce((a, x, _, arr) => a + (Object.values(x.varCat).reduce((s, v) => s + v, 0) + x.fixExp) / arr.length, 0);
  if (avgExp > 0 && !D.goals.some(g => /طوارئ|احتياطي/.test(g.name))) h += `<div class="note blue">💡 متوسط مصروفك الشهري ${fmtMoney(avgExp)} — احتياطي طوارئ كويس = ${fmtMoney(avgExp * 3)} لـ ${fmtMoney(avgExp * 6)}. <button class="btn sm" onclick="goalModal(null,{name:'احتياطي طوارئ',icon:'🛟',target:${Math.round(avgExp * 3 / 100) * 100}})">اعمله هدف</button></div>`;
  return h;
};

/* ---------- السلف ---------- */
VIEWS.debts = () => {
  const t = todayISO();
  let tin = 0, tout = 0; D.debts.forEach(d => { const l = debtLeft(d); if (l > 0) { if (d.dir === 'in') tin += l; else tout += l; } });
  let h = topbar('السلف', 'فلوس سلّفتها لحد (عليه) أو اتسلفتها من حد (له)', `<button class="btn gold" onclick="debtModal()">+ سلفة</button>`);
  h += `<div class="kpis">${kpi('emer', '🤝 ليك عند الناس (عليهم)', money(tin), '')}${kpi('amber', '🤝 عليك للناس (ليهم)', money(tout), '')}</div>`;
  const sec = (dir, title) => {
    const L = D.debts.filter(d => d.dir === dir).sort((a, b) => (debtLeft(b) > 0) - (debtLeft(a) > 0) || (a.due || '9') < (b.due || '9') ? -1 : 1);
    return `<div class="card"><div class="card-h"><span class="card-t">${title}</span></div>${L.length ? `<div class="tbl-wrap"><table><thead><tr><th>الشخص</th><th class="num hide-sm">المبلغ</th><th class="num">فاضل</th><th class="hide-sm">الميعاد</th><th></th></tr></thead><tbody>${L.map(d => {
      const l = debtLeft(d), n = d.due ? daysBetween(t, d.due) : null;
      return `<tr data-id="${d.id}" class="${l <= 0.005 ? 'payrow' : ''}"><td><b>${esc(d.person)}</b><br><small>${dsp(d.date)}${d.note ? ' · ' + esc(d.note) : ''}</small></td><td class="num hide-sm">${fmtMoney(d.amount)}</td><td class="num"><b>${fmtMoney(l)}</b>${l <= 0.005 ? '<br><span class="chip pay">خلصت</span>' : ''}</td>
        <td class="hide-sm">${d.due ? dsp(d.due) + (l > 0 && n < 0 ? ' <span class="chip red">عدّى</span>' : l > 0 && n <= 3 ? ' <span class="chip amber">قرب</span>' : '') : '—'}</td>
        <td class="acts">${l > 0 ? `<button class="btn sm navy" onclick="debtPay('${d.id}')">+ سداد</button>` : ''}<button class="btn ghost sm" onclick="debtModal('${d.id}')">✎</button></td></tr>`;
    }).join('')}</tbody></table></div>` : emptyBox('🤝', 'مفيش')}</div>`;
  };
  return h + sec('in', '🟢 ليك عند الناس — الشخص عليه') + sec('out', '🟠 عليك للناس — الشخص له');
};

/* ---------- سلة المحذوفات ---------- */
const COL_AR = { tx: 'حركة', rec: 'التزام/دخل ثابت', cats: 'قسم', accounts: 'حساب', goals: 'هدف', debts: 'سلفة' };
VIEWS.trash = () => {
  let h = topbar('سلة المحذوفات', 'أي حاجة بتتمسح بتيجي هنا — ومفيش مسح نهائي', '');
  if (!D.trash.length) return h + `<div class="card">${emptyBox('🗑', 'السلة فاضية')}</div>`;
  h += `<div class="card"><div class="tbl-wrap"><table><thead><tr><th>اتمسح</th><th>النوع</th><th>إيه هو</th><th></th></tr></thead><tbody>${D.trash.slice(0, 300).map(t => {
    const it = t.item || {}, desc = t.col === 'tx' ? `${dsp(it.date)} — ${KIND_AR[it.kind] || ''} ${fmtMoney(it.amount)} — ${esc(catOf(D, it.cat).name)} ${esc(it.note || '')}` : esc(it.name || it.person || it.id);
    return `<tr><td class="dt">${dsp(String(t.at || '').slice(0, 10))}</td><td><span class="chip gray">${COL_AR[t.col] || t.col}</span></td><td>${desc}</td><td class="acts"><button class="btn sm" onclick="commit([{act:'restore',col:'${t.col}',id:'${it.id}'}],'رجعت ✓')">↩ رجّع</button></td></tr>`;
  }).join('')}</tbody></table></div></div>`;
  return h;
};
