/* ================= النوافذ ================= */
const ICONS = ['🛒', '🍔', '🚗', '🏠', '💡', '🩺', '🎓', '👕', '👨‍👩‍👧', '🎁', '🤲', '🎬', '💳', '📦', '☕', '🚬', '💇', '🐾', '🧒', '🛠', '📱', '✈️', '🕌', '⚽', '💼', '🏗', '🏘', '💵', '📈', '🎯'];
const GOAL_ICONS = ['🎯', '🛟', '🏠', '🚗', '💍', '🕋', '✈️', '🎓', '📱', '💻', '🛋', '👶'];
const ACC_ICONS = ['💵', '🏦', '📱', '💳', '🪙', '🏧', '👛', '🔐'];
function picksHTML(list, cur, fn) { return `<div class="picks">${list.map(x => `<button type="button" class="pick ${cur === x.id ? 'on' : ''}" onclick="${fn}('${x.id}')">${x.icon ? x.icon + ' ' : ''}${esc(x.name)}</button>`).join('')}</div>`; }
function iconPicks(list, cur, inputId) { return `<div class="quick">${list.map(i => `<button type="button" onclick="$('#${inputId}').value='${i}';$$('.quick .on').forEach(b=>b.classList.remove('on'))" style="font-size:16px;${cur === i ? 'border-color:var(--gold);background:var(--gold-soft)' : ''}">${i}</button>`).join('')}</div>`; }
function defaultDate() { return UI.lastAdd && Date.now() - UI.lastAdd.t < 10 * 60000 ? UI.lastAdd.date : todayISO(); }
function catUsage(kind) {
  const since = addDays(todayISO(), -120), cnt = {};
  D.tx.forEach(x => { if (x.kind === kind && x.date >= since) cnt[x.cat] = (cnt[x.cat] || 0) + 1; });
  return D.cats.filter(k => k.kind === kind && !k.archived).sort((a, b) => (cnt[b.id] || 0) - (cnt[a.id] || 0));
}

