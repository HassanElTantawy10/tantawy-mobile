/* ================= التقارير والطباعة ================= */
const LOGO = '__LOGO__';
VIEWS.reports = () => {
  let h = topbar('التقارير', '', `<button class="btn" onclick="exportCSV()">⬇ CSV</button>${CFG ? '<button class="btn" onclick="exportSheet()">📗 شيت جوجل</button>' : ''}<button class="btn navy" onclick="printReport()" title="Ctrl+P">🖨 طباعة / PDF</button>`);
  h += `<div class="tabs"><button class="${UI.repTab === 'month' ? 'on' : ''}" onclick="UI.repTab='month';render()">تقرير الشهر</button><button class="${UI.repTab === 'year' ? 'on' : ''}" onclick="UI.repTab='year';render()">آخر 12 شهر</button></div>`;
  return h + (UI.repTab === 'year' ? yearReport() : monthReport());
};
function monthReport() {
  const c = cyc(), s = summarize(D, c.start, c.end), t = todayISO(), hist = cycleHistory(D, c.end < t ? addDays(c.end, 1) : t, 3);
  const rows = Object.keys(s.byCat).map(k => ({ k: catOf(D, k), v: s.byCat[k], avg: hist.length ? hist.reduce((a, x) => a + (x.varCat[k] || 0) + 0, 0) / hist.length : null })).sort((a, b) => b.v - a.v);
  const top = txIn(D, c.start, c.end).filter(x => x.kind === 'exp').sort((a, b) => b.amount - a.amount).slice(0, 10);
  let h = `<div class="card"><div class="card-h">${cycleNav()}</div><div class="card-b">
    <div class="kpis">${kpi('emer', 'الدخل', money(s.inc))}${kpi('navy', 'المصروف', money(s.exp), s.fixedExp ? 'منه ثابت ' + fmtMoney(s.fixedExp) : '')}${kpi(s.net < 0 ? 'red' : 'gold', s.net < 0 ? 'العجز' : 'الفاضل', money(Math.abs(s.net)), s.rate !== null ? 'ادخار ' + s.rate + '%' : '', s.net < 0 ? 'neg' : '')}${kpi('blue', 'للأهداف', money(s.save), s.n + ' حركة')}</div>
    ${catDonut(s)}</div></div>`;
  h += `<div class="card"><div class="card-h"><span class="card-t">المصروف بالأقسام</span></div>${rows.length ? `<div class="tbl-wrap free"><table><thead><tr><th>القسم</th><th class="num">المبلغ</th><th class="num">النسبة</th><th class="num hide-sm">الميزانية</th><th class="num hide-sm">متوسط 3 شهور</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.k.icon} ${esc(r.k.name)}</td><td class="num"><b>${fmtMoney(r.v)}</b></td><td class="num">${s.exp ? Math.round(r.v / s.exp * 100) : 0}%</td><td class="num hide-sm" style="color:${num(r.k.budget) && r.v > num(r.k.budget) ? 'var(--red)' : 'inherit'}">${num(r.k.budget) ? fmtMoney(r.k.budget) : '—'}</td><td class="num hide-sm small">${r.avg == null ? '—' : fmtMoney(r.avg)}</td></tr>`).join('')}</tbody><tfoot><tr><td>الإجمالي</td><td class="num">${fmtMoney(s.exp)}</td><td class="num">100%</td><td class="num hide-sm">${fmtMoney(totalBudget(D))}</td><td class="hide-sm"></td></tr></tfoot></table></div>` : emptyBox('📈', 'مفيش مصروف في الشهر ده')}</div>`;
  if (top.length) h += `<div class="card"><div class="card-h"><span class="card-t">أكبر 10 مصاريف</span></div><div class="tbl-wrap free"><table><tbody>${top.map(x => txRow(x, true)).join('')}</tbody></table></div></div>`;
  return h;
}
function yearReport() {
  const cur = curCycle(), cols = [];
  for (let i = 11; i >= 0; i--) { const c = cycleShift(cur, -i, cd()), s = summarize(D, c.start, c.end); if (!s.n && !cols.length && i > 0) continue; cols.push({ c, s }); }
  if (!cols.length || !D.tx.length) return `<div class="card">${emptyBox('📈', 'مفيش بيانات لسه')}</div>`;
  const cats = D.cats.filter(k => k.kind === 'exp').map(k => ({ k, vals: cols.map(x => x.s.byCat[k.id] || 0) })).filter(x => x.vals.some(v => v)).sort((a, b) => b.vals.reduce((p, q) => p + q, 0) - a.vals.reduce((p, q) => p + q, 0));
  const topC = cats.slice(0, 7), other = cols.map((_, i) => cats.slice(7).reduce((a, x) => a + x.vals[i], 0));
  const ser = topC.map((x, i) => ({ name: x.k.name, color: PAL[i % PAL.length], vals: x.vals }));
  if (other.some(v => v)) ser.push({ name: 'باقي الأقسام', color: '#CBD5E1', vals: other });
  const labels = cols.map(x => MONTHS[+x.c.key.slice(5) - 1]);
  const T = k => cols.reduce((a, x) => a + x.s[k], 0);
  let h = `<div class="card"><div class="card-h"><span class="card-t">المصروف بالأقسام شهر بشهر</span></div><div class="card-b">${barChart({ labels, series: ser, stacked: true, h: 250 })}</div></div>`;
  h += `<div class="card"><div class="card-h"><span class="card-t">الشهور</span></div><div class="tbl-wrap free"><table><thead><tr><th>الشهر</th><th class="num">الدخل</th><th class="num">المصروف</th><th class="num">الفاضل</th><th class="num">ادخار</th></tr></thead><tbody>${cols.slice().reverse().map(x => `<tr class="clk" onclick="UI.repTab='month';UI.off=${-cols.length + 1 + cols.indexOf(x)};render()"><td>${esc(cycleName(x.c, cd()))}</td><td class="num amt-in">${fmtMoney(x.s.inc)}</td><td class="num">${fmtMoney(x.s.exp)}</td><td class="num" style="color:${x.s.net < 0 ? 'var(--red)' : 'var(--emer)'}">${fmtMoney(x.s.net)}</td><td class="num">${x.s.rate === null ? '—' : x.s.rate + '%'}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td>الإجمالي</td><td class="num">${fmtMoney(T('inc'))}</td><td class="num">${fmtMoney(T('exp'))}</td><td class="num">${fmtMoney(T('net'))}</td><td class="num">${T('inc') ? Math.round(T('net') / T('inc') * 100) + '%' : '—'}</td></tr><tr><td>المتوسط الشهري</td><td class="num">${fmtMoney(T('inc') / cols.length)}</td><td class="num">${fmtMoney(T('exp') / cols.length)}</td><td class="num">${fmtMoney(T('net') / cols.length)}</td><td></td></tr></tfoot></table></div></div>`;
  h += `<div class="card"><div class="card-h"><span class="card-t">الأقسام في الفترة</span></div><div class="tbl-wrap free"><table><thead><tr><th>القسم</th><th class="num">الإجمالي</th><th class="num">متوسط الشهر</th><th class="num hide-sm">أعلى شهر</th></tr></thead><tbody>${cats.map(x => { const tot = x.vals.reduce((a, b) => a + b, 0), mi = x.vals.indexOf(Math.max(...x.vals)); return `<tr><td>${x.k.icon} ${esc(x.k.name)}</td><td class="num"><b>${fmtMoney(tot)}</b></td><td class="num">${fmtMoney(tot / cols.length)}</td><td class="num hide-sm small">${labels[mi]}: ${fmtMoney(x.vals[mi])}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  return h;
}
function printReport() {
  const c = cyc(), s = summarize(D, c.start, c.end), name = (D.settings.owner || 'Hassan');
  const rows = Object.keys(s.byCat).map(k => [catOf(D, k), s.byCat[k]]).sort((a, b) => b[1] - a[1]);
  const L = txIn(D, c.start, c.end).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const due = dueList(D, c.start, c.end);
  const html = `<div class="letterhead"><img class="lh-logo" src="${LOGO}" style="width:60px" alt=""><div><div class="lh-ar">${esc(name)} — الميزانية الشخصية</div><div class="lh-en">Personal budget report</div></div></div>
    <div class="doc-title"><span>تقرير ${esc(cycleName(c, cd()))}</span><span class="doc-ref">${esc(cycleLabel(c, cd()))} · اتطبع ${dsp(todayISO())}</span></div>
    <div class="doc-kpis"><div><span>الدخل</span><b>${fmtMoney(s.inc)}</b></div><div><span>المصروف</span><b>${fmtMoney(s.exp)}</b></div><div><span>${s.net < 0 ? 'العجز' : 'الفاضل'}</span><b>${fmtMoney(Math.abs(s.net))}</b></div><div><span>نسبة الادخار</span><b>${s.rate === null ? '—' : s.rate + '%'}</b></div></div>
    <h3 class="keepnext">المصروف بالأقسام</h3><table class="pt"><thead><tr><th>القسم</th><th class="num">المبلغ</th><th class="num">النسبة</th><th class="num">الميزانية</th><th class="num">الفرق</th></tr></thead><tbody>${rows.map(([k, v]) => `<tr><td>${k.icon} ${esc(k.name)}</td><td class="num">${fmtMoney(v)}</td><td class="num">${s.exp ? Math.round(v / s.exp * 100) : 0}%</td><td class="num">${num(k.budget) ? fmtMoney(k.budget) : '—'}</td><td class="num">${num(k.budget) ? fmtMoney(num(k.budget) - v) : '—'}</td></tr>`).join('')}</tbody><tfoot><tr><td>الإجمالي</td><td class="num">${fmtMoney(s.exp)}</td><td class="num">100%</td><td class="num">${fmtMoney(totalBudget(D))}</td><td class="num">${fmtMoney(totalBudget(D) - s.exp)}</td></tr></tfoot></table>
    ${due.length ? `<h3 class="keepnext">الالتزامات والدخل الثابت</h3><table class="pt"><thead><tr><th>الميعاد</th><th>البند</th><th class="num">المبلغ</th><th>الحالة</th></tr></thead><tbody>${due.map(x => `<tr><td class="dt">${dsp(x.due)}</td><td>${esc(x.rec.name)}</td><td class="num">${fmtMoney(x.rec.amount)}</td><td>${x.paid ? '<span class="chip emer">' + (x.rec.kind === 'inc' ? 'اتقبض' : 'اتدفع') + ' ' + dsp(x.paid.date) + '</span>' : '<span class="chip amber">لسه</span>'}</td></tr>`).join('')}</tbody></table>` : ''}
    <h3 class="keepnext">كل الحركات (${L.length})</h3><table class="pt"><thead><tr><th>التاريخ</th><th>النوع</th><th>القسم</th><th>الحساب</th><th>ملاحظة</th><th class="num">المبلغ</th></tr></thead><tbody>${L.map(x => `<tr class="${x.kind === 'inc' ? 'inrow' : ''}"><td class="dt">${dsp(x.date)}</td><td>${KIND_AR[x.kind] || ''}</td><td>${x.cat ? esc(catOf(D, x.cat).name) : x.kind === 'xfer' ? '← ' + esc(accOf(D, x.to).name) : ''}</td><td>${esc(accOf(D, x.acc).name)}</td><td>${esc(x.note || '')}</td><td class="num">${fmtMoney(x.amount)}</td></tr>`).join('')}</tbody></table>
    <div class="doc-footer">ميزانية ${esc(name)} — ${dsp(todayISO())}</div>`;
  $('#printArea').innerHTML = html;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); $('#printArea').innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(() => { if (!matchMedia('print').matches) done(); }, 800); }, 60);
}
function download(name, text, type) {
  const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function exportCSV() {
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const L = D.tx.slice().sort((a, b) => a.date < b.date ? -1 : 1);
  const lines = [['التاريخ', 'النوع', 'المبلغ', 'القسم', 'الحساب', 'لحساب', 'الهدف', 'ملاحظة'].map(q).join(',')].concat(L.map(x => [x.date, KIND_AR[x.kind] || x.kind, r2(x.amount), x.cat ? catOf(D, x.cat).name : '', accOf(D, x.acc).name, x.to ? accOf(D, x.to).name : '', x.goal ? (byId(D.goals, x.goal) || {}).name : '', x.note || ''].map(q).join(',')));
  download('ميزانية-' + todayISO() + '.csv', '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  toast('اتنزل ملف CSV ✓ (بيتفتح في Excel)', 'ok');
}
async function exportSheet() {
  toast('بيعمل الشيت في جوجل درايف…');
  try { const j = await api('export_sheet'); modal('📗 الشيت جاهز', `<p>اتعمل شيت فيه كل الحركات وملخص الشهور في درايف بتاعك (فولدر «ميزانية Hassan (بيانات)»).</p><a class="btn gold" href="${esc(j.url)}" target="_blank" rel="noopener">افتح الشيت</a>`, '<button class="btn" onclick="closeModal()">قفل</button>'); }
  catch (e) { toast('ماعرفتش أعمل الشيت: ' + (e.message || e.code), 'err'); }
}

/* ================= الإعدادات ================= */
VIEWS.settings = () => {
  const A = D.settings.alerts, tg = UI.tg || {}, lk = LS.get('lock');
  let h = topbar('الإعدادات', '', '');
  // الربط
  h += `<div class="card"><div class="card-h"><span class="card-t">🔗 الربط بسكربت جوجل</span><span class="spacer"></span><span class="syncbox small" style="display:flex;gap:6px;align-items:center"></span></div><div class="card-b">
    ${CFG ? `<div class="note emer">✓ مربوط — البيانات بتتحفظ في جوجل درايف بتاعك وبتتزامن بين الموبايل والكمبيوتر والبوت.${SYNC.lastOk ? ' آخر مزامنة: ' + dsp(SYNC.lastOk.slice(0, 10)) + ' ' + SYNC.lastOk.slice(11, 16) : ''}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn navy" onclick="sync(true)">🔄 زامن دلوقتي</button><button class="btn" onclick="showLinkInput()">تغيير كود الربط</button><button class="btn danger" onclick="unlink()">فصل الربط</button></div>`
      : `<div class="note">البرنامج شغال دلوقتي على الجهاز ده بس. اربطه بسكربت جوجل عشان البيانات تتحفظ في درايف وتشتغل من الموبايل والكمبيوتر وبوت التليجرام.</div>`}
    <div id="linkBox" ${CFG ? 'hidden' : ''} style="margin-top:10px"><label>كود الربط</label><div style="display:flex;gap:8px"><input id="linkCode" dir="ltr" placeholder="https://script.google.com/macros/s/…/exec#…"><button class="btn gold" onclick="linkApp(sval('linkCode'))">اربط</button></div><div class="hint-k">الكود بيطلع من سكربت جوجل (linkCode) — شكله رابط وبعده # وبعدها حروف.</div></div></div></div>`;
  // الدورة
  h += `<div class="card"><div class="card-h"><span class="card-t">📅 الشهر بتاعك</span></div><div class="card-b"><div class="grid3">
    <div class="f"><label>الشهر بيبدأ يوم (يوم المرتب)</label><select onchange="commit([setOp({cycleDay:+this.value})],'الشهر بقى يبدأ يوم '+this.value+' ✓')">${Array.from({ length: 28 }, (_, i) => i + 1).map(d => `<option value="${d}" ${cd() === d ? 'selected' : ''}>${d === 1 ? '1 (الشهر العادي)' : d}</option>`).join('')}</select><div class="hint-k">لو مرتبك بينزل يوم 25، خلّي الشهر يبدأ 25 — الميزانية والتقارير هتمشي من المرتب للمرتب.</div></div>
    <div class="f"><label>الحساب الأساسي</label><select onchange="commit([setOp({defAcc:this.value})],'اتحفظ ✓')">${D.accounts.filter(a => !a.archived).map(a => `<option value="${a.id}" ${D.settings.defAcc === a.id ? 'selected' : ''}>${a.icon} ${esc(a.name)}</option>`).join('')}</select></div>
    <div class="f"><label>اسمك (في التقارير)</label><input value="${esc(D.settings.owner || 'Hassan')}" onchange="commit([setOp({owner:this.value.trim()||'Hassan'})],'اتحفظ ✓')"></div></div></div></div>`;
  // الأقسام
  h += `<div class="card"><div class="card-h"><span class="card-t">🏷 الأقسام</span><span class="spacer"></span><button class="btn sm gold" onclick="catModal(null,'exp')">+ قسم</button></div><div class="tbl-wrap"><table><thead><tr><th>القسم</th><th>النوع</th><th class="num">الميزانية</th><th class="hide-sm">كلمات التليجرام</th><th></th></tr></thead><tbody>${D.cats.slice().sort((a, b) => (a.kind > b.kind ? 1 : -1)).map(k => `<tr data-id="${k.id}" style="${k.archived ? 'opacity:.5' : ''}"><td>${k.icon} ${esc(k.name)}${k.archived ? ' <span class="chip gray">مقفول</span>' : ''}</td><td><span class="chip ${k.kind === 'inc' ? 'emer' : 'gray'}">${k.kind === 'inc' ? 'دخل' : 'مصروف'}</span></td><td class="num">${k.kind === 'exp' && num(k.budget) ? fmtMoney(k.budget) : '—'}</td><td class="hide-sm small">${esc((k.kw || '').slice(0, 60))}</td><td class="acts"><button class="btn ghost sm" onclick="catModal('${k.id}')">✎</button></td></tr>`).join('')}</tbody></table></div></div>`;
  // التليجرام
  h += `<div class="card" id="tgCard"><div class="card-h"><span class="card-t">🤖 بوت التليجرام</span><span class="spacer"></span>${tg.linked ? '<span class="chip pay">شغال</span>' : tg.token ? '<span class="chip amber">مستني الربط</span>' : ''}</div><div class="card-b">${tgSection(tg)}</div></div>`;
  // التنبيهات
  const hrs = Array.from({ length: 24 }, (_, i) => i);
  const hl = i => i === 0 ? '12 بالليل' : i < 12 ? i + ' الصبح' : i === 12 ? '12 الضهر' : (i - 12) + (i < 17 ? ' العصر' : ' بالليل');
  const tog = (k, l, hint) => `<label class="inl" style="margin-bottom:8px"><input type="checkbox" ${A[k] ? 'checked' : ''} onchange="commit([setOp({alerts:{${k}:this.checked}})],'اتحفظ ✓',{render:false})"> ${l}${hint ? ` <span class="small">— ${hint}</span>` : ''}</label>`;
  h += `<div class="card"><div class="card-h"><span class="card-t">🔔 التنبيهات</span></div><div class="card-b">
    <div class="note blue">التنبيهات بتظهر في «الرئيسية» على طول، وبتوصلك على التليجرام كمان لو البوت مربوط (السكربت بيشيّك كل ساعة بتوقيت القاهرة).</div>
    ${tog('bills', 'الصبح: الالتزامات اللي قربت أو اتأخرت، والمرتب لو اتأخر، والسلف')}
    ${tog('daily', 'بالليل: ملخص مصروف اليوم وكام تقدر تصرف بكرة')}
    ${tog('budget', 'لما قسم يوصل 80% أو يعدّي الميزانية')}
    ${tog('unusual', 'لما تسجل مصروف أكبر بكتير من المعتاد')}
    ${tog('weekly', 'ملخص أسبوعي يوم الجمعة')}
    ${tog('monthly', 'تقرير الشهر اللي فات + توقع الشهر الجديد أول كل شهر')}
    <div class="grid3" style="margin-top:6px"><div class="f"><label>تنبيه الصبح الساعة</label><select onchange="commit([setOp({alerts:{morning:+this.value}})],'اتحفظ ✓',{render:false})">${hrs.map(i => `<option value="${i}" ${+A.morning === i ? 'selected' : ''}>${hl(i)}</option>`).join('')}</select></div>
    <div class="f"><label>ملخص الليل الساعة</label><select onchange="commit([setOp({alerts:{evening:+this.value}})],'اتحفظ ✓',{render:false})">${hrs.map(i => `<option value="${i}" ${+A.evening === i ? 'selected' : ''}>${hl(i)}</option>`).join('')}</select></div>
    <div class="f"><label>نبّهني لو رصيد أي حساب أقل من</label><input data-money value="${num(A.lowBal) ? fmtMoney(A.lowBal) : ''}" placeholder="فاضي = من غير" onchange="commit([setOp({alerts:{lowBal:mvalEl(this)}})],'اتحفظ ✓',{render:false})"></div></div></div></div>`;
  // القفل
  h += `<div class="card"><div class="card-h"><span class="card-t">🔒 القفل</span></div><div class="card-b">${lk ? `<div class="note emer">✓ البرنامج مقفول بكلمة سر، وبيقفل لوحده بعد ${lk.min || 5} دقايق من غير استخدام. كلمة السر مش متخزنة ولا بتتبعت لأي مكان.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="lockSetup()">تغيير كلمة السر</button><button class="btn" onclick="showLock()">🔒 اقفل دلوقتي <kbd>Ctrl+L</kbd></button><button class="btn danger" onclick="lockRemove()">شيل القفل</button></div>` : `<p class="small" style="margin-top:0">لو حد ممكن يمسك موبايلك، حط كلمة سر للبرنامج.</p><button class="btn navy" onclick="lockSetup()">حط كلمة سر</button>`}</div></div>`;
  // البيانات
  h += `<div class="card"><div class="card-h"><span class="card-t">💾 البيانات</span></div><div class="card-b"><div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn" onclick="backupDownload()">⬇ نسخة احتياطية (JSON)</button><button class="btn" onclick="$('#restoreFile').click()">⬆ رجّع من نسخة</button><input type="file" id="restoreFile" accept=".json,application/json" hidden onchange="restoreFrom(this.files[0])">
    <button class="btn" onclick="exportCSV()">⬇ CSV للإكسل</button>${CFG ? '<button class="btn" onclick="exportSheet()">📗 شيت جوجل</button>' : ''}<button class="btn" onclick="go('trash')">🗑 سلة المحذوفات (${D.trash.length})</button><button class="btn" onclick="showErrors()">📋 سجل الأخطاء</button></div>
    <div class="hint-k" style="margin-top:8px">${D.tx.length} حركة · ${D.rec.length} التزام · السكربت بيعمل نسخة احتياطية كل يوم في درايف (آخر 30 يوم).</div></div></div>`;
  if (!IS_TOUCH) h += `<div class="card"><div class="card-h"><span class="card-t">⌨️ الاختصارات</span></div><div class="card-b small" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px 18px">${[['N', 'حركة جديدة'], ['Enter', 'احفظ النافذة'], ['Esc', 'اقفل'], ['Ctrl+Z', 'تراجع'], ['Ctrl+S', 'زامن دلوقتي'], ['Ctrl+F', 'دوّر في الحركات'], ['Ctrl+P', 'اطبع تقرير الشهر'], ['Ctrl+D', 'كرر الحركة المحددة'], ['Del', 'امسح المحدد'], ['Ctrl+L', 'اقفل البرنامج'], ['Tab', 'كمّل الكلمة'], ['Ctrl/Shift + دوسة', 'حدد أكتر من حركة']].map(k => `<div><kbd>${k[0]}</kbd> ${k[1]}</div>`).join('')}</div></div>`;
  h += `<div class="small" style="text-align:center;padding:10px">ميزانية Hassan · نسخة ${APP_VER}</div>`;
  if (CFG && !UI.tg && !UI.tgLoading) setTimeout(tgLoad, 50);
  return h;
};
function mvalEl(el) { return el.value.startsWith('=') ? r2(safeEvalFormula(el.value.slice(1))) : r2(num(el.value)); }
function showLinkInput() { $('#linkBox').hidden = false; $('#linkCode').focus(); }
function tgSection(tg) {
  if (!CFG) return '<div class="note">البوت محتاج البرنامج يكون مربوط بسكربت جوجل الأول (فوق).</div>';
  if (tg.err) return `<div class="note">ماقدرتش أعرف حالة البوت: ${esc(tg.err)} <button class="btn sm" onclick="UI.tg=null;tgLoad()">حاول تاني</button></div>`;
  if (UI.tgLoading && !UI.tg) return '<div class="small">بيشيّك…</div>';
  const how = `<div class="calc-box" style="margin-top:10px"><b>البوت بيعمل إيه؟</b><div class="small" style="line-height:1.9">• تسجل مصروف برسالة: <b>150 بنزين</b> · <b>صرفت 2 الف ايجار من البنك</b> · <b>+12000 مرتب</b><br>• يرد عليك بالباقي في الميزانية ويقولك تقدر تصرف كام في اليوم، ومعاه زرار تراجع وتغيير القسم<br>• أوامر: /today /month /budget /balance /forecast /bills /undo<br>• تنبيهات الالتزامات والميزانية وملخص يومي وأسبوعي وشهري</div></div>`;
  if (!tg.token) return `<ol class="steps"><li>افتح التليجرام وكلّم <a href="https://t.me/BotFather" target="_blank" rel="noopener"><b>@BotFather</b></a> وابعتله <b dir="ltr">/newbot</b></li><li>اختار اسم للبوت (مثلاً «ميزانية Hassan») واسم مستخدم ينتهي بـ bot</li><li>هيديك <b>توكن</b> شكله <span dir="ltr">123456:ABC-…</span> — انسخه وحطه هنا:</li></ol>
    <div style="display:flex;gap:8px"><input id="tgTok" dir="ltr" placeholder="123456789:AA…" autocomplete="off"><button class="btn gold" onclick="tgSetup()">اربط البوت</button></div>${how}`;
  let h = '';
  if (!tg.linked) {
    h += `<div class="note">البوت @${esc(tg.bot)} جاهز — فاضل تربطه بحسابك على التليجرام:</div>`;
    if (UI.tgPair) h += `<div style="text-align:center;padding:10px"><div class="small">افتح البوت ودوس Start — أو ابعتله الكود ده:</div><div style="font-size:30px;font-weight:800;letter-spacing:6px;color:var(--navy);direction:ltr">${esc(UI.tgPair)}</div><a class="btn gold" href="https://t.me/${esc(tg.bot)}?start=${esc(UI.tgPair)}" target="_blank" rel="noopener">افتح @${esc(tg.bot)} في التليجرام</a><div class="hint-k">الكود شغال 30 دقيقة. بعد ما تبعته دوس «اتأكد».</div></div>`;
    h += `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn" onclick="tgPair()">${UI.tgPair ? 'كود جديد' : 'اعمل كود ربط'}</button><button class="btn navy" onclick="UI.tg=null;tgLoad()">اتأكد</button><button class="btn ghost" onclick="tgReset()">غيّر التوكن</button></div>`;
  } else {
    h += `<div class="note emer">✓ البوت <a href="https://t.me/${esc(tg.bot)}" target="_blank" rel="noopener"><b>@${esc(tg.bot)}</b></a> مربوط بحسابك.${tg.hook && tg.hook.err ? ' ⚠ آخر مشكلة من التليجرام: ' + esc(tg.hook.err) : ''}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn gold" href="https://t.me/${esc(tg.bot)}" target="_blank" rel="noopener">افتح البوت</a><button class="btn" onclick="tgTest()">ابعت رسالة تجربة</button><button class="btn danger" onclick="tgUnlink()">افصل حسابي</button></div>`;
  }
  return h + how;
}
async function tgLoad() { if (!CFG) return; UI.tgLoading = true; try { const j = await api('tg_status'); UI.tg = j.tg; } catch (e) { UI.tg = { err: e.message || e.code }; } UI.tgLoading = false; if (UI.view === 'settings' && !modalOpen()) { const c = $('#tgCard .card-b'); if (c) c.innerHTML = tgSection(UI.tg); else render(); } }
async function tgSetup() {
  const token = sval('tgTok'); if (!token) return toast('حط التوكن الأول', 'err');
  toast('بيربط البوت…');
  try { const j = await api('tg_setup', { token, url: CFG.url }); UI.tg = j.tg; UI.tgPair = j.pair; render(); toast('البوت اتربط بالسكربت ✓ — فاضل تبعتله الكود', 'ok'); }
  catch (e) { toast(e.message || 'ماعرفتش أربط البوت', 'err'); }
}
async function tgPair() { try { const j = await api('tg_pair'); UI.tgPair = j.pair; UI.tg = j.tg; render(); } catch (e) { toast(e.message, 'err'); } }
async function tgTest() { try { const j = await api('tg_test'); toast(j.sent ? 'اتبعتت ✓ — شوف التليجرام' : 'ماتبعتتش — جرّب تربط تاني', j.sent ? 'ok' : 'err'); } catch (e) { toast(e.message, 'err'); } }
function tgUnlink() { askYesNo('فصل البوت', 'البوت هيبطل يرد عليك ويبعتلك تنبيهات لحد ما تربطه تاني بكود جديد.', async () => { try { const j = await api('tg_unlink'); UI.tg = j.tg; UI.tgPair = null; render(); } catch (e) { toast(e.message, 'err'); } }, 'افصل', true); }
function tgReset() { UI.tg = Object.assign({}, UI.tg, { token: false }); UI.tgPair = null; const c = $('#tgCard .card-b'); if (c) c.innerHTML = tgSection(UI.tg); }

/* ---------- الربط ---------- */
async function linkApp(raw) {
  const cfg = parseCode(raw);
  if (!cfg) return toast('الكود شكله غلط — لازم يبدأ بـ https://script.google.com/… وفيه #', 'err');
  toast('بيتصل بسكربت جوجل…');
  let j; try { j = await api('ping', {}, cfg); } catch (e) { return toast(e.code === 'key' ? 'كود الربط غلط' : (e.message || 'مش عارف أتصل'), 'err'); }
  const localHas = D.tx.length || D.rec.length || D.goals.length || D.debts.length || D.accounts.some(a => num(a.opening)) || totalBudget(D) > 0;
  const finish = async mode => {
    try {
      CFG = cfg; LS.set('cfg', cfg);
      if (mode === 'upload') { const r = await api('init', { data: D, force: true }); SYNC.rev = r.rev; }
      else { SYNC.rev = 0; D = ensureShape(defaultState()); }
      SYNC.outbox = []; SYNC.err = null; persist();
      closeModal(); await sync(); render(); toast('اتربط ✓', 'ok'); tgLoad();
    } catch (e) { toast(e.message || 'حصلت مشكلة', 'err'); }
  };
  if (!j.hasData) return finish(localHas ? 'upload' : 'pull');
  if (!localHas) return finish('pull');
  window._lk = finish;
  modal('فيه بيانات في الناحيتين', `<p>سكربت جوجل عليه بيانات، والجهاز ده عليه بيانات كمان. تحب تعمل إيه؟</p><div class="note">الاختيار التاني هيكتب فوق اللي على جوجل (فيه نسخة احتياطية يومية في درايف لو احتجتها).</div>`,
    `<button class="btn navy" onclick="_lk('pull')">استخدم اللي على جوجل</button><button class="btn danger" onclick="_lk('upload')">ارفع اللي على الجهاز ده</button><button class="btn" onclick="closeModal()">إلغاء</button>`);
}
function unlink() { askYesNo('فصل الربط', 'البيانات هتفضل على الجهاز ده، بس مش هتتزامن مع جوجل ولا البوت لحد ما تربط تاني.', () => { CFG = null; LS.del('cfg'); SYNC.outbox = []; SYNC.err = null; UI.tg = null; persist(); render(); toast('اتفصل'); }, 'افصل', true); }

/* ---------- نسخ احتياطية ---------- */
function backupDownload() { download('ميزانية-نسخة-' + todayISO() + '.json', JSON.stringify(D), 'application/json'); toast('اتنزلت النسخة ✓', 'ok'); }
function restoreFrom(file) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    let data; try { data = JSON.parse(fr.result); } catch (e) { return toast('الملف مش نسخة صحيحة', 'err'); }
    if (!data || !Array.isArray(data.tx) || !Array.isArray(data.cats)) return toast('الملف مش نسخة من البرنامج ده', 'err');
    askYesNo('ترجيع نسخة', `النسخة فيها <b>${data.tx.length}</b> حركة. هتحل مكان البيانات الحالية${CFG ? ' (على الجهاز وعلى جوجل)' : ''}. نزّل نسخة من الحالي الأول لو مش متأكد.`, async () => {
      D = ensureShape(data); SYNC.outbox = []; UNDO = []; persist(); render();
      if (CFG) { try { const r = await api('init', { data: D, force: true }); SYNC.rev = r.rev; persist(); toast('النسخة رجعت واتحفظت على جوجل ✓', 'ok'); } catch (e) { toast('رجعت على الجهاز بس — ' + e.message, 'err'); } }
      else toast('النسخة رجعت ✓', 'ok');
    }, 'رجّع النسخة', true);
  };
  fr.readAsText(file);
}
function showErrors() {
  const L = LS.get('errs') || [];
  modal('📋 سجل الأخطاء', L.length ? L.map(e => `<div class="alert ${/sync/.test(e.where) ? 'amber' : 'red'}" style="cursor:default;flex-direction:column;gap:2px"><div class="small">${dsp(e.at.slice(0, 10))} ${e.at.slice(11, 16)} · ${esc(e.where)}</div><div dir="auto">${esc(e.msg)}</div>${e.means ? `<div><b>يعني:</b> ${esc(e.means)}</div>` : ''}</div>`).join('') : emptyBox('✓', 'مفيش أخطاء'), `${L.length ? '<button class="btn" onclick="LS.del(\'errs\');closeModal();toast(\'السجل اتمسح\')">امسح السجل</button>' : ''}<button class="btn" onclick="closeModal()">قفل</button>`, true);
}

