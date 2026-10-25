/* ================= core.js — المنطق المشترك بين البرنامج وسكربت جوجل =================
   نفس الكود بالظبط بيتنسخ في index.html وفي Code.gs (build.py) — عشان الحسابات والتوقعات
   وقراءة رسايل التليجرام تطلع نفس النتيجة في الموبايل وفي البوت. مفيش أي حاجة هنا بتلمس الشاشة. */

var CORE_VERSION = 1;

/* ---------- أرقام ونصوص ---------- */
function toEnDigits(s) {
  return String(s == null ? '' : s)
    .replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x0660; })
    .replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 0x06F0; })
    .replace(/[٫]/g, '.').replace(/[٬،]/g, ',');
}
function num(v) { if (typeof v === 'number') return isFinite(v) ? v : 0; var n = parseFloat(toEnDigits(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; }
function r2(x) { return Math.round((+x || 0) * 100) / 100; }
function fmtMoney(n) { var v = r2(n); var s = Math.abs(v % 1) > 0.004 ? 2 : 0; return v.toLocaleString('en-US', { minimumFractionDigits: s, maximumFractionDigits: 2 }); }
function fmt0(n) { return Math.round(+n || 0).toLocaleString('en-US'); }
/* توحيد الحروف عشان «أكل» = «اكل» و«بقالة» = «بقاله» */
function normAr(s) {
  return toEnDigits(s).toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ').trim();
}

/* معادلة آمنة: =15000*3+2000 — parser صغير مش eval */
function safeEvalFormula(expr) {
  var s = toEnDigits(expr).replace(/[×x]/g, '*').replace(/÷/g, '/').replace(/,/g, '').replace(/[^0-9+\-*/(). ]/g, '');
  var i = 0;
  function peek() { return s[i]; }
  function skip() { while (s[i] === ' ') i++; }
  function pExpr() { skip(); var v = pTerm(); skip(); while (peek() === '+' || peek() === '-') { var op = s[i++]; var r = pTerm(); v = op === '+' ? v + r : v - r; skip(); } return v; }
  function pTerm() { skip(); var v = pFac(); skip(); while (peek() === '*' || peek() === '/') { var op = s[i++]; var r = pFac(); v = op === '*' ? v * r : (r === 0 ? 0 : v / r); skip(); } return v; }
  function pFac() { skip(); if (peek() === '+') { i++; return pFac(); } if (peek() === '-') { i++; return -pFac(); } if (peek() === '(') { i++; var v = pExpr(); skip(); if (peek() === ')') i++; return v; } var st = i; while (i < s.length && /[0-9.]/.test(s[i])) i++; var n = parseFloat(s.slice(st, i)); return isNaN(n) ? 0 : n; }
  try { var r = pExpr(); return isFinite(r) ? r : 0; } catch (e) { return 0; }
}

/* ---------- تواريخ (كلها نص ISO وحساب UTC عشان مفيش لعب في التوقيت) ---------- */
function d2(iso) { return new Date(iso + 'T00:00:00Z'); }
function isoOf(dt) { return dt.toISOString().slice(0, 10); }
function addDays(iso, n) { var d = d2(iso); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); }
function dim(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }            // m = 1..12
function ymd(y, m, d) { return y + '-' + String(m).padStart(2, '0') + '-' + String(Math.min(d, dim(y, m))).padStart(2, '0'); }
function addMonths(iso, n) { var p = iso.split('-').map(Number); var t = p[0] * 12 + (p[1] - 1) + n; return ymd(Math.floor(t / 12), t % 12 + 1, p[2]); }
function daysBetween(a, b) { return Math.round((d2(b) - d2(a)) / 86400000); }
/* العرض: يوم-شهر-سنة معزول باتجاه شمال←يمين عشان مايتقلبش جوه الكلام العربي */
function dsp(iso) { return iso ? '\u2066' + String(iso).slice(0, 10).split('-').reverse().join('-') + '\u2069' : '—'; }
var MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
var WDAYS = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
function monthName(ym) { if (!ym) return '—'; var p = String(ym).split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0]; }
function weekday(iso) { return WDAYS[d2(iso).getUTCDay()]; }
function shortDate(iso) { var p = iso.split('-'); return (+p[2]) + ' ' + MONTHS[+p[1] - 1]; }

/* 01022026 / 1-2-2026 / 2026-02-01 / ١/٢/٢٠٢٦ → 2026-02-01 */
function parseFlexibleDate(input) {
  var s = toEnDigits(input).replace(/[\u200e\u200f\u2066-\u2069]/g, '').trim();
  if (!s) return '';
  var hasSep = /[/\-.\s]/.test(s), digits = s.replace(/\D/g, ''), dd, mm, yyyy;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) { var t = s.split('-'); yyyy = t[0]; mm = t[1]; dd = t[2]; }
  else if (!hasSep && digits.length === 8) { dd = digits.slice(0, 2); mm = digits.slice(2, 4); yyyy = digits.slice(4); }
  else if (!hasSep && digits.length === 6) { dd = digits.slice(0, 2); mm = digits.slice(2, 4); yyyy = '20' + digits.slice(4); }
  else {
    var parts = s.split(/[/\-.\s]+/).filter(Boolean);
    if (parts.length !== 3) return '';
    dd = parts[0]; mm = parts[1]; yyyy = parts[2];
    if (dd.length === 4) { var tt = dd; dd = yyyy; yyyy = tt; }
    if (yyyy.length === 2) yyyy = '20' + yyyy;
  }
  var d = +dd, m = +mm, y = +yyyy;
  if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= dim(y, m))) return '';
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