/* ---------- الحركة ---------- */
let M = null, M_EX = null;
function txModal(id, preset) {
  closeDrawer();
  M_EX = id ? byId(D.tx, id) : null;
  if (id && !M_EX) { toast('الحركة دي مش موجودة'); return; }
  M = M_EX ? clone(M_EX) : Object.assign({ kind: 'exp', acc: D.settings.defAcc || (D.accounts[0] || {}).id, date: defaultDate() }, preset || {});
  if (!M.acc || !byId(D.accounts, M.acc)) M.acc = (D.accounts.find(a => !a.archived) || {}).id;
  if ((M.kind === 'save' || M.kind === 'unsave') && !M.goal && D.goals.length === 1) M.goal = D.goals[0].id;
  const title = M_EX ? 'تعديل حركة' : M.rec ? (M.kind === 'inc' ? '✓ تسجيل ' : '+ سداد ') + (byId(D.rec, M.rec) || {}).name : 'حركة جديدة';
  modal(title, txBody(), txFooter());
  setTimeout(() => { const a = $('#txAmt'); if (a && !M_EX) { a.focus(); if (a.value) a.select(); } }, IS_TOUCH ? 250 : 40);
}
function txFooter() {
  return `<button class="btn navy" onclick="saveTx()">احفظ</button>${M_EX ? '' : '<button class="btn hide-m" onclick="saveTx(true)">احفظ وضيف تاني</button>'}<button class="btn" onclick="closeModal()">إلغاء</button>${M_EX ? `<span class="spacer"></span><button class="btn danger" onclick="closeModal();delTx(['${M_EX.id}'])">🗑 مسح</button>` : ''}`;
}
function reopenTx() { modal(M_EX ? 'تعديل حركة' : 'حركة جديدة', txBody(), txFooter()); }
function syncM() {
  if (!$('#txAmt')) return;
  M.amount = mval('txAmt'); const d = dval('txDate'); if (d) M.date = d; M.note = sval('txNote');
}
function txRerender() { syncM(); $('#mBody').innerHTML = txBody(); wireInputs($('#mBody')); }
function txSet(k, v) { M[k] = v; if (k === 'kind') { if (v === 'exp' || v === 'inc') { const c = byId(D.cats, M.cat); if (!c || c.kind !== v) M.cat = ''; } } txRerender(); }
function txBody() {
  const kinds = [['exp', 'مصروف'], ['inc', 'دخل'], ['xfer', 'تحويل'], ['save', 'هدف']];
  const kk = M.kind === 'unsave' ? 'save' : M.kind;
  const accs = D.accounts.filter(a => !a.archived || a.id === M.acc || a.id === M.to);
  let h = '';
  if (M.kind !== 'adj') h += `<div class="seg">${kinds.map(k => `<button type="button" class="${kk === k[0] ? 'on ' + k[0] : ''}" onclick="txSet('kind','${k[0]}')">${k[1]}</button>`).join('')}</div>`;
  else h += `<div class="note blue">⚖️ تسوية رصيد — بتغيّر رصيد الحساب بس، مالهاش دعوة بالمصروف أو الميزانية. (بالسالب لو بتنقّص)</div>`;
  h += `<div class="grid2"><div class="f"><label>المبلغ</label><input id="txAmt" data-money ${M.kind === 'adj' ? 'data-signed' : ''} class="money big" value="${M.amount ? fmtMoney(M.amount) : ''}"><div class="hint-k">تقدر تكتب معادلة: <b dir="ltr">=85+40</b></div></div>
    <div class="f"><label>التاريخ</label><input id="txDate" data-date value="${dsp(M.date)}"><div class="quick"><button type="button" onclick="$('#txDate').value='${dsp(todayISO())}'">النهارده</button><button type="button" onclick="$('#txDate').value='${dsp(addDays(todayISO(), -1))}'">امبارح</button>${M.date !== todayISO() && !M_EX ? `<span class="small">آخر تاريخ استخدمته</span>` : ''}</div></div></div>`;
  if (M.kind === 'exp' || M.kind === 'inc') {
    const cats = catUsage(M.kind);
    h += `<div class="f"><label>القسم ${M.kind === 'exp' && M.cat ? budgetHint(M.cat) : ''}</label>${picksHTML(cats, M.cat, '_pickCat')}<div class="quick"><button type="button" onclick="syncM();catModal(null,'${M.kind}',true)">+ قسم جديد</button></div></div>`;
  }
  if (M.kind === 'save' || M.kind === 'unsave') {
    h += `<div class="seg" style="max-width:280px"><button type="button" class="${M.kind === 'save' ? 'on save' : ''}" onclick="txSet('kind','save')">حط فلوس</button><button type="button" class="${M.kind === 'unsave' ? 'on save' : ''}" onclick="txSet('kind','unsave')">سحب</button></div>`;
    h += `<div class="f"><label>الهدف</label>${D.goals.length ? picksHTML(D.goals.map(g => ({ id: g.id, name: g.name + ' (' + fmtMoney(goalSaved(D, g.id)) + ')', icon: g.icon || '🎯' })), M.goal, '_pickGoal') : '<div class="small">مفيش أهداف — اعمل هدف الأول من شاشة الأهداف.</div>'}</div>`;
  }
  const accLbl = M.kind === 'inc' || M.kind === 'unsave' ? 'دخل في حساب' : M.kind === 'xfer' ? 'من حساب' : M.kind === 'adj' ? 'الحساب' : 'دفعت من';
  h += `<div class="f"><label>${accLbl}</label>${picksHTML(accs, M.acc, '_pickAcc')}</div>`;
  if (M.kind === 'xfer') h += `<div class="f"><label>لحساب</label>${picksHTML(accs.filter(a => a.id !== M.acc), M.to, '_pickTo')}</div>`;
  const notes = [...new Set(D.tx.filter(x => x.note && (x.cat === M.cat || !M.cat)).sort(txSort).map(x => x.note))].slice(0, 30);
  h += `<div class="f"><label>ملاحظة (اختياري)</label><input id="txNote" list="dlNotes" value="${esc(M.note || '')}" placeholder="مثلاً: بنزين 92، فاتورة أكتوبر…" maxlength="160"><datalist id="dlNotes">${notes.map(n => `<option value="${esc(n)}">`).join('')}</datalist></div>`;
  if (M.rec) { const r = byId(D.rec, M.rec); h += `<div class="note">📌 مرتبطة بـ «${esc(r ? r.name : 'التزام ممسوح')}»${M.due ? ' — استحقاق ' + dsp(M.due) : ''} <button type="button" class="btn sm ghost" onclick="M.rec='';M.due='';txRerender()">✕ فك الربط</button></div>`; }
  return h;
}
window._pickCat = id => { M.cat = id; txRerender(); };
window._pickAcc = id => { M.acc = id; if (M.to === id) M.to = ''; txRerender(); };
window._pickTo = id => { M.to = id; txRerender(); };
window._pickGoal = id => { M.goal = id; txRerender(); };
function budgetHint(catId) {
  const k = byId(D.cats, catId); if (!k || !num(k.budget)) return '';
  const c = cycleOf(M.date || todayISO(), cd()), r = budgetRows(D, c).find(x => x.cat.id === catId); if (!r) return '';
  const spent = r.spent - (M_EX && M_EX.cat === catId && M_EX.date >= c.start && M_EX.date <= c.end ? r2(M_EX.amount) : 0);
  const left = r.budget - spent;
  return `<span class="chip ${left < 0 ? 'red' : left < r.budget * .2 ? 'amber' : 'emer'}" style="margin-inline-start:6px">فاضل في الميزانية ${fmtMoney(left)}</span>`;
}
function saveTx(again) {
  syncM();
  const err = m => { toast(m, 'err'); };
  if (!(M.amount > 0) && M.kind !== 'adj') return err('اكتب المبلغ');
  if (M.kind === 'adj' && !M.amount) return err('اكتب مبلغ التسوية');
  if (!M.date) return err('التاريخ مش مظبوط — اكتبه زي 25102026');
  if ((M.kind === 'exp' || M.kind === 'inc') && !M.cat) return err('اختار القسم');
  if (!M.acc) return err('اختار الحساب');
  if (M.kind === 'xfer' && (!M.to || M.to === M.acc)) return err('اختار الحساب اللي هتحوّل له');
  if ((M.kind === 'save' || M.kind === 'unsave') && !M.goal) return err('اختار الهدف');
  const it = { id: M.id || uid('t'), date: M.date, kind: M.kind, amount: r2(M.amount), acc: M.acc, note: M.note || '', via: M_EX ? (M_EX.via || 'app') : 'app', at: M_EX ? M_EX.at : nowLocal() };
  if (M.kind === 'exp' || M.kind === 'inc') it.cat = M.cat;
  if (M.kind === 'xfer') it.to = M.to;
  if (M.kind === 'save' || M.kind === 'unsave') it.goal = M.goal;
  if (M.rec) { it.rec = M.rec; if (M.due) it.due = M.due; }
  const doSave = () => {
    let msg = M_EX ? 'اتعدلت ✓' : 'اتحفظ ✓';
    if (it.kind === 'exp' && it.cat) {
      const tmp = clone(D); applyOp(tmp, put('tx', it));
      const r = budgetRows(tmp, cycleOf(it.date, cd())).find(x => x.cat.id === it.cat);
      if (r && r.budget) msg += r.left < 0 ? ` — عدّيت ميزانية ${r.cat.name} بـ ${fmtMoney(-r.left)}` : ` — فاضل في ${r.cat.name} ${fmtMoney(r.left)}`;
    }
    const keep = { kind: it.kind, acc: it.acc, date: it.date };
    if (!M_EX) UI.lastAdd = { date: it.date, t: Date.now() };
    closeModal();
    commit([put('tx', it)], msg, { flash: it.id });
    if (again) txModal(null, keep);
  };
  if (!M_EX) {
    const sim = D.tx.filter(x => x.kind === it.kind && r2(x.amount) === it.amount && x.date === it.date && (x.cat || '') === (it.cat || '') && x.acc === it.acc);
    if (sim.length) return dupAsk(sim.map(x => ({ html: `${dsp(x.date)} — ${catLabel(x.cat)} — <b>${fmtMoney(x.amount)}</b> ${esc(x.note || '')}`, id: x.id })), doSave, s => txModal(s.id));
  }
  doSave();
}