/* ================= القفل ================= */
let LOCKED = false;
const b64e = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function pbkdf2(pw, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  return b64e(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64d(salt), iterations: 150000, hash: 'SHA-256' }, key, 256));
}
function lockSetup() {
  modal('🔒 كلمة سر للبرنامج', `<div class="f"><label>كلمة السر</label><input id="lp1" type="password" autocomplete="new-password"></div><div class="f"><label>اكتبها تاني</label><input id="lp2" type="password" autocomplete="new-password"></div>
    <div class="f"><label>يقفل لوحده بعد</label><select id="lpMin">${[1, 3, 5, 10, 30].map(m => `<option value="${m}" ${m === 5 ? 'selected' : ''}>${m} دقايق</option>`).join('')}</select></div><div class="note">لو نسيتها هتحتاج تمسح بيانات البرنامج من المتصفح وتربطه تاني بكود الربط (البيانات نفسها في أمان على جوجل).</div>`,
    `<button class="btn navy" onclick="_lpSave()">احفظ</button><button class="btn" onclick="closeModal()">إلغاء</button>`);
  window._lpSave = async () => {
    const a = $('#lp1').value, b = $('#lp2').value;
    if (a.length < 4) return toast('كلمة السر 4 حروف على الأقل', 'err');
    if (a !== b) return toast('الكلمتين مش زي بعض', 'err');
    const salt = b64e(crypto.getRandomValues(new Uint8Array(16)));
    LS.set('lock', { salt, hash: await pbkdf2(a, salt), min: +sval('lpMin') });
    closeModal(); render(); toast('القفل اتفعل ✓', 'ok');
  };
}
function lockRemove() { askYesNo('شيل القفل', 'البرنامج هيفتح من غير كلمة سر.', () => { LS.del('lock'); render(); toast('القفل اتشال'); }, 'شيله', true); }
function showLock() {
  const lk = LS.get('lock'); if (!lk) { toast('مفيش كلمة سر — حطها من الإعدادات'); return; }
  LOCKED = true; closeModal();
  let el = $('#lockRoot'); el.innerHTML = `<div class="lock"><form class="lock-box" onsubmit="event.preventDefault();tryUnlock()"><img src="${LOGO}" alt=""><h2>ميزانية ${esc(D.settings.owner || 'Hassan')}</h2><p>اكتب كلمة السر</p><input id="lockPw" type="password" autocomplete="current-password" autofocus><button class="btn navy" style="width:100%;min-height:44px">افتح</button><div class="lock-err" id="lockErr"></div></form></div>`;
  $('#main').innerHTML = '';
  setTimeout(() => { const i = $('#lockPw'); if (i) i.focus(); }, 60);
}
async function tryUnlock() {
  const lk = LS.get('lock'), pw = $('#lockPw').value;
  if (await pbkdf2(pw, lk.salt) === lk.hash) { LOCKED = false; $('#lockRoot').innerHTML = ''; LS.del('hiddenAt'); render(); }
  else { $('#lockErr').textContent = 'كلمة السر غلط'; $('#lockPw').select(); }
}
function checkAutoLock() { const lk = LS.get('lock'), h = LS.get('hiddenAt'); if (lk && h && !LOCKED && Date.now() - h > (lk.min || 5) * 60000) showLock(); }

