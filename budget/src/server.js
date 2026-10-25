/* ================= سكربت جوجل — ميزانية Hassan =================
   مشروع جديد ولوحده: مش بيلمس أي مشروع أو ملف تاني غير الفولدر اللي هو عامله لنفسه.
   - البيانات: ملف JSON واحد في فولدر «ميزانية Hassan (بيانات)» في درايف + نسخة احتياطية كل يوم (آخر 30).
   - البرنامج على الموبايل بيكلم السكربت بـ POST فيه op + key (كود الربط).
   - بوت التليجرام بيكلم نفس الرابط ومعاه ?tg=سر — والرد عليه HtmlService عشان التليجرام مايشوفش 302.
   - مؤقت كل ساعة (tick) بيبعت التنبيهات والتقارير في مواعيدها بتوقيت القاهرة.

   أول مرة: شغّل setup() من المحرر ← انشر Web app (Execute as: Me — Who has access: Anyone)
   ← شغّل linkCode() وخد «كود الربط» من السجل وحطه في البرنامج. */

var TZ = 'Africa/Cairo';
var APP_NAME = 'ميزانية Hassan';
var P = PropertiesService.getScriptProperties();

function todayCairo() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function hourCairo() { return +Utilities.formatDate(new Date(), TZ, 'H'); }
function nowCairo() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss"); }

/* ================= أول تشغيل ================= */
function setup() {
  folder_(); dataFile_();
  if (!P.getProperty('KEY')) P.setProperty('KEY', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8));
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'tick'; });
  if (!has) ScriptApp.newTrigger('tick').timeBased().everyHours(1).create();
  Logger.log('اتعمل ✓ — دلوقتي انشر Web app وبعدين شغّل linkCode()');
}
function linkCode() {
  var url = ScriptApp.getService().getUrl();
  if (/\/dev$/.test(url)) Logger.log('⚠ الرابط اللي تحت آخره /dev (رابط التجربة). استخدم بداله رابط /exec من Deploy ← Manage deployments، وحط بعده نفس الـ # والحروف.');
  Logger.log('كود الربط (انسخه كله وحطه في البرنامج):\n' + url + '#' + P.getProperty('KEY'));
}

/* ================= التخزين ================= */
function folder_() {
  var id = P.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  var f = DriveApp.createFolder(APP_NAME + ' (بيانات)');
  f.setDescription('بيانات برنامج ميزانية Hassan — ماتمسحش الفولدر ده.');
  P.setProperty('FOLDER_ID', f.getId());
  return f;
}
function dataFile_() {
  var id = P.getProperty('DATA_ID');
  if (id) { try { return DriveApp.getFileById(id); } catch (e) { } }
  var D = ensureShape(defaultState());
  var file = folder_().createFile('budget-data.json', JSON.stringify(D), 'application/json');
  P.setProperty('DATA_ID', file.getId());
  return file;
}
function load_() {
  var D;
  try { D = JSON.parse(dataFile_().getBlob().getDataAsString('UTF-8')); } catch (e) { throw new Error('ملف البيانات مش مقروء: ' + e.message); }
  D = ensureShape(D);
  D.meta.seen = D.meta.seen || [];
  return D;
}
function save_(D) {
  D.meta.rev = (D.meta.rev || 0) + 1;
  D.meta.savedAt = nowCairo();
  if (D.meta.seen.length > 2500) D.meta.seen = D.meta.seen.slice(-2000);
  dataFile_().setContent(JSON.stringify(D));
}
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function backup_() {
  var f = folder_(), name = 'نسخة-' + todayCairo() + '.json';
  var it = f.getFilesByName(name); if (it.hasNext()) return;
  dataFile_().makeCopy(name, f);
  // نحتفظ بآخر 30 نسخة بس (النسخ القديمة بتروح سلة درايف، مش مسح نهائي)
  var all = [], files = f.getFiles();
  while (files.hasNext()) { var x = files.next(); if (/^نسخة-\d{4}-\d{2}-\d{2}\.json$/.test(x.getName())) all.push(x); }
  all.sort(function (a, b) { return a.getName() < b.getName() ? 1 : -1; });
  all.slice(30).forEach(function (x) { x.setTrashed(true); });
}