/* ---------- الالتزامات والدخل الثابت ---------- */
const REC_TPL = {
  exp: [['إيجار الشقة', 'c_home', 'm'], ['كهربا', 'c_bills', 'm'], ['مية', 'c_bills', 'm'], ['غاز', 'c_bills', 'm'], ['النت', 'c_bills', 'm'], ['باقة الموبايل', 'c_bills', 'm'], ['مصاريف المدرسة', 'c_edu', 'y'], ['قسط العربية', 'c_debt', 'm'], ['جمعية', 'c_debt', 'm'], ['اشتراك', 'c_fun', 'm'], ['الجيم', 'c_fun', 'm'], ['تأمين العربية', 'c_car', 'y']],
  inc: [['المرتب', 'c_salary', 'm'], ['إيجار شقة', 'c_rent', 'm'], ['أرباح', 'c_biz', 'm']]
};
let R = null;
function recModal(id, kind, preset) {
  closeDrawer();
  const ex = id ? byId(D.rec, id) : null;
  R = ex ? clone(ex) : Object.assign({ kind: kind || 'exp', freq: 'm', day: '', start: todayISO(), acc: D.settings.defAcc, remind: 3, active: true, cat: (kind || 'exp') === 'inc' ? 'c_salary' : '' }, preset || {});
  R._ex = !!ex;
  const inc = R.kind === 'inc';
  modal(ex ? 'تعديل: ' + ex.name : inc ? '+ مصدر دخل ثابت' : '+ التزام ثابت', recBody(), `<button class="btn navy" onclick="saveRec()">احفظ</button><button class="btn" onclick="closeModal()">إلغاء</button>${ex ? `<span class="spacer"></span><button class="btn danger" onclick="delRec('${ex.id}')">🗑 مسح</button>` : ''}`);
}
function recSync() {
  if (!$('#rName')) return;
  R.name = sval('rName'); R.amount = mval('rAmt'); R.freq = sval('rFreq'); R.day = Math.round(num(sval('rDay'))) || ''; R.start = dval('rStart') || R.start;
  R.count = Math.round(num(sval('rCount'))) || ''; R.end = dval('rEnd'); R.remind = Math.round(num(sval('rRemind'))); R.auto = cval('rAuto'); R.active = cval('rActive'); R.note = sval('rNote');
  R.cat = sval('rCat'); R.acc = sval('rAcc');
  if ($('#jDate')) { R._jDate = dval('jDate'); R._jAmt = mval('jAmt'); }
}
function recRerender() { recSync(); $('#mBody').innerHTML = recBody(); wireInputs($('#mBody')); }
function recTpl(i) { const t = REC_TPL[R.kind][i]; recSync(); R.name = t[0]; R.cat = t[1]; R.freq = t[2]; recRerender(); }
function recBody() {
  const inc = R.kind === 'inc', cats = D.cats.filter(k => k.kind === R.kind && (!k.archived || k.id === R.cat));
  const isJam = /جمعي/.test(normAr(R.name || '')) && !R._ex;
  let h = R._ex ? '' : `<div class="f"><label>بسرعة</label><div class="quick">${REC_TPL[R.kind].map((t, i) => `<button type="button" onclick="recTpl(${i})">${t[0]}</button>`).join('')}</div></div>`;
  h += `<div class="grid2"><div class="f"><label>الاسم</label><input id="rName" value="${esc(R.name || '')}" placeholder="${inc ? 'المرتب' : 'إيجار الشقة'}" oninput="if(/جمعي/.test(normAr(this.value))!==${isJam})recRerender()"></div>
    <div class="f"><label>المبلغ</label><input id="rAmt" data-money class="money" value="${R.amount ? fmtMoney(R.amount) : ''}"><div class="hint-k">لو بيتغير (زي الكهربا) حط متوسطه</div></div></div>
    <div class="grid3"><div class="f"><label>بيتكرر</label><select id="rFreq" onchange="recRerender()">${Object.keys(FREQ).map(k => `<option value="${k}" ${R.freq === k ? 'selected' : ''}>${FREQ[k]}</option>`).join('')}</select></div>
    ${R.freq === 'm' || R.freq === 'q' ? `<div class="f"><label>يوم كام في الشهر</label><input id="rDay" inputmode="numeric" value="${R.day || ''}" placeholder="1 – 31"><div class="hint-k">31 = آخر يوم في الشهر</div></div>` : '<input type="hidden" id="rDay" value="">'}
    <div class="f"><label>${R.freq === 'once' ? 'التاريخ' : R.freq === 'y' || R.freq === 'w' ? 'أول مرة (والتكرار من التاريخ ده)' : 'بداية من'}</label><input id="rStart" data-date value="${dsp(R.start)}"></div></div>
    <div class="grid2"><div class="f"><label>القسم</label><select id="rCat"><option value="">— اختار —</option>${cats.map(k => `<option value="${k.id}" ${R.cat === k.id ? 'selected' : ''}>${k.icon} ${esc(k.name)}</option>`).join('')}</select></div>
    <div class="f"><label>${inc ? 'بينزل في حساب' : 'بيتدفع من'}</label><select id="rAcc">${D.accounts.filter(a => !a.archived || a.id === R.acc).map(a => `<option value="${a.id}" ${R.acc === a.id ? 'selected' : ''}>${a.icon} ${esc(a.name)}</option>`).join('')}</select></div></div>`;
  if (R.freq !== 'once') h += `<div class="grid2"><div class="f"><label>عدد المرات (للأقساط)</label><input id="rCount" inputmode="numeric" value="${R.count || ''}" placeholder="فاضي = على طول"><div class="hint-k">مثلاً قسط 24 شهر = 24 (من تاريخ البداية)</div></div><div class="f"><label>لحد تاريخ (اختياري)</label><input id="rEnd" data-date value="${R.end ? dsp(R.end) : ''}"></div></div>`;
  else h += '<input type="hidden" id="rCount"><input type="hidden" id="rEnd">';
  if (isJam) h += `<div class="calc-box"><b>🤝 الجمعية</b><div class="small">هتقبضها امتى وكام؟ هسجلها كدخل متوقع في ميعادها عشان يدخل في التوقعات.</div><div class="grid2" style="margin-top:8px"><div class="f"><label>هتقبض يوم</label><input id="jDate" data-date value="${R._jDate ? dsp(R._jDate) : ''}"></div><div class="f"><label>مبلغ القبض</label><input id="jAmt" data-money class="money" value="${R._jAmt ? fmtMoney(R._jAmt) : (R.amount && R.count ? fmtMoney(R.amount * R.count) : '')}"></div></div></div>`;
  h += `<div class="grid3" style="align-items:end"><div class="f"><label>فكّرني قبلها بـ</label><select id="rRemind">${[0, 1, 2, 3, 5, 7, 10].map(n => `<option value="${n}" ${+R.remind === n ? 'selected' : ''}>${n ? n + ' أيام' : 'يوم الميعاد'}</option>`).join('')}</select></div>
    <div class="f"><label class="inl"><input type="checkbox" id="rAuto" ${R.auto ? 'checked' : ''}> يتسجل لوحده في ميعاده</label><div class="hint-k">للخصم التلقائي من البنك (محتاج الربط بجوجل)</div></div>
    <div class="f"><label class="inl"><input type="checkbox" id="rActive" ${R.active !== false ? 'checked' : ''}> شغال</label></div></div>
    <div class="f"><label>ملاحظة</label><input id="rNote" value="${esc(R.note || '')}"></div>`;
  return h;
}
function saveRec() {
  recSync();
  if (!R.name) return toast('اكتب الاسم', 'err');
  if (!(R.amount > 0)) return toast('اكتب المبلغ', 'err');
  if (!R.cat) return toast('اختار القسم', 'err');
  if ((R.freq === 'm' || R.freq === 'q') && !(R.day >= 1 && R.day <= 31)) R.day = +R.start.slice(8);
  const it = { id: R.id || uid('r'), name: R.name, kind: R.kind, amount: r2(R.amount), freq: R.freq, day: R.day, start: R.start, count: R.count, end: R.end, cat: R.cat, acc: R.acc, remind: R.remind, auto: R.auto, active: R.active, note: R.note };
  const ops = [put('rec', it)];
  if (R._jDate && R._jAmt > 0) ops.push(put('rec', { id: uid('r'), name: 'قبض ' + R.name, kind: 'inc', amount: R._jAmt, freq: 'once', start: R._jDate, cat: 'c_oinc', acc: R.acc, remind: 0, active: true }));
  const go = () => { closeModal(); commit(ops, 'اتحفظ ✓', { flash: it.id }); };
  if (!R._ex) { const sim = D.rec.filter(x => normAr(x.name) === normAr(it.name)); if (sim.length) return dupAsk(sim.map(x => ({ html: `${esc(x.name)} — ${fmtMoney(x.amount)} ${FREQ[x.freq]}`, id: x.id })), go, s => recModal(s.id)); }
  go();
}
function delRec(id) {
  const r = byId(D.rec, id);
  askYesNo('مسح ' + r.name, 'هيتمسح الالتزام نفسه (يروح السلة). الحركات اللي اتسجلت قبل كده هتفضل زي ما هي. لو عايز توقفه بس شيل علامة «شغال».', () => commit([del('rec', id)], 'اتمسح (في السلة)'), '🗑 امسح', true);
}