/* ================= الكيبورد ================= */
document.addEventListener('keydown', e => {
  if (LOCKED) return;
  const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName), k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  if (e.key === 'Escape') { if ($('#ctxRoot').innerHTML) ctxClose(); else if (modalOpen()) closeModal(); else { closeDrawer(); if (UI.sel.size) { UI.sel.clear(); render(); } } return; }
  if (ctrl && k === 'z' && !typing) { e.preventDefault(); undo(); return; }
  if (ctrl && k === 's') { e.preventDefault(); sync(true); return; }
  if (ctrl && k === 'f') { e.preventDefault(); if (UI.view !== 'tx') { UI.view = 'tx'; render(); } setTimeout(() => { const q = $('#txq'); if (q) q.focus(); }, 30); return; }
  if (ctrl && k === 'l') { e.preventDefault(); showLock(); return; }
  if (ctrl && k === 'p') { e.preventDefault(); printReport(); return; }
  if (ctrl && k === 'd' && !typing) { e.preventDefault(); if (UI.sel.size === 1) dupTx([...UI.sel][0]); return; }
  if (modalOpen() || typing || ctrl || e.altKey) return;
  if (e.key === 'Delete' && UI.sel.size) { e.preventDefault(); delTx(Array.from(UI.sel)); return; }
  if (k === 'n' || k === 'ى' || e.key === '+') { e.preventDefault(); txModal(); }
});

/* ================= التشغيل ================= */
const APP_VER = '__VER__';
function boot() {
  $('#sideLogo').src = LOGO; $('#mLogo').src = LOGO;
  // كود الربط ممكن ييجي في الرابط مرة واحدة: …/budget/#link=<الكود>
  const hm = /#link=(.+)$/.exec(location.hash);
  if (hm) { history.replaceState(null, '', location.pathname + location.search); const code = decodeURIComponent(hm[1]); if (!CFG || !LS.get('lock')) setTimeout(() => linkApp(code), 300); }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(e => logErr('sw', e.message));
  $('#drawer').addEventListener('click', closeDrawer);
  if (LS.get('lock')) showLock(); else render();
  if (CFG) scheduleSync(150);
  syncState();
}
boot();