/* ================= الويب ================= */
function doGet() {
  return HtmlService.createHtmlOutput('<div dir="rtl" style="font-family:Tahoma;padding:30px;text-align:center">سكربت <b>' + APP_NAME + '</b> شغال ✓<br><small>افتح البرنامج نفسه من الموبايل.</small></div>').setTitle(APP_NAME);
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doPost(e) {
  if (e && e.parameter && e.parameter.tg) {
    try { tgWebhook_(e); } catch (err) { logErr_('tg', err); }
    return HtmlService.createHtmlOutput('ok');
  }
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, code: 'bad', error: 'طلب مش مفهوم' }); }
  var key = P.getProperty('KEY');
  if (!key || String(req.key || '') !== key) return json_({ ok: false, code: 'key', error: 'كود الربط غلط' });
  try { return json_(Object.assign({ ok: true }, handle_(req))); }
  catch (err) { logErr_(req.op, err); return json_({ ok: false, code: 'script', error: String(err && err.message || err) }); }
}
function logErr_(where, err) {
  try {
    var L = JSON.parse(P.getProperty('ERRS') || '[]');
    L.unshift({ at: nowCairo(), where: where, msg: String(err && err.message || err).slice(0, 300) });
    P.setProperty('ERRS', JSON.stringify(L.slice(0, 25)));
  } catch (e) { }
}

function handle_(req) {
  var op = req.op;
  if (op === 'ping') {
    var D0 = load_();
    return { rev: D0.meta.rev, hasData: D0.tx.length > 0, tg: tgInfo_(), at: nowCairo() };
  }
  if (op === 'pull') {
    var D1 = load_();
    if (req.have && +req.have === D1.meta.rev) return { rev: D1.meta.rev, same: true };
    return { rev: D1.meta.rev, data: strip_(D1) };
  }
  if (op === 'push') return withLock_(function () { return push_(req); });
  if (op === 'init') return withLock_(function () {
    var D = load_();
    if (D.tx.length && !req.force) return { refused: true, rev: D.meta.rev, data: strip_(D) };
    var N = ensureShape(req.data || {}); N.meta = { rev: D.meta.rev, seen: [], created: D.meta.created || nowCairo() };
    save_(N); return { rev: N.meta.rev };
  });
  if (op === 'tg_setup') return tgSetup_(req);
  if (op === 'tg_status') return { tg: tgInfo_(true) };
  if (op === 'tg_pair') { var code = String(Math.floor(100000 + Math.random() * 900000)); P.setProperty('TG_PAIR', code + '|' + (Date.now() + 30 * 60000)); return { pair: code, tg: tgInfo_() }; }
  if (op === 'tg_test') { var r = tgSend_('✅ البوت شغال ومربوط بـ «' + APP_NAME + '».\nابعت مثلاً: 150 بنزين'); return { sent: !!(r && r.ok) }; }
  if (op === 'tg_unlink') { P.deleteProperty('TG_CHAT'); return { tg: tgInfo_() }; }
  if (op === 'export_sheet') return { url: exportSheet_() };
  if (op === 'errors') return { errors: JSON.parse(P.getProperty('ERRS') || '[]') };
  throw new Error('عملية مش معروفة: ' + op);
}
function strip_(D) { var c = JSON.parse(JSON.stringify(D)); delete c.meta.seen; return c; }

/* العمليات من البرنامج: كل عملية ليها id — لو اتبعتت مرتين بتتسجل مرة واحدة */
function push_(req) {
  var D = load_(), before = D.meta.rev, seen = {}, applied = [], changed = false, newTx = [];
  D.meta.seen.forEach(function (id) { seen[id] = 1; });
  (req.ops || []).forEach(function (op) {
    if (!op || !op.oid) return;
    if (seen[op.oid]) { applied.push(op.oid); return; }
    var had = op.col === 'tx' && op.act === 'put' && op.item ? byId(D.tx, op.item.id) : null;
    if (applyOp(D, op)) { changed = true; if (op.col === 'tx' && op.act === 'put' && !had) newTx.push(op.item); }
    D.meta.seen.push(op.oid); seen[op.oid] = 1; applied.push(op.oid);
  });
  if (changed) save_(D);
  try { if (newTx.length) instantAlerts_(D, newTx); } catch (e) { logErr_('alerts', e); }
  var out = { rev: D.meta.rev, applied: applied };
  if (+req.have !== before) out.data = strip_(D);     // فيه تغييرات من مكان تاني (البوت مثلاً)
  return out;
}