/* ---------- الأقسام ---------- */
function catModal(id, kind, fromTx) {
  const ex = id ? byId(D.cats, id) : null, k = ex ? clone(ex) : { kind: kind || 'exp', icon: kind === 'inc' ? '💵' : '📦', budget: 0, kw: '' };
  window._catFromTx = fromTx;
  const body = `${ex ? '' : `<div class="seg"><button type="button" class="${k.kind === 'exp' ? 'on exp' : ''}" onclick="this.parentNode.querySelectorAll('button').forEach(b=>b.className='');this.className='on exp';$('#kKind').value='exp';$('#kBudF').hidden=false">مصروف</button><button type="button" class="${k.kind === 'inc' ? 'on inc' : ''}" onclick="this.parentNode.querySelectorAll('button').forEach(b=>b.className='');this.className='on inc';$('#kKind').value='inc';$('#kBudF').hidden=true">دخل</button></div>`}<input type="hidden" id="kKind" value="${k.kind}">
    <div class="grid2"><div class="f"><label>اسم القسم</label><input id="kName" value="${esc(k.name || '')}" placeholder="مثلاً: سجاير، كوافير، قطط…"></div><div class="f"><label>الأيقونة</label><input id="kIcon" value="${esc(k.icon)}" style="font-size:18px;width:80px">${iconPicks(ICONS, k.icon, 'kIcon')}</div></div>
    <div class="f" id="kBudF" ${k.kind === 'inc' ? 'hidden' : ''}><label>الميزانية الشهرية</label><input id="kBud" data-money class="money" value="${num(k.budget) ? fmtMoney(k.budget) : ''}" placeholder="فاضي = من غير ميزانية"></div>
    <div class="f"><label>كلمات بيتعرف بيها في التليجرام (اختياري)</label><textarea id="kKw" rows="2" placeholder="مفصولة بفاصلة: بنزين، سولار، اوبر">${esc(k.kw || '')}</textarea><div class="hint-k">لو كتبت «150 سولار» البوت هيحطها في القسم ده</div></div>
    ${ex ? `<label class="inl"><input type="checkbox" id="kArch" ${k.archived ? 'checked' : ''}> مقفول (مايظهرش في الاختيارات)</label>` : ''}`;
  modal(ex ? 'تعديل قسم' : '+ قسم جديد', body, `<button class="btn navy" onclick="saveCat('${id || ''}')">احفظ</button><button class="btn" onclick="${fromTx ? 'reopenTx()' : 'closeModal()'}">إلغاء</button>${ex ? `<span class="spacer"></span><button class="btn danger" onclick="delCat('${id}')">🗑 مسح</button>` : ''}`);
}
function saveCat(id) {
  const ex = id ? byId(D.cats, id) : null, name = sval('kName');
  if (!name) return toast('اكتب اسم القسم', 'err');
  const it = Object.assign(ex ? clone(ex) : { id: uid('c') }, { name, kind: sval('kKind'), icon: sval('kIcon') || '📦', budget: mval('kBud'), kw: sval('kKw') });
  if (ex) it.archived = cval('kArch');
  const go = () => {
    const back = window._catFromTx && M;
    if (back) { M.cat = it.id; M.kind = it.kind; }
    closeModal();
    commit([put('cats', it)], 'اتحفظ ✓', { flash: it.id });
    if (back) reopenTx();
  };
  if (!ex) { const sim = D.cats.filter(k => normAr(k.name) === normAr(name)); if (sim.length) return dupAsk(sim.map(k => ({ html: `${k.icon} ${esc(k.name)} (${k.kind === 'inc' ? 'دخل' : 'مصروف'})${k.archived ? ' — مقفول' : ''}`, id: k.id })), go, s => catModal(s.id)); }
  go();
}
function delCat(id) {
  const used = D.tx.filter(x => x.cat === id).length + D.rec.filter(r => r.cat === id).length, k = byId(D.cats, id);
  if (used) return askYesNo('القسم ده مستخدم', `«${esc(k.name)}» عليه ${used} حركة/التزام. المسح هيخليهم «قسم ممسوح». الأحسن تقفله بدل ما تمسحه — يفضل في التقارير ومايظهرش في الاختيارات.`, () => { const n = clone(k); n.archived = true; closeModal(); commit([put('cats', n)], 'القسم اتقفل ✓'); }, 'اقفله بدل المسح');
  closeModal(); commit([del('cats', id)], 'اتمسح (في السلة)');
}