/* ---------- دورة الميزانية: من يوم المرتب لليوم اللي قبله في الشهر اللي بعده ---------- */
function cycleDayOf(D) { var c = Math.round(num(D && D.settings && D.settings.cycleDay)); return c >= 1 && c <= 28 ? c : 1; }
function cycleOf(iso, cd) {
  cd = cd || 1;
  var p = iso.split('-').map(Number), y = p[0], m = p[1];
  if (p[2] < cd) { m--; if (!m) { m = 12; y--; } }
  var start = ymd(y, m, cd), end = addDays(addMonths(start, 1), -1);
  return { key: start.slice(0, 7), start: start, end: end };
}
function cycleShift(c, n, cd) { return cycleOf(addMonths(c.start, n), cd); }
function cycleLabel(c, cd) { return cd > 1 ? shortDate(c.start) + ' ← ' + shortDate(c.end) : monthName(c.key); }
function cycleName(c, cd) { return cd > 1 ? 'دورة ' + monthName(c.key) : monthName(c.key); }

/* ---------- البيانات ---------- */
function uid(p) { return (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function defaultState() {
  var u = 1;
  function cat(id, name, kind, icon, kw, budget) { return { id: id, name: name, kind: kind, icon: icon, kw: kw, budget: budget || 0, u: u }; }
  return {
    schema: 1,
    settings: { cycleDay: 1, defAcc: 'a_cash', alerts: { morning: 9, evening: 21, daily: true, bills: true, budget: true, monthly: true, weekly: true, unusual: true, lowBal: 0 } },
    accounts: [
      { id: 'a_cash', name: 'كاش', type: 'cash', icon: '💵', opening: 0, kw: 'كاش, نقدي, محفظتي', u: u },
      { id: 'a_bank', name: 'البنك', type: 'bank', icon: '🏦', opening: 0, kw: 'بنك, فيزا, كارت, حساب', u: u },
      { id: 'a_wallet', name: 'محفظة موبايل', type: 'wallet', icon: '📱', opening: 0, kw: 'فودافون كاش, انستاباي, انستا, محفظه, اورنج كاش', u: u }
    ],
    cats: [
      cat('c_food', 'أكل وبقالة', 'exp', '🛒', 'اكل, بقاله, سوبرماركت, خضار, فاكهه, لحمه, فراخ, سمك, عيش, لبن, جبنه, بيض, رز, زيت, سكر, عطاره, فطار'),
      cat('c_out', 'أكل برة', 'exp', '🍔', 'مطعم, كافيه, قهوه, دليفري, طلبات, شاورما, بيتزا, كشري, فول, سندوتشات, حلويات'),
      cat('c_car', 'عربية ومواصلات', 'exp', '🚗', 'بنزين, سولار, اوبر, كريم, تاكسي, مواصلات, ميكروباص, مترو, جراج, غسيل, زيت عربيه, كاوتش, ميكانيكي, مخالفه, رخصه'),
      cat('c_home', 'السكن', 'exp', '🏠', 'ايجار, صيانه, سباك, كهربائي, نقاش, عفش, اجهزه'),
      cat('c_bills', 'فواتير', 'exp', '💡', 'كهربا, كهرباء, ميه, غاز, نت, انترنت, موبايل, شحن, كارت, فودافون, اورنج, اتصالات, وي, تليفون'),
      cat('c_health', 'صحة', 'exp', '🩺', 'دكتور, دوا, صيدليه, تحاليل, اشعه, مستشفي, كشف, اسنان'),
      cat('c_edu', 'تعليم', 'exp', '🎓', 'مدرسه, دروس, درس, كورس, كتب, جامعه, مصاريف دراسه'),
      cat('c_clothes', 'لبس', 'exp', '👕', 'لبس, هدوم, جزمه, شنطه, قميص, بنطلون'),
      cat('c_family', 'البيت والعيلة', 'exp', '👨‍👩‍👧', 'منظفات, ادوات, عيال, مصروف, بامبرز, لعب'),
      cat('c_gift', 'مناسبات وهدايا', 'exp', '🎁', 'هديه, فرح, عزومه, نقطه, عيديه, عيد ميلاد'),
      cat('c_charity', 'صدقة وزكاة', 'exp', '🤲', 'صدقه, زكاه, تبرع'),
      cat('c_fun', 'ترفيه واشتراكات', 'exp', '🎬', 'خروجه, خروج, سينما, رحله, مصيف, اشتراك, نتفليكس, شاهد, يوتيوب, جيم, نادي'),
      cat('c_debt', 'أقساط وجمعيات', 'exp', '💳', 'قسط, قرض, جمعيه, تقسيط'),
      cat('c_misc', 'متفرقات', 'exp', '📦', ''),
      cat('c_salary', 'المرتب', 'inc', '💼', 'مرتب, راتب, قبضت, قبض'),
      cat('c_biz', 'أرباح الشغل', 'inc', '🏗', 'ارباح, ربح, مستخلص, مقاوله, شغل, عمولة, عموله'),
      cat('c_rent', 'إيجارات', 'inc', '🏘', 'ايجار, ايجارات'),
      cat('c_oinc', 'دخل تاني', 'inc', '💵', 'هديه, عيديه, رجعلي, استرداد')
    ],
    tx: [], rec: [], goals: [], debts: [], trash: [],
    meta: { rev: 0, created: new Date().toISOString().slice(0, 19) }
  };
}
var COLS = ['accounts', 'cats', 'tx', 'rec', 'goals', 'debts'];
function ensureShape(D) {
  var d = D && typeof D === 'object' ? D : defaultState();
  COLS.concat(['trash']).forEach(function (c) { if (!Array.isArray(d[c])) d[c] = []; });
  d.settings = d.settings || {}; d.settings.alerts = d.settings.alerts || {};
  var def = defaultState().settings;
  Object.keys(def).forEach(function (k) { if (d.settings[k] === undefined) d.settings[k] = def[k]; });
  Object.keys(def.alerts).forEach(function (k) { if (d.settings.alerts[k] === undefined) d.settings.alerts[k] = def.alerts[k]; });
  d.meta = d.meta || { rev: 0 };
  return d;
}
function byId(arr, id) { for (var i = 0; i < (arr || []).length; i++) if (arr[i].id === id) return arr[i]; return null; }
function catOf(D, id) { return byId(D.cats, id) || { id: id, name: id ? 'قسم ممسوح' : 'من غير قسم', icon: '❔', kind: 'exp', budget: 0 }; }
function accOf(D, id) { return byId(D.accounts, id) || { id: id, name: id ? 'حساب ممسوح' : '—', icon: '❔' }; }

/* ---------- العمليات (المزامنة كلها عمليات صغيرة: put / del / restore / set) ----------
   كل عنصر عليه u = وقت آخر تعديل؛ الأحدث هو اللي يكسب لو نفس العنصر اتعدل من مكانين. */
function applyOp(D, op) {
  if (!op || !op.act) return false;
  if (op.act === 'set') {                       // الإعدادات
    var s = op.item || {};
    if ((D.settings._u || 0) > (op.u || 0)) return false;
    Object.keys(s).forEach(function (k) { if (k === 'alerts') { D.settings.alerts = Object.assign({}, D.settings.alerts, s.alerts); } else D.settings[k] = s[k]; });
    D.settings._u = op.u || Date.now();
    return true;
  }
  var col = op.col;
  if (COLS.indexOf(col) < 0) return false;
  var arr = D[col];
  if (op.act === 'put') {
    var it = op.item; if (!it || !it.id) return false;
    for (var i = 0; i < arr.length; i++) if (arr[i].id === it.id) {
      if ((arr[i].u || 0) > (it.u || 0)) return false;
      arr[i] = it; return true;
    }
    // لو كان في السلة وجاله تعديل أحدث، يرجع
    D.trash = D.trash.filter(function (t) { return !(t.col === col && t.item && t.item.id === it.id); });
    arr.push(it); return true;
  }
  if (op.act === 'del') {
    for (var j = 0; j < arr.length; j++) if (arr[j].id === op.id) {
      var gone = arr.splice(j, 1)[0];
      D.trash.unshift({ col: col, item: gone, at: op.at || new Date().toISOString().slice(0, 19) });
      if (D.trash.length > 800) D.trash.length = 800;
      return true;
    }
    return false;
  }
  if (op.act === 'restore') {
    for (var k = 0; k < D.trash.length; k++) { var t = D.trash[k]; if (t.col === col && t.item && t.item.id === op.id) {
      D.trash.splice(k, 1);
      if (!byId(arr, op.id)) { t.item.u = op.u || Date.now(); arr.push(t.item); }
      return true;
    } }
    return false;
  }
  return false;
}

/* ---------- الأرصدة ---------- */
function txSign(t, accId) {           // أثر الحركة على حساب معيّن
  var a = r2(t.amount);
  if (t.kind === 'inc' || t.kind === 'unsave') return t.acc === accId ? a : 0;
  if (t.kind === 'exp' || t.kind === 'save') return t.acc === accId ? -a : 0;
  if (t.kind === 'xfer') return (t.acc === accId ? -a : 0) + (t.to === accId ? a : 0);
  if (t.kind === 'adj') return t.acc === accId ? a : 0;            // تسوية رصيد (بالإشارة) — مالهاش دعوة بالمصروف
  return 0;
}
function balances(D, uptoISO) {
  var out = {};
  D.accounts.forEach(function (a) { out[a.id] = r2(a.opening); });
  D.tx.forEach(function (t) {
    if (uptoISO && t.date > uptoISO) return;
    if (t.acc && out[t.acc] === undefined) out[t.acc] = 0;
    if (t.to && out[t.to] === undefined) out[t.to] = 0;
    if (t.acc) out[t.acc] = r2(out[t.acc] + txSign(t, t.acc));
    if (t.kind === 'xfer' && t.to) out[t.to] = r2(out[t.to] + r2(t.amount));
  });
  return out;
}
function totalBalance(D, uptoISO) { var b = balances(D, uptoISO), s = 0; D.accounts.forEach(function (a) { if (!a.archived) s += b[a.id] || 0; }); return r2(s); }
function goalSaved(D, gid) { var s = 0; D.tx.forEach(function (t) { if (t.goal === gid) { if (t.kind === 'save') s += r2(t.amount); else if (t.kind === 'unsave') s -= r2(t.amount); } }); return r2(s); }
function debtLeft(d) { var p = 0; (d.pays || []).forEach(function (x) { p += r2(x.amount); }); return r2(r2(d.amount) - p); }

/* ---------- ملخص دورة ---------- */
function txIn(D, start, end) { return D.tx.filter(function (t) { return t.date >= start && t.date <= end; }); }
function summarize(D, start, end) {
  var s = { inc: 0, exp: 0, save: 0, byCat: {}, byIncCat: {}, byDay: {}, n: 0, fixedExp: 0 };
  txIn(D, start, end).forEach(function (t) {
    var a = r2(t.amount); s.n++;
    if (t.kind === 'inc') { s.inc += a; s.byIncCat[t.cat] = r2((s.byIncCat[t.cat] || 0) + a); }
    else if (t.kind === 'exp') { s.exp += a; s.byCat[t.cat] = r2((s.byCat[t.cat] || 0) + a); s.byDay[t.date] = r2((s.byDay[t.date] || 0) + a); if (t.rec) s.fixedExp += a; }
    else if (t.kind === 'save') s.save += a;
    else if (t.kind === 'unsave') s.save -= a;
  });
  s.inc = r2(s.inc); s.exp = r2(s.exp); s.save = r2(s.save); s.fixedExp = r2(s.fixedExp);
  s.net = r2(s.inc - s.exp);
  s.rate = s.inc > 0 ? Math.round((s.inc - s.exp) / s.inc * 100) : null;
  return s;
}
function totalBudget(D) { var b = 0; D.cats.forEach(function (c) { if (c.kind === 'exp' && !c.archived) b += num(c.budget); }); return r2(b); }
function budgetRows(D, c) {
  var s = summarize(D, c.start, c.end);
  return D.cats.filter(function (x) { return x.kind === 'exp' && (!x.archived || s.byCat[x.id]); }).map(function (x) {
    var spent = s.byCat[x.id] || 0, b = num(x.budget);
    return { cat: x, spent: spent, budget: b, left: r2(b - spent), pct: b > 0 ? Math.round(spent / b * 100) : (spent > 0 ? null : 0) };
  }).sort(function (a, b) { return (b.budget > 0) - (a.budget > 0) || b.spent - a.spent; });
}

/* ---------- الالتزامات والدخل المتكرر ---------- */
var FREQ = { m: 'كل شهر', y: 'كل سنة', w: 'كل أسبوع', q: 'كل 3 شهور', once: 'مرة واحدة' };
function recOccurrences(r, from, to) {
  if (!r || r.active === false) return [];
  var start = r.start || '2000-01-01', out = [], n = 0, maxN = r.count ? Math.round(num(r.count)) : 0;
  function push(d) { if (r.end && d > r.end) return false; n++; if (maxN && n > maxN) return false; if (d >= from && d <= to && d >= start) out.push(d); return true; }
  if (r.freq === 'once') { if (start >= from && start <= to) out.push(start); return out; }
  if (r.freq === 'w') {
    var d = start; for (var g = 0; g < 1200 && d <= to; g++) { if (!push(d)) break; d = addDays(d, 7); }
    return out;
  }
  var step = r.freq === 'y' ? 12 : r.freq === 'q' ? 3 : 1;
  var sp = start.split('-').map(Number), day = r.freq === 'm' || r.freq === 'q' ? (Math.round(num(r.day)) || sp[2]) : sp[2];
  var first = ymd(sp[0], sp[1], day);
  if (first < start) first = addMonths(first, step);     // أول استحقاق بعد تاريخ البداية
  for (var k = 0; k < 600; k++) {
    var p = first.split('-').map(Number), t = p[0] * 12 + (p[1] - 1) + k * step;
    var dd = ymd(Math.floor(t / 12), t % 12 + 1, day);
    if (dd > to) break;
    if (!push(dd)) break;
  }
  return out;
}
function recPaid(D, r, due) {
  for (var i = 0; i < D.tx.length; i++) { var t = D.tx[i]; if (t.rec === r.id && (t.due === due || (!t.due && Math.abs(daysBetween(t.date, due)) <= 10))) return t; }
  return null;
}
/* كل استحقاقات الفترة، ومين اتدفع ومين لأ */
function dueList(D, from, to) {
  var out = [];
  D.rec.forEach(function (r) {
    recOccurrences(r, from, to).forEach(function (d) { out.push({ rec: r, due: d, paid: recPaid(D, r, d) }); });
  });
  return out.sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });
}