/* ================= التليجرام ================= */
function tg_(method, payload) {
  var token = P.getProperty('TG_TOKEN'); if (!token) return null;
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + method, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload || {}), muteHttpExceptions: true });
  try { return JSON.parse(r.getContentText()); } catch (e) { return { ok: false }; }
}
function tgSend_(text, extra) {
  var chat = P.getProperty('TG_CHAT'); if (!chat || !P.getProperty('TG_TOKEN')) return null;
  return tg_('sendMessage', Object.assign({ chat_id: chat, text: String(text).slice(0, 4000), disable_web_page_preview: true }, extra || {}));
}
function tgInfo_(deep) {
  var o = { token: !!P.getProperty('TG_TOKEN'), linked: !!P.getProperty('TG_CHAT'), bot: P.getProperty('TG_BOT') || '' };
  if (deep && o.token) { var w = tg_('getWebhookInfo'); if (w && w.ok) o.hook = { url: !!w.result.url, pending: w.result.pending_update_count, err: w.result.last_error_message || '' }; }
  return o;
}
function tgSetup_(req) {
  var token = String(req.token || '').trim();
  if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(token)) throw new Error('توكن البوت شكله غلط — انسخه كامل من BotFather');
  var url = String(req.url || '').trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) url = ScriptApp.getService().getUrl();
  var me = JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getMe', { muteHttpExceptions: true }).getContentText());
  if (!me.ok) throw new Error('التليجرام رفض التوكن ده — اتأكد إنه صح');
  var secret = Utilities.getUuid().replace(/-/g, '');
  P.setProperties({ TG_TOKEN: token, TG_SECRET: secret, TG_BOT: me.result.username });
  var hook = tg_('setWebhook', { url: url + '?tg=' + secret, drop_pending_updates: true, allowed_updates: ['message', 'callback_query'] });
  if (!hook || !hook.ok) throw new Error('ماعرفتش أربط البوت: ' + (hook && hook.description || 'رد غلط'));
  tg_('setMyCommands', { commands: [
    { command: 'today', description: 'مصروف النهارده' }, { command: 'month', description: 'ملخص الشهر' },
    { command: 'budget', description: 'الميزانية' }, { command: 'balance', description: 'الأرصدة' },
    { command: 'forecast', description: 'توقع الشهر الجاي' }, { command: 'bills', description: 'الالتزامات الجاية' },
    { command: 'last', description: 'آخر الحركات' }, { command: 'undo', description: 'امسح آخر حركة' }, { command: 'help', description: 'إزاي أستخدم البوت' }] });
  var code = String(Math.floor(100000 + Math.random() * 900000));
  P.setProperty('TG_PAIR', code + '|' + (Date.now() + 30 * 60000));
  return { pair: code, tg: tgInfo_() };
}
function tgWebhook_(e) {
  var sec = P.getProperty('TG_SECRET');
  if (!sec || e.parameter.tg !== sec) return;
  var u = JSON.parse(e.postData.contents || '{}');
  // نفس التحديث ممكن ييجي مرتين — بنتجاهل المكرر
  var cache = CacheService.getScriptCache(), k = 'u' + u.update_id;
  if (cache.get(k)) return; cache.put(k, '1', 21600);
  var last = +(P.getProperty('TG_LAST') || 0); if (u.update_id && u.update_id <= last) return;
  P.setProperty('TG_LAST', String(u.update_id || last));

  var chat = P.getProperty('TG_CHAT');
  if (u.callback_query) {
    var q = u.callback_query;
    if (String(q.message.chat.id) !== chat) return;
    return withLock_(function () { tgCallback_(q); });
  }
  var m = u.message; if (!m || !m.chat) return;
  var text = String(m.text || '').trim(), from = String(m.chat.id);
  if (from !== chat) {
    var pr = (P.getProperty('TG_PAIR') || '').split('|');
    var got = toEnDigits(text).replace(/\D/g, '');
    if (pr[0] && got === pr[0] && Date.now() < +pr[1]) {
      P.setProperty('TG_CHAT', from); P.deleteProperty('TG_PAIR');
      tgSend_('أهلاً 👋 البوت اتربط بـ «' + APP_NAME + '» ✓\n\n' + helpText_());
    } else {
      tg_('sendMessage', { chat_id: from, text: chat ? 'البوت ده خاص.' : 'ابعت كود الربط اللي ظاهر في البرنامج (الإعدادات ← التليجرام).' });
    }
    return;
  }
  if (!text) { tgSend_('ابعت المبلغ والبند كتابة، مثلاً: 150 بنزين'); return; }
  withLock_(function () { tgText_(text); });
}
function helpText_() {
  return ['سجّل أي مصروف أو دخل برسالة عادية:',
    '• 150 بنزين',
    '• صرفت 2 الف ايجار من البنك',
    '• 85+40 اكل امبارح',
    '• +12000 مرتب   أو   قبضت 12000',
    '• حولت 500 من الكاش للبنك',
    '',
    'وفيه أوامر:',
    '/today النهارده — /month الشهر — /budget الميزانية',
    '/balance الرصيد — /forecast توقع الشهر الجاي',
    '/bills الالتزامات — /last آخر الحركات — /undo تراجع'].join('\n');
}
function tgText_(text) {
  var D = load_(), today = todayCairo(), cd = cycleDayOf(D), c = cycleOf(today, cd), t = normAr(text).replace(/^\//, '').split('@')[0];
  var cmd = { start: 'help', help: 'help', 'مساعده': 'help', today: 'today', 'النهارده': 'today', 'انهارده': 'today', month: 'month', 'الشهر': 'month', budget: 'budget', 'الميزانيه': 'budget', 'ميزانيه': 'budget',
    balance: 'balance', 'الرصيد': 'balance', 'رصيد': 'balance', 'الارصده': 'balance', forecast: 'forecast', 'توقع': 'forecast', 'التوقع': 'forecast', bills: 'bills', 'الالتزامات': 'bills', 'التزامات': 'bills',
    last: 'last', 'اخر': 'last', 'اخر الحركات': 'last', undo: 'undo', 'تراجع': 'undo', 'الغي': 'undo' }[t];
  if (cmd === 'help') return tgSend_(helpText_());
  if (cmd === 'today') {
    var L = txIn(D, today, today), s = summarize(D, today, today);
    if (!L.length) return tgSend_('لسه مفيش حركات النهارده.\n' + spendLine_(D, today));
    return tgSend_(['🗓 النهارده ' + dsp(today), ''].concat(L.map(txLine_.bind(null, D))).concat(['', '🧾 المصروف: ' + fmtMoney(s.exp) + (s.inc ? ' — 💰 الدخل: ' + fmtMoney(s.inc) : ''), spendLine_(D, today)]).join('\n'));
  }
  if (cmd === 'month') { var p = projectCurrent(D, today); return tgSend_(monthReportText(D, c, today) + '\n\n🔭 على المعدل ده آخر الدورة: مصروف ~' + fmtMoney(p.expEnd) + ' ودخل ' + fmtMoney(p.incEnd) + '\n' + spendLine_(D, today)); }
  if (cmd === 'budget') {
    var rows = budgetRows(D, c).filter(function (r) { return r.budget > 0 || r.spent > 0; });
    if (!rows.length) return tgSend_('لسه مفيش ميزانية متحددة — حددها من البرنامج (شاشة الميزانية).');
    return tgSend_(['🎯 ميزانية ' + cycleName(c, cd), ''].concat(rows.map(function (r) {
      return (r.budget ? (r.spent > r.budget ? '🔴' : r.pct >= 80 ? '🟠' : '🟢') : '⚪') + ' ' + r.cat.name + ': ' + fmtMoney(r.spent) + (r.budget ? ' من ' + fmtMoney(r.budget) + ' (' + r.pct + '%)' : '');
    })).concat(['', spendLine_(D, today)]).join('\n'));
  }
  if (cmd === 'balance') {
    var b = balances(D, today), tot = 0, gl = [];
    var lines = D.accounts.filter(function (a) { return !a.archived; }).map(function (a) { tot += b[a.id] || 0; return a.icon + ' ' + a.name + ': ' + fmtMoney(b[a.id] || 0); });
    D.goals.forEach(function (g) { var sv = goalSaved(D, g.id); if (sv) gl.push('🎯 ' + g.name + ': ' + fmtMoney(sv) + ' من ' + fmtMoney(g.target)); });
    return tgSend_(['🏦 الأرصدة', ''].concat(lines).concat(['', 'الإجمالي: ' + fmtMoney(tot)]).concat(gl.length ? [''].concat(gl) : []).join('\n'));
  }
  if (cmd === 'forecast') return tgSend_(forecastText(D, today));
  if (cmd === 'bills') {
    var dl = dueList(D, addDays(today, -15), addDays(today, 30)).filter(function (x) { return !x.paid; });
    if (!dl.length) return tgSend_('مفيش التزامات أو دخل متوقع في الشهر الجاي ✓');
    return tgSend_(['📅 الجاي (والمتأخر)', ''].concat(dl.map(function (x) { var n = daysBetween(today, x.due); return (x.rec.kind === 'inc' ? '💼 ' : n < 0 ? '🔴 ' : '📌 ') + dsp(x.due) + ' — ' + x.rec.name + ': ' + fmtMoney(x.rec.amount) + (n < 0 ? ' (متأخر)' : n === 0 ? ' (النهارده)' : ''); })).join('\n'));
  }
  if (cmd === 'last') {
    var lt = D.tx.slice().sort(function (a, b) { return (b.at || '') < (a.at || '') ? -1 : 1; }).slice(0, 8);
    return tgSend_(lt.length ? ['آخر الحركات:', ''].concat(lt.map(function (x) { return dsp(x.date) + ' — ' + txLine_(D, x); })).join('\n') : 'مفيش حركات لسه.');
  }
  if (cmd === 'undo') {
    var mine = D.tx.filter(function (x) { return x.via === 'telegram'; }).sort(function (a, b) { return (b.at || '') < (a.at || '') ? -1 : 1; })[0];
    if (!mine) return tgSend_('مفيش حركة من البوت أرجع فيها.');
    applyOp(D, { act: 'del', col: 'tx', id: mine.id, at: nowCairo() }); save_(D);
    return tgSend_('↩ اتشالت: ' + txLine_(D, mine) + '\n(موجودة في سلة المحذوفات في البرنامج لو عايز ترجعها)');
  }
  var r = parseBotText(D, text, today);
  if (!r) return tgSend_('مافهمتش 🙏 ابعت المبلغ والبند، مثلاً:\n150 بنزين\nأو /help');
  var tx = { id: uid('t'), date: r.date, kind: r.kind, amount: r.amount, cat: r.cat, acc: r.acc, to: r.to || '', note: r.note, via: 'telegram', at: nowCairo(), u: Date.now() };
  applyOp(D, { act: 'put', col: 'tx', item: tx }); save_(D);
  var reply = ['✅ اتسجل: ' + txLine_(D, tx) + (r.date !== today ? ' — بتاريخ ' + dsp(r.date) : '')];
  if (tx.kind === 'exp') {
    var br = budgetRows(D, cycleOf(tx.date, cd)).filter(function (x) { return x.cat.id === tx.cat; })[0];
    if (br && br.budget) reply.push((br.spent > br.budget ? '🔴 عدّيت ميزانية ' : br.pct >= 80 ? '🟠 ' : '🟢 ') + br.cat.name + ': ' + fmtMoney(br.spent) + ' من ' + fmtMoney(br.budget) + (br.spent > br.budget ? '' : ' — فاضل ' + fmtMoney(br.left)));
    if (isUnusual(D, tx)) reply.push('👀 المبلغ ده أكبر بكتير من المعتاد في القسم ده.');
    reply.push(spendLine_(D, today));
  }
  if (r.guessed) reply.push('', '❔ مالقيتش القسم — اختار من «غيّر القسم».');
  tgSend_(reply.join('\n'), { reply_markup: txKeyboard_(tx) });
}
function txKeyboard_(tx) {
  var row = [{ text: '↩ تراجع', callback_data: 'u:' + tx.id }];
  if (tx.kind !== 'xfer') row.push({ text: '🏷 غيّر القسم', callback_data: 'cc:' + tx.id }, { text: '🏦 الحساب', callback_data: 'ca:' + tx.id });
  return { inline_keyboard: [row] };
}
function txLine_(D, t) {
  if (t.kind === 'adj') return '⚖️ تسوية رصيد ' + fmtMoney(t.amount) + ' (' + accOf(D, t.acc).name + ')';
  if (t.kind === 'xfer') return '🔁 تحويل ' + fmtMoney(t.amount) + ' من ' + accOf(D, t.acc).name + ' لـ ' + accOf(D, t.to).name;
  var k = catOf(D, t.cat);
  return (t.kind === 'inc' ? '💰 +' : t.kind === 'save' ? '🎯 ' : '') + fmtMoney(t.amount) + ' — ' + k.icon + ' ' + k.name + ' (' + accOf(D, t.acc).name + ')' + (t.note && normAr(t.note) !== normAr(k.name) ? ' · ' + t.note : '');
}
function spendLine_(D, today) {
  var s = safeToSpend(D, today);
  if (!D.tx.length || s.avail === null) return '';
  return s.avail > 0 ? '💡 تقدر تصرف حوالي ' + fmtMoney(s.perDay) + ' في اليوم لحد ' + dsp(s.p.c.end) : '⚠️ المتاح لآخر الدورة خلص (' + fmtMoney(s.avail) + ')';
}
function tgCallback_(q) {
  var D = load_(), parts = String(q.data || '').split(':'), act = parts[0], tx = byId(D.tx, parts[1]);
  var mid = q.message.message_id, chat = q.message.chat.id;
  function done(note, text, kb) {
    tg_('answerCallbackQuery', { callback_query_id: q.id, text: note || '' });
    if (text) tg_('editMessageText', Object.assign({ chat_id: chat, message_id: mid, text: text }, kb ? { reply_markup: kb } : {}));
  }
  if (!tx) return done('الحركة دي مش موجودة (يمكن اتمسحت)');
  if (act === 'u') { applyOp(D, { act: 'del', col: 'tx', id: tx.id, at: nowCairo() }); save_(D); return done('اتشالت', '↩ اتشالت: ' + txLine_(D, tx)); }
  if (act === 'cc' || act === 'ca') {
    var items = act === 'cc' ? D.cats.filter(function (c) { return c.kind === tx.kind && !c.archived; }) : D.accounts.filter(function (a) { return !a.archived; });
    var kb = [], row = [];
    items.forEach(function (x) { row.push({ text: x.icon + ' ' + x.name, callback_data: (act === 'cc' ? 'sc:' : 'sa:') + tx.id + ':' + x.id }); if (row.length === 2) { kb.push(row); row = []; } });
    if (row.length) kb.push(row);
    return done('', 'اختار ' + (act === 'cc' ? 'القسم' : 'الحساب') + ' لـ ' + fmtMoney(tx.amount) + ':', { inline_keyboard: kb });
  }
  if (act === 'sc' || act === 'sa') {
    var n = JSON.parse(JSON.stringify(tx)); if (act === 'sc') n.cat = parts[2]; else n.acc = parts[2]; n.u = Date.now();
    applyOp(D, { act: 'put', col: 'tx', item: n }); save_(D);
    return done('اتعدّلت ✓', '✅ اتسجل: ' + txLine_(D, n), txKeyboard_(n));
  }
  done();
}

/* ================= التنبيهات ================= */
function once_(key, fn) {
  var S = JSON.parse(P.getProperty('SENT') || '{}');
  if (S[key]) return false;
  var r = fn();
  if (r === false) return false;
  S[key] = todayCairo();
  var lim = addDays(todayCairo(), -45);
  Object.keys(S).forEach(function (k) { if (S[k] < lim) delete S[k]; });
  P.setProperty('SENT', JSON.stringify(S));
  return true;
}
function instantAlerts_(D, newTx) {
  if (!P.getProperty('TG_CHAT')) return;
  var A = D.settings.alerts, today = todayCairo(), cd = cycleDayOf(D), c = cycleOf(today, cd), msgs = [];
  newTx.forEach(function (t) {
    if (t.kind !== 'exp' || t.via === 'telegram' || t.date < c.start) return;
    if (A.budget) {
      var r = budgetRows(D, c).filter(function (x) { return x.cat.id === t.cat; })[0];
      if (r && r.budget > 0) {
        if (r.spent > r.budget) once_('b100_' + c.key + r.cat.id, function () { msgs.push('🔴 عدّيت ميزانية ' + r.cat.icon + ' ' + r.cat.name + ': ' + fmtMoney(r.spent) + ' من ' + fmtMoney(r.budget)); });
        else if (r.pct >= 80) once_('b80_' + c.key + r.cat.id, function () { msgs.push('🟠 ' + r.cat.icon + ' ' + r.cat.name + ': صرفت ' + r.pct + '% من الميزانية — فاضل ' + fmtMoney(r.left)); });
      }
    }
    if (A.unusual && isUnusual(D, t)) msgs.push('👀 مصروف كبير مش معتاد: ' + txLine_(D, t));
  });
  if (msgs.length) tgSend_(msgs.join('\n'));
}
/* بتشتغل كل ساعة */
function tick() {
  var D; try { D = load_(); } catch (e) { logErr_('tick', e); return; }
  var today = todayCairo(), h = hourCairo(), A = D.settings.alerts, cd = cycleDayOf(D), c = cycleOf(today, cd);
  // ١) الالتزامات اللي «بتتدفع لوحدها» (خصم تلقائي) بتتسجل في ميعادها
  try { autoRecurring_(today); } catch (e) { logErr_('auto', e); }
  if (h === 3) once_('bk' + today, function () { backup_(); });
  if (!P.getProperty('TG_CHAT')) return;
  var morning = +A.morning || 9, evening = +A.evening || 21;
  if (h === morning && A.bills) once_('m' + today, function () {
    var al = alertsFor(D, today).filter(function (a) { return !/^(near|over)_/.test(a.key); });
    if (!al.length) return false;
    tgSend_(['☀️ صباح الخير — حاجات محتاجة انتباهك:', ''].concat(al.map(function (a) { return a.txt; })).join('\n'));
  });
  if (h === morning && A.monthly && today === c.start) once_('mo' + c.key, function () {
    var prev = cycleShift(c, -1, cd);
    tgSend_('📅 بداية ' + cycleName(c, cd) + '\n\nملخص اللي فات:\n' + monthReportText(D, prev, today) + '\n\n' + forecastText(D, addDays(today, -1)));
  });
  if (h === morning + 1 && A.weekly && d2(today).getUTCDay() === 5) once_('w' + today, function () {
    var from = addDays(today, -7), s = summarize(D, from, addDays(today, -1)), p = projectCurrent(D, today);
    if (!s.n) return false;
    tgSend_(['🗓 ملخص الأسبوع (' + dsp(from) + ' ← ' + dsp(addDays(today, -1)) + ')', '🧾 صرفت ' + fmtMoney(s.exp) + (s.inc ? ' — 💰 دخل ' + fmtMoney(s.inc) : ''),
      'الدورة لحد دلوقتي: ' + fmtMoney(p.s.exp) + ' من ميزانية ' + fmtMoney(totalBudget(D)), spendLine_(D, today)].join('\n'));
  });
  if (h === evening && A.daily) once_('e' + today, function () {
    var L = txIn(D, today, today).filter(function (t) { return t.kind === 'exp'; }), s = summarize(D, today, today), p = projectCurrent(D, today), bud = totalBudget(D);
    var msg = ['🌙 مصروف النهارده: ' + fmtMoney(s.exp) + (L.length ? ' (' + L.length + ' حركة)' : ' — ماسجلتش حاجة النهارده، لو صرفت ابعتها هنا')];
    msg.push('📊 ' + cycleName(c, cd) + ': صرفت ' + fmtMoney(p.s.exp) + (bud ? ' من ' + fmtMoney(bud) + ' (' + Math.round(p.s.exp / bud * 100) + '%)' : '') + ' — فاضل ' + p.left + ' يوم');
    msg.push(spendLine_(D, today));
    tgSend_(msg.join('\n'));
  });
}
function autoRecurring_(today) {
  withLock_(function () {
    var D = load_(), changed = [];
    D.rec.forEach(function (r) {
      if (!r.auto || r.active === false) return;
      recOccurrences(r, addDays(today, -7), today).forEach(function (due) {
        if (recPaid(D, r, due)) return;
        var t = { id: uid('t'), date: due, kind: r.kind, amount: r2(r.amount), cat: r.cat, acc: r.acc || D.settings.defAcc, rec: r.id, due: due, note: r.name + ' (تلقائي)', via: 'auto', at: nowCairo(), u: Date.now() };
        applyOp(D, { act: 'put', col: 'tx', item: t }); changed.push(t);
      });
    });
    if (changed.length) {
      save_(D);
      tgSend_('🔁 اتسجل تلقائي:\n' + changed.map(function (t) { return '• ' + txLine_(D, t); }).join('\n'));
    }
  });
}

/* ================= تصدير لشيت جوجل ================= */
function exportSheet_() {
  var D = load_(), id = P.getProperty('SHEET_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create(APP_NAME + ' — تصدير'); P.setProperty('SHEET_ID', ss.getId()); DriveApp.getFileById(ss.getId()).moveTo(folder_()); }
  ss.setSpreadsheetLocale('ar_EG');
  function sheet(name) { var sh = ss.getSheetByName(name) || ss.insertSheet(name); sh.clear(); sh.setRightToLeft(true); return sh; }
  var KIND = { exp: 'مصروف', inc: 'دخل', xfer: 'تحويل', save: 'للهدف', unsave: 'من الهدف', adj: 'تسوية رصيد' };
  var rows = [['التاريخ', 'النوع', 'المبلغ', 'القسم', 'الحساب', 'لحساب', 'ملاحظة', 'من']];
  D.tx.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).forEach(function (t) {
    rows.push([t.date, KIND[t.kind] || t.kind, r2(t.amount), t.cat ? catOf(D, t.cat).name : '', accOf(D, t.acc).name, t.to ? accOf(D, t.to).name : '', t.note || '', t.via === 'telegram' ? 'تليجرام' : t.via === 'auto' ? 'تلقائي' : 'البرنامج']);
  });
  var sh = sheet('الحركات'); sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sh.getRange(1, 1, 1, rows[0].length).setFontWeight('bold').setBackground('#1B3A5C').setFontColor('#ffffff'); sh.setFrozenRows(1);
  if (rows.length > 1) sh.getRange(2, 3, rows.length - 1, 1).setNumberFormat('#,##0.##');
  // ملخص الشهور
  var cd = cycleDayOf(D), cur = cycleOf(todayCairo(), cd), expCats = D.cats.filter(function (k) { return k.kind === 'exp'; });
  var hdr = ['الشهر', 'الدخل', 'المصروف', 'الفرق', 'نسبة الادخار'].concat(expCats.map(function (k) { return k.name; }));
  var mrows = [hdr];
  for (var i = 0; i < 24; i++) {
    var c = cycleShift(cur, -i, cd), s = summarize(D, c.start, c.end);
    if (!s.n && i > 0) continue;
    mrows.push([cycleName(c, cd), s.inc, s.exp, s.net, s.rate === null ? '' : s.rate / 100].concat(expCats.map(function (k) { return s.byCat[k.id] || 0; })));
  }
  var ms = sheet('الشهور'); ms.getRange(1, 1, mrows.length, hdr.length).setValues(mrows);
  ms.getRange(1, 1, 1, hdr.length).setFontWeight('bold').setBackground('#1B3A5C').setFontColor('#ffffff'); ms.setFrozenRows(1); ms.setFrozenColumns(1);
  if (mrows.length > 1) { ms.getRange(2, 2, mrows.length - 1, hdr.length - 1).setNumberFormat('#,##0'); ms.getRange(2, 5, mrows.length - 1, 1).setNumberFormat('0%'); }
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('ورقة1'); if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  return ss.getUrl();
}