/* ---------- الحسابات ---------- */
function accModal(id) {
  const ex = id ? byId(D.accounts, id) : null, a = ex ? clone(ex) : { icon: '💵', type: 'cash', opening: 0, kw: '' };
  modal(ex ? 'تعديل حساب' : '+ حساب جديد', `<div class="grid2"><div class="f"><label>الاسم</label><input id="aName" value="${esc(a.name || '')}" placeholder="مثلاً: بنك مصر، إنستاباي، الخزنة"></div><div class="f"><label>الأيقونة</label><input id="aIcon" value="${esc(a.icon)}" style="font-size:18px;width:80px">${iconPicks(ACC_ICONS, a.icon, 'aIcon')}</div></div>
    <div class="f"><label>رصيد البداية</label><input id="aOpen" data-money data-signed class="money" value="${num(a.opening) ? fmtMoney(a.opening) : ''}" placeholder="الفلوس اللي كانت فيه قبل أول حركة"><div class="hint-k">الرصيد الحالي = رصيد البداية + كل الحركات. لو عايز تظبطه على الواقع استخدم «ظبّط الرصيد».</div></div>
    <div class="f"><label>كلمات بيتعرف بيها في التليجرام</label><input id="aKw" value="${esc(a.kw || '')}" placeholder="بنك، فيزا، كارت"></div>
    <label class="inl" style="margin-bottom:8px"><input type="checkbox" id="aDef" ${D.settings.defAcc === a.id ? 'checked' : ''}> الحساب الأساسي (بيتختار لوحده)</label>
    ${ex ? `<label class="inl"><input type="checkbox" id="aArch" ${a.archived ? 'checked' : ''}> مقفول</label>` : ''}`,
    `<button class="btn navy" onclick="saveAcc('${id || ''}')">احفظ</button><button class="btn" onclick="closeModal()">إلغاء</button>${ex ? `<span class="spacer"></span><button class="btn danger" onclick="delAcc('${id}')">🗑 مسح</button>` : ''}`);
}
function saveAcc(id) {
  const ex = id ? byId(D.accounts, id) : null, name = sval('aName');
  if (!name) return toast('اكتب اسم الحساب', 'err');
  const it = Object.assign(ex ? clone(ex) : { id: uid('a'), type: 'cash' }, { name, icon: sval('aIcon') || '💵', opening: mval('aOpen'), kw: sval('aKw') });
  if (ex) it.archived = cval('aArch');
  const ops = [put('accounts', it)];
  if (cval('aDef') && D.settings.defAcc !== it.id) ops.push(setOp({ defAcc: it.id }));
  const go = () => { closeModal(); commit(ops, 'اتحفظ ✓', { flash: it.id }); };
  if (!ex) { const sim = D.accounts.filter(a => normAr(a.name) === normAr(name)); if (sim.length) return dupAsk(sim.map(a => ({ html: `${a.icon} ${esc(a.name)}`, id: a.id })), go, s => accModal(s.id)); }
  go();
}
function delAcc(id) {
  const used = D.tx.filter(x => x.acc === id || x.to === id).length, a = byId(D.accounts, id);
  if (used) return askYesNo('الحساب ده عليه حركات', `«${esc(a.name)}» عليه ${used} حركة. الأحسن تقفله بدل المسح عشان الأرصدة ماتبوظش.`, () => { const n = clone(a); n.archived = true; closeModal(); commit([put('accounts', n)], 'الحساب اتقفل ✓'); }, 'اقفله');
  closeModal(); commit([del('accounts', id)], 'اتمسح (في السلة)');
}
function adjModal(accId) {
  const a = byId(D.accounts, accId), cur = balances(D, todayISO())[accId] || 0;
  modal('⚖️ ظبّط رصيد ' + a.name, `<div class="calc-box" style="margin-top:0"><div class="ln"><span>الرصيد في البرنامج</span><b>${money(cur)}</b></div></div>
    <div class="f" style="margin-top:12px"><label>الفلوس اللي فيه فعلاً دلوقتي</label><input id="adjV" data-money data-signed class="money big" data-live="_adjLive"></div><div class="calc-box" id="adjBox"></div>`,
    `<button class="btn navy" onclick="_adjSave()">احفظ التسوية</button><button class="btn" onclick="closeModal()">إلغاء</button>`);
  window._adjLive = () => { const v = $('#adjV').value.startsWith('=') ? 0 : num($('#adjV').value), d = r2(v - cur); $('#adjBox').innerHTML = `<div class="ln tot"><span>التسوية</span><bdi class="n" style="color:${d < 0 ? 'var(--red)' : 'var(--emer)'}">${d > 0 ? '+' : ''}${fmtMoney(d)}</bdi></div>`; };
  window._adjSave = () => {
    const d = r2(mval('adjV') - cur);
    if (!d) { closeModal(); toast('الرصيد مظبوط أصلاً ✓', 'ok'); return; }
    closeModal(); commit([put('tx', { id: uid('t'), date: todayISO(), kind: 'adj', amount: d, acc: accId, note: 'تسوية رصيد', via: 'app', at: nowLocal() })], 'الرصيد اتظبط ✓', { flash: accId });
  };
}