/* ---------- التوقعات ---------- */
function median(a) { if (!a.length) return 0; var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
/* متوسط مرجّح للشهور الأحدث، والقيم الشاذة متقصوصة عند ضعف الوسيط */
function robustAvg(vals) {
  if (!vals.length) return { avg: 0, lo: 0, hi: 0, sporadic: false };
  var med = median(vals), cap = med > 0 ? med * 2 : Infinity, ws = 0, s = 0, sporadic = !(med > 0);
  // مصروف مش منتظم (أغلب الشهور صفر): متوسط عادي — مفيش وزن للأحدث
  vals.forEach(function (v, i) { var w = sporadic ? 1 : Math.max(1, 6 - i); s += Math.min(v, cap) * w; ws += w; });
  var avg = s / ws, varr = 0;
  vals.forEach(function (v) { varr += Math.pow(Math.min(v, cap) - avg, 2); });
  var sd = Math.sqrt(varr / vals.length);
  sd = Math.max(sd, avg * 0.08);
  return { avg: Math.round(avg), lo: Math.round(Math.max(0, avg - sd)), hi: Math.round(avg + sd), sporadic: sporadic };
}
function trendPct(vals) {            // vals: الأحدث الأول
  if (vals.length < 3) return null;
  var v = vals.slice().reverse(), n = v.length, mx = (n - 1) / 2, my = 0;
  v.forEach(function (y) { my += y; }); my /= n;
  var a = 0, b = 0; v.forEach(function (y, x) { a += (x - mx) * (y - my); b += (x - mx) * (x - mx); });
  if (!b || !my) return null;
  return Math.round((a / b) / my * 100);
}
/* بيقيس آخر 6 دورات كاملة لكل قسم — من غير المصاريف الثابتة (دي بتتحسب من الالتزامات بالظبط) */
function history(D, today, nBack) {
  var cd = cycleDayOf(D), cur = cycleOf(today, cd), out = [];
  var firstTx = D.tx.reduce(function (m, t) { return !m || t.date < m ? t.date : m; }, '');
  for (var i = 1; i <= (nBack || 6); i++) {
    var c = cycleShift(cur, -i, cd);
    if (!firstTx || c.end < firstTx) break;
    var rows = { c: c, varCat: {}, varInc: {}, fixInc: 0, fixExp: 0, partial: c.start < firstTx };
    txIn(D, c.start, c.end).forEach(function (t) {
      var a = r2(t.amount);
      if (t.kind === 'exp') { if (t.rec) rows.fixExp += a; else rows.varCat[t.cat] = r2((rows.varCat[t.cat] || 0) + a); }
      else if (t.kind === 'inc') { if (t.rec) rows.fixInc += a; else rows.varInc[t.cat] = r2((rows.varInc[t.cat] || 0) + a); }
    });
    out.push(rows);
  }
  // دورة بادئة في نص البيانات (أول شهر استخدام) بتقلل المتوسط — نسيبها بس لو مفيش غيرها
  var full = out.filter(function (h) { return !h.partial; });
  return full.length ? full : out;
}
function forecastCycle(D, c, today) {
  var hist = history(D, today, 6), cats = {}, incs = {};
  var res = { c: c, fixedInc: 0, fixedExp: 0, varExp: 0, varInc: 0, lo: 0, hi: 0, rows: [], incRows: [], dues: [], basis: hist.length, goals: 0 };
  // ١) الثابت: من الالتزامات والدخل المتكرر
  var dues = dueList(D, c.start, c.end); res.dues = dues;
  var fixedByCat = {};
  dues.forEach(function (x) {
    var a = r2(x.rec.amount);
    if (x.rec.kind === 'inc') { res.fixedInc += a; incs[x.rec.cat] = incs[x.rec.cat] || { fixed: 0, v: { avg: 0, lo: 0, hi: 0 } }; incs[x.rec.cat].fixed += a; }
    else { res.fixedExp += a; fixedByCat[x.rec.cat] = r2((fixedByCat[x.rec.cat] || 0) + a); }
  });
  // ٢) المتغير: من التاريخ؛ ولو مفيش تاريخ نستخدم الميزانية
  D.cats.forEach(function (k) {
    if (k.archived) return;
    if (k.kind === 'exp') {
      var vals = hist.map(function (h) { return h.varCat[k.id] || 0; });
      var est = hist.length ? robustAvg(vals) : { avg: num(k.budget), lo: num(k.budget) * 0.85, hi: num(k.budget) * 1.15 };
      var fixed = fixedByCat[k.id] || 0;
      if (!est.avg && !fixed) return;
      var row = { cat: k, fixed: r2(fixed), v: est, total: r2(fixed + est.avg), budget: num(k.budget), trend: est.sporadic ? null : trendPct(vals), sporadic: !!est.sporadic, src: hist.length ? 'hist' : 'budget' };
      res.rows.push(row); res.varExp += est.avg; res.lo += fixed + est.lo; res.hi += fixed + est.hi;
    } else {
      var iv = hist.map(function (h) { return h.varInc[k.id] || 0; });
      var e = robustAvg(iv);
      var f = incs[k.id] ? incs[k.id].fixed : 0;
      if (!e.avg && !f) return;
      // الدخل المتغير بنحسبه بحذر: الأقل بين المتوسط والوسيط
      var cons = Math.round(Math.min(e.avg, median(iv)));
      if (!cons && !f) return;
      res.incRows.push({ cat: k, fixed: r2(f), v: { avg: r2(cons), lo: e.lo, hi: e.hi }, total: r2(f + cons) });
      res.varInc += cons;
    }
  });
  res.rows.sort(function (a, b) { return b.total - a.total; });
  res.incRows.sort(function (a, b) { return b.total - a.total; });
  // ٣) الأهداف: القسط الشهري اللازم عشان توصل في ميعادك
  D.goals.forEach(function (g) { var need = goalMonthly(D, g, c.start); if (need > 0) res.goals += need; });
  ['fixedInc', 'fixedExp', 'varExp', 'varInc', 'lo', 'hi', 'goals'].forEach(function (k) { res[k] = r2(res[k]); });
  res.inc = r2(res.fixedInc + res.varInc);
  res.exp = r2(res.fixedExp + res.varExp);
  res.net = r2(res.inc - res.exp);
  return res;
}
function goalMonthly(D, g, fromISO) {
  var left = r2(num(g.target) - goalSaved(D, g.id));
  if (left <= 0 || !g.deadline) return 0;
  var months = Math.max(1, Math.ceil(daysBetween(fromISO, g.deadline) / 30.44));
  return Math.ceil(left / months / 10) * 10;
}
/* الدورة الحالية: اللي اتصرف + اللي فاضل من الالتزامات + المتغير على حسب المعدل */
function projectCurrent(D, today) {
  var cd = cycleDayOf(D), c = cycleOf(today, cd), s = summarize(D, c.start, today);
  var total = daysBetween(c.start, c.end) + 1, gone = daysBetween(c.start, today) + 1, left = total - gone;
  var varSpent = 0; txIn(D, c.start, today).forEach(function (t) { if (t.kind === 'exp' && !t.rec) varSpent += r2(t.amount); });
  var fc = forecastCycle(D, c, today);
  var histDaily = fc.varExp / total, curDaily = varSpent / Math.max(1, gone);
  // أول الشهر المعدل الحالي مش موثوق؛ بنميل للتاريخ، وكل ما الأيام تعدي بنصدق المعدل الحالي أكتر
  var w = Math.min(1, gone / (total * 0.6)), daily = fc.basis ? (curDaily * w + histDaily * (1 - w)) : curDaily;
  var dues = dueList(D, addDays(today, 1), c.end);
  var dueExpLeft = 0, dueIncLeft = 0;
  dueList(D, c.start, c.end).forEach(function (x) { if (!x.paid) { if (x.rec.kind === 'inc') dueIncLeft += r2(x.rec.amount); else dueExpLeft += r2(x.rec.amount); } });
  var expEnd = Math.round(s.exp + daily * left + dueExpLeft), incEnd = r2(s.inc + dueIncLeft);
  return { c: c, s: s, total: total, gone: gone, left: left, daily: Math.round(daily), expEnd: expEnd, incEnd: incEnd, netEnd: r2(incEnd - expEnd), dueExpLeft: r2(dueExpLeft), dueIncLeft: r2(dueIncLeft), upcoming: dues };
}
/* «تقدر تصرف كام في اليوم لحد آخر الدورة» */
function safeToSpend(D, today) {
  var p = projectCurrent(D, today), bud = totalBudget(D);
  var bal = totalBalance(D, today);
  // من الرصيد: الفلوس اللي معاك + دخل لسه جاي − التزامات لسه عليك − أهداف الشهر
  var goalsLeft = 0; D.goals.forEach(function (g) {
    var need = goalMonthly(D, g, p.c.start), put = 0;
    txIn(D, p.c.start, p.c.end).forEach(function (t) { if (t.goal === g.id && t.kind === 'save') put += r2(t.amount); });
    goalsLeft += Math.max(0, need - put);
  });
  var fromCash = r2(bal + p.dueIncLeft - p.dueExpLeft - goalsLeft);
  // من الميزانية: الميزانية المتغيرة − المتغير اللي اتصرف
  var varSpent = 0; txIn(D, p.c.start, today).forEach(function (t) { if (t.kind === 'exp' && !t.rec) varSpent += r2(t.amount); });
  var fixedBudget = 0; dueList(D, p.c.start, p.c.end).forEach(function (x) { if (x.rec.kind !== 'inc') fixedBudget += r2(x.rec.amount); });
  var fromBudget = bud > 0 ? r2(Math.max(0, bud - fixedBudget) - varSpent) : null;
  // الرصيد مايبقاش له معنى غير لو حطيت أرصدة البداية أو سجلت دخل
  var cashKnown = D.accounts.some(function (a) { return num(a.opening) !== 0; }) || D.tx.some(function (t) { return t.kind === 'inc' || t.kind === 'adj'; });
  if (!cashKnown) fromCash = null;
  var avail = fromBudget === null ? fromCash : fromCash === null ? fromBudget : Math.min(fromCash, fromBudget);
  var days = Math.max(1, p.left + 1);
  if (avail === null) return { avail: null, perDay: null, days: days, fromCash: null, fromBudget: null, goalsLeft: r2(goalsLeft), p: p };
  return { avail: r2(avail), perDay: Math.floor(Math.max(0, avail) / days / 5) * 5, days: days, fromCash: fromCash, fromBudget: fromBudget, goalsLeft: r2(goalsLeft), p: p };
}
/* خط الرصيد المتوقع يوم بيوم: الالتزامات في مواعيدها + المتغير موزع على الأيام */
function balanceTimeline(D, today, days) {
  var cd = cycleDayOf(D), bal = totalBalance(D, today), pts = [{ d: today, v: bal }];
  var end = addDays(today, days || 60), dues = dueList(D, addDays(today, 1), end).filter(function (x) { return !x.paid; });
  var fcCache = {}, dmap = {};
  dues.forEach(function (x) { dmap[x.due] = (dmap[x.due] || 0) + (x.rec.kind === 'inc' ? 1 : -1) * r2(x.rec.amount); });
  var lowest = { d: today, v: bal };
  for (var i = 1; i <= (days || 60); i++) {
    var d = addDays(today, i), c = cycleOf(d, cd);
    if (!fcCache[c.key]) { var f = forecastCycle(D, c, today); fcCache[c.key] = { e: f.varExp / (daysBetween(c.start, c.end) + 1), inc: f.varInc / (daysBetween(c.start, c.end) + 1) }; }
    bal = r2(bal - fcCache[c.key].e + fcCache[c.key].inc + (dmap[d] || 0));
    pts.push({ d: d, v: bal });
    if (bal < lowest.v) lowest = { d: d, v: bal };
  }
  return { pts: pts, lowest: lowest };
}

/* ---------- التنبيهات (نفس القايمة في البرنامج وفي البوت) ---------- */
function alertsFor(D, today) {
  var out = [], A = D.settings.alerts || {}, cd = cycleDayOf(D), c = cycleOf(today, cd);
  // ميزانية
  budgetRows(D, c).forEach(function (r) {
    if (r.budget > 0 && r.spent > r.budget) out.push({ lvl: 'red', key: 'over_' + r.cat.id, txt: r.cat.icon + ' ' + r.cat.name + ': عدّيت الميزانية بـ ' + fmtMoney(r.spent - r.budget), go: 'budget' });
    else if (r.budget > 0 && r.pct >= 80) out.push({ lvl: 'amber', key: 'near_' + r.cat.id, txt: r.cat.icon + ' ' + r.cat.name + ': صرفت ' + r.pct + '% من الميزانية — فاضل ' + fmtMoney(r.left), go: 'budget' });
  });
  // التزامات
  dueList(D, addDays(today, -20), addDays(today, 7)).forEach(function (x) {
    if (x.paid) return;
    var n = daysBetween(today, x.due), r = x.rec, rd = Math.max(0, Math.round(num(r.remind === undefined ? 3 : r.remind)));
    if (r.kind === 'inc') {
      if (n < -2) out.push({ lvl: 'amber', key: 'inc_' + r.id + x.due, txt: '💼 ' + r.name + ' كان المفروض ييجي ' + dsp(x.due) + ' ولسه ما اتسجلش', go: 'income', rec: r.id, due: x.due });
      else if (n <= 0) out.push({ lvl: 'blue', key: 'inc_' + r.id + x.due, txt: '💼 ' + r.name + ' (' + fmtMoney(r.amount) + ') ميعاده ' + (n === 0 ? 'النهارده' : dsp(x.due)) + ' — سجله لما ييجي', go: 'income', rec: r.id, due: x.due });
    } else {
      if (n < 0) out.push({ lvl: 'red', key: 'late_' + r.id + x.due, txt: '⏰ ' + r.name + ' (' + fmtMoney(r.amount) + ') متأخر من ' + dsp(x.due), go: 'bills', rec: r.id, due: x.due });
      else if (n <= rd) out.push({ lvl: 'amber', key: 'due_' + r.id + x.due, txt: '📅 ' + r.name + ' (' + fmtMoney(r.amount) + ') ' + (n === 0 ? 'ميعاده النهارده' : n === 1 ? 'ميعاده بكرة' : 'باقي عليه ' + n + ' أيام'), go: 'bills', rec: r.id, due: x.due });
    }
  });
  // سلف
  D.debts.forEach(function (d) {
    var left = debtLeft(d); if (left <= 0.005 || !d.due) return;
    var n = daysBetween(today, d.due);
    if (n <= 3) out.push({ lvl: n < 0 ? 'red' : 'amber', key: 'debt_' + d.id, txt: (d.dir === 'in' ? '🤝 ' + d.person + ' عليه ' : '🤝 عليك لـ ' + d.person + ' ') + fmtMoney(left) + (n < 0 ? ' — الميعاد عدّى ' + dsp(d.due) : n === 0 ? ' — ميعادها النهارده' : ' — ميعادها ' + dsp(d.due)), go: 'debts' });
  });
  // رصيد قليل
  var low = num(A.lowBal);
  if (low > 0) { var b = balances(D, today); D.accounts.forEach(function (a) { if (!a.archived && (b[a.id] || 0) < low) out.push({ lvl: 'amber', key: 'low_' + a.id, txt: a.icon + ' رصيد ' + a.name + ' قليل: ' + fmtMoney(b[a.id] || 0), go: 'accounts' }); }); }
  // الرصيد هيخلص قبل المرتب؟
  var tl = balanceTimeline(D, today, Math.max(1, daysBetween(today, c.end)));
  if (tl.lowest.v < 0 && D.tx.length > 5) out.push({ lvl: 'red', key: 'neg', txt: '📉 على المعدل ده الفلوس هتخلص حوالي ' + dsp(tl.lowest.d) + ' — قبل آخر الدورة', go: 'forecast' });
  var order = { red: 0, amber: 1, blue: 2 };
  return out.sort(function (a, b) { return order[a.lvl] - order[b.lvl]; });
}
/* مصروف غريب: أكبر من 3 أضعاف المعتاد في نفس القسم */
function isUnusual(D, t) {
  if (t.kind !== 'exp' || t.rec) return false;
  var same = D.tx.filter(function (x) { return x.kind === 'exp' && x.cat === t.cat && x.id !== t.id && !x.rec; }).map(function (x) { return r2(x.amount); });
  if (same.length < 6) return false;
  var m = median(same);
  return m > 0 && r2(t.amount) > m * 3 && r2(t.amount) - m > 200;
}

/* ---------- قراءة رسالة التليجرام: «150 بنزين» / «صرفت 2 الف ايجار من البنك» / «+12000 مرتب» ---------- */
var INC_WORDS = ['قبضت', 'استلمت', 'جالي', 'جاني', 'دخل', 'دخلي', 'اتحولي', 'وصلني', 'حصلت', 'كسبت'];
var EXP_WORDS = ['صرفت', 'دفعت', 'اشتريت', 'جبت', 'سددت', 'خرج'];
var STOP = ['صرفت', 'دفعت', 'اشتريت', 'جبت', 'سددت', 'قبضت', 'استلمت', 'جالي', 'جاني', 'على', 'علي', 'عل', 'في', 'من', 'ل', 'لل', 'ب', 'جنيه', 'جنية', 'ج', 'جم', 'ج.م', 'egp', 'le', 'النهارده', 'امبارح', 'امس', 'اول', 'حق', 'تمن', 'ثمن', 'بتاع', 'بتاعت', 'دخل', 'اتحولي', 'وصلني', 'حولت', 'حول', 'تحويل'];
function matchScore(textN, words) {
  var best = 0;
  words.forEach(function (w) {
    w = normAr(w); if (!w || w.length < 2) return;
    var re = new RegExp('(^|[\\s،,.+\\-])(ال|بال|وال|لل|و|ب)?' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[\\s،,.!?؟])');
    if (re.test(textN)) best = Math.max(best, w.length + 2);
    else if (w.length >= 4 && textN.indexOf(w) >= 0) best = Math.max(best, w.length);
  });
  return best;
}
function parseBotText(D, text, today) {
  var raw = toEnDigits(text).trim();
  if (!raw) return null;
  var t = normAr(raw);
  // المبلغ: أول رقم أو معادلة (150 / 1,500 / 150+75 / 2.5 الف / 3k)
  var m = /(^|[^0-9a-z])([+\-]?\s*[0-9][0-9.,]*(?:\s*[+\-*/×x]\s*[0-9][0-9.,]*)*)\s*(الف|ك|k|الاف)?(?![0-9])/i.exec(t);
  if (!m) return null;
  var expr = m[2].replace(/\s+/g, ''), plus = /^\+/.test(expr);
  expr = expr.replace(/^[+\-]/, '');
  // 1,500 = ألف وخمسمية مش 1.5
  var amount = /[+\-*/×x]/.test(expr) ? safeEvalFormula(expr) : num(expr);
  if (m[3]) amount *= 1000;
  if (!/[0-9]/.test(expr) || amount <= 0) return null;
  amount = r2(amount);
  var rest = (t.slice(0, m.index + m[1].length) + ' ' + t.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
  // التاريخ
  var date = today;
  if (/(^|\s)اول امبارح(\s|$)/.test(t)) date = addDays(today, -2);
  else if (/(^|\s)(امبارح|امس)(\s|$)/.test(t)) date = addDays(today, -1);
  var dm = /(^|\s)(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?(\s|$)/.exec(rest);
  if (dm) { var y = dm[4] ? (dm[4].length === 2 ? '20' + dm[4] : dm[4]) : today.slice(0, 4); var pd = parseFlexibleDate(dm[2] + '-' + dm[3] + '-' + y); if (pd) { date = pd; rest = rest.replace(dm[0], ' ').trim(); } }
  // نوع الحركة
  var kind = 'exp';
  var xferM = /(حولت|حول|تحويل)/.test(t);
  if (plus || INC_WORDS.some(function (w) { return new RegExp('(^|\\s)' + w + '(\\s|$)').test(t); })) kind = 'inc';
  // الحساب
  var acc = null, accScore = 0, to = null;
  if (xferM) {
    var fm = /من\s+(.+?)\s+(لل|ل|الي|الى|علي|على)\s*(.+)$/.exec(rest);
    if (fm) {
      var fa = bestAcc(D, fm[1]), ta = bestAcc(D, fm[3]);
      if (fa && ta && fa.id !== ta.id) return { kind: 'xfer', amount: amount, acc: fa.id, to: ta.id, date: date, cat: '', note: '', guessed: false };
    }
  }
  D.accounts.forEach(function (a) {
    if (a.archived) return;
    var s = matchScore(t, [a.name].concat(String(a.kw || '').split(/[,،]/)));
    if (s > accScore) { accScore = s; acc = a.id; }
  });
  // القسم
  var best = null, bs = 0;
  D.cats.forEach(function (c) {
    if (c.archived) return;
    var s = matchScore(rest, [c.name].concat(String(c.kw || '').split(/[,،]/)));
    if (c.kind !== kind) s = s ? s - 1 : 0;           // نفضّل القسم من نفس النوع
    if (s > bs) { bs = s; best = c; }
  });
  if (best && best.kind !== kind) {
    // «مرتب 12000» من غير «قبضت»: القسم بيحدد النوع
    if (!plus && !INC_WORDS.some(function (w) { return t.indexOf(w) >= 0; }) && !EXP_WORDS.some(function (w) { return t.indexOf(w) >= 0; })) kind = best.kind;
    else best = null;
  }
  var accWords = [];
  if (acc) { var aa = byId(D.accounts, acc); accWords = [aa.name].concat(String(aa.kw || '').split(/[,،]/)).map(function (w) { return normAr(w).replace(/^ال/, ''); }).filter(Boolean); }
  var guessed = !best;
  if (!best) best = byId(D.cats, kind === 'inc' ? 'c_oinc' : 'c_misc') || D.cats.filter(function (c) { return c.kind === kind; })[0];
  // الملاحظة: باقي الكلام من غير كلمات الحشو
  var note = raw.replace(/[+]?\s*[0-9][0-9.,]*(\s*[+\-*/×x]\s*[0-9][0-9.,]*)*\s*(الف|ألف|ك|k|آلاف|الاف)?(?![0-9])/i, ' ')
    .replace(/(^|\s)\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?(?=\s|$)/g, ' ')
    .split(/\s+/).filter(function (w) { var n = normAr(w); return w && STOP.indexOf(n) < 0 && accWords.indexOf(n.replace(/^(ال|بال|لل)/, '')) < 0; }).join(' ').trim();
  return { kind: kind, amount: amount, cat: best ? best.id : '', acc: acc || D.settings.defAcc || (D.accounts[0] && D.accounts[0].id) || '', date: date, note: note.slice(0, 120), guessed: guessed };
}
function bestAcc(D, txt) {
  var n = normAr(txt), best = null, bs = 0;
  D.accounts.forEach(function (a) { var s = matchScore(n, [a.name].concat(String(a.kw || '').split(/[,،]/))); if (s > bs) { bs = s; best = a; } });
  return best;
}

/* ---------- نصوص جاهزة للبوت والتقارير ---------- */
function monthReportText(D, c, today) {
  var cd = cycleDayOf(D), s = summarize(D, c.start, c.end), L = [];
  L.push('📊 ' + cycleName(c, cd) + (cd > 1 ? ' (' + cycleLabel(c, cd) + ')' : ''));
  L.push('💰 الدخل: ' + fmtMoney(s.inc));
  L.push('🧾 المصروف: ' + fmtMoney(s.exp));
  L.push((s.net >= 0 ? '✅ فاضل: ' : '⚠️ عجز: ') + fmtMoney(Math.abs(s.net)) + (s.rate !== null ? ' (ادخار ' + s.rate + '%)' : ''));
  if (s.save) L.push('🎯 اتحط في الأهداف: ' + fmtMoney(s.save));
  var top = Object.keys(s.byCat).map(function (k) { return [k, s.byCat[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
  if (top.length) { L.push(''); L.push('أكتر حاجات صرفت عليها:'); top.forEach(function (x) { var k = catOf(D, x[0]); L.push('• ' + k.icon + ' ' + k.name + ': ' + fmtMoney(x[1]) + (s.exp ? ' (' + Math.round(x[1] / s.exp * 100) + '%)' : '')); }); }
  return L.join('\n');
}
function forecastText(D, today) {
  var cd = cycleDayOf(D), nx = cycleShift(cycleOf(today, cd), 1, cd), f = forecastCycle(D, nx, today), L = [];
  L.push('🔮 توقع ' + cycleName(nx, cd));
  L.push('💰 الدخل المتوقع: ' + fmtMoney(f.inc) + (f.varInc ? ' (منه ' + fmtMoney(f.varInc) + ' مش ثابت)' : ''));
  L.push('🧾 المصروف المتوقع: ' + fmtMoney(f.exp) + ' (بين ' + fmtMoney(f.lo) + ' و ' + fmtMoney(f.hi) + ')');
  L.push('   ثابت ' + fmtMoney(f.fixedExp) + ' + متغير ' + fmtMoney(f.varExp));
  L.push((f.net >= 0 ? '✅ هيفضل حوالي: ' : '⚠️ عجز متوقع: ') + fmtMoney(Math.abs(f.net)));
  if (f.goals) L.push('🎯 محتاج تحط ' + fmtMoney(f.goals) + ' للأهداف');
  if (!f.basis) L.push('ℹ️ لسه مفيش شهر كامل متسجل — التوقع ده من الميزانية.');
  var big = f.dues.filter(function (x) { return x.rec.kind !== 'inc'; }).slice(0, 6);
  if (big.length) { L.push(''); L.push('التزامات الشهر ده:'); big.forEach(function (x) { L.push('• ' + dsp(x.due) + ' — ' + x.rec.name + ': ' + fmtMoney(x.rec.amount)); }); }
  return L.join('\n');
}