/* ---------- الأهداف ---------- */
function goalModal(id, preset) {
  const ex = id ? byId(D.goals, id) : null, g = ex ? clone(ex) : Object.assign({ icon: '🎯' }, preset || {});
  modal(ex ? 'تعديل هدف' : '+ هدف جديد', `<div class="grid2"><div class="f"><label>الهدف</label><input id="gName" value="${esc(g.name || '')}" placeholder="عربية، عمرة، احتياطي طوارئ…"></div><div class="f"><label>الأيقونة</label><input id="gIcon" value="${esc(g.icon)}" style="font-size:18px;width:80px">${iconPicks(GOAL_ICONS, g.icon, 'gIcon')}</div></div>
    <div class="grid2"><div class="f"><label>المبلغ المطلوب</label><input id="gTarget" data-money class="money" value="${num(g.target) ? fmtMoney(g.target) : ''}"></div><div class="f"><label>عايز توصل امتى؟ (اختياري)</label><input id="gDead" data-date value="${g.deadline ? dsp(g.deadline) : ''}"></div></div>
    <div class="f"><label>ملاحظة</label><input id="gNote" value="${esc(g.note || '')}"></div>`,
    `<button class="btn navy" onclick="saveGoal('${id || ''}')">احفظ</button><button class="btn" onclick="closeModal()">إلغاء</button>${ex ? `<span class="spacer"></span><button class="btn danger" onclick="closeModal();commit([del('goals','${id}')],'اتمسح (في السلة)')">🗑 مسح</button>` : ''}`);
}
function saveGoal(id) {
  const ex = id ? byId(D.goals, id) : null, name = sval('gName');
  if (!name) return toast('اكتب اسم الهدف', 'err');
  if (!(mval('gTarget') > 0)) return toast('اكتب المبلغ المطلوب', 'err');
  const it = Object.assign(ex ? clone(ex) : { id: uid('g') }, { name, icon: sval('gIcon') || '🎯', target: mval('gTarget'), deadline: dval('gDead'), note: sval('gNote') });
  closeModal(); commit([put('goals', it)], 'اتحفظ ✓', { flash: it.id });
}

/* ---------- السلف ---------- */
function debtModal(id) {
  const ex = id ? byId(D.debts, id) : null, d = ex ? clone(ex) : { dir: 'in', date: todayISO() };
  const people = [...new Set(D.debts.map(x => x.person))];
  modal(ex ? 'تعديل سلفة' : '+ سلفة', `<div class="seg"><button type="button" class="${d.dir === 'in' ? 'on inc' : ''}" onclick="$('#dDir').value='in';this.className='on inc';this.nextElementSibling.className=''">سلّفت حد (عليه)</button><button type="button" class="${d.dir === 'out' ? 'on exp' : ''}" onclick="$('#dDir').value='out';this.className='on exp';this.previousElementSibling.className=''">اتسلفت من حد (له)</button></div><input type="hidden" id="dDir" value="${d.dir}">
    <div class="grid2"><div class="f"><label>الشخص</label><input id="dPerson" list="dlPeople" value="${esc(d.person || '')}"><datalist id="dlPeople">${people.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div><div class="f"><label>المبلغ</label><input id="dAmt" data-money class="money" value="${d.amount ? fmtMoney(d.amount) : ''}"></div></div>
    <div class="grid2"><div class="f"><label>التاريخ</label><input id="dDate" data-date value="${dsp(d.date)}"></div><div class="f"><label>ميعاد الرد (اختياري)</label><input id="dDue" data-date value="${d.due ? dsp(d.due) : ''}"></div></div>
    <div class="f"><label>ملاحظة</label><input id="dNote" value="${esc(d.note || '')}"></div>
    ${ex && (ex.pays || []).length ? `<div class="calc-box"><b>السداد</b>${ex.pays.map(p => `<div class="ln"><span>${dsp(p.date)}</span><span>${fmtMoney(p.amount)} <button class="btn ghost sm" onclick="_dPayDel('${p.id}')">✕</button></span></div>`).join('')}</div>` : ''}
    <div class="hint-k" style="margin-top:8px">السلف هنا للمتابعة بس — لو عايز الفلوس تطلع من رصيدك سجّلها كمان كحركة.</div>`,
    `<button class="btn navy" onclick="saveDebt('${id || ''}')">احفظ</button><button class="btn" onclick="closeModal()">إلغاء</button>${ex ? `<span class="spacer"></span><button class="btn danger" onclick="closeModal();commit([del('debts','${id}')],'اتمسحت (في السلة)')">🗑 مسح</button>` : ''}`);
  window._dPayDel = pid => { const n = clone(ex); n.pays = (n.pays || []).filter(p => p.id !== pid); closeModal(); commit([put('debts', n)], 'اتشال السداد'); };
}
function saveDebt(id) {
  const ex = id ? byId(D.debts, id) : null;
  if (!sval('dPerson')) return toast('اكتب اسم الشخص', 'err');
  if (!(mval('dAmt') > 0)) return toast('اكتب المبلغ', 'err');
  const it = Object.assign(ex ? clone(ex) : { id: uid('d'), pays: [] }, { dir: sval('dDir'), person: sval('dPerson'), amount: mval('dAmt'), date: dval('dDate') || todayISO(), due: dval('dDue'), note: sval('dNote') });
  closeModal(); commit([put('debts', it)], 'اتحفظ ✓', { flash: it.id });
}
function debtPay(id) {
  const d = byId(D.debts, id), left = debtLeft(d);
  modal('+ سداد — ' + d.person, `<div class="grid2"><div class="f"><label>المبلغ</label><input id="pAmt" data-money class="money big" value="${fmtMoney(left)}"><div class="hint-k">فاضل ${fmtMoney(left)}</div></div><div class="f"><label>التاريخ</label><input id="pDate" data-date value="${dsp(todayISO())}"></div></div>`,
    `<button class="btn navy" onclick="_dPay()">احفظ</button><button class="btn" onclick="closeModal()">إلغاء</button>`);
  window._dPay = () => { const a = mval('pAmt'); if (!(a > 0)) return toast('اكتب المبلغ', 'err'); const n = clone(d); n.pays = (n.pays || []).concat([{ id: uid('p'), date: dval('pDate') || todayISO(), amount: a }]); closeModal(); commit([put('debts', n)], 'اتسجل السداد ✓', { flash: id }); };
}
