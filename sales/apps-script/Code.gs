/* ================= سكربت جوجل — مبيعات الطنطاوي =================
   مشروع جديد ولوحده: مش بيلمس أي مشروع أو ملف تاني غير الفولدر اللي هو عامله لنفسه
   («مبيعات الطنطاوي (بيانات)» في درايف).

   الفكرة (زي العهدة والأقساط):
   - برنامج اللاب هو الأصل. كل دقيقة بيبعت نسخة (snap.json) ويسحب اللي اتسجل من الموبايل.
   - الموبايل بيشوف النسخة دي، وبيسجل الجديد في «صندوق الوارد» (inbox.json) لحد ما اللاب يدخّله.
   - كل طلب لازم يكون معاه key (كود الربط). والموبايل كمان لازم كلمة السر اللي اتعملت على اللاب
     (السكربت شايل بصمتها بس، مش كلمة السر نفسها).

   أول مرة: شغّل setup() ← Deploy ← New deployment ← Web app (Execute as: Me — Who has access: Anyone)
   ← شغّل linkCode() وخد «كود الربط» من السجل وحطه في البرنامج على اللاب (الإعدادات ← الربط).
   بعد أي تعديل هنا: Deploy ← Manage deployments ← ✎ ← Version: New version (عشان الرابط يفضل زي ما هو). */

var APP_NAME = 'مبيعات الطنطاوي';
var VER = '1.0';
var TZ = 'Africa/Cairo';
var MOBILE_PAGE = 'https://hassaneltantawy10.github.io/tantawy-mobile/sales/';
var P = PropertiesService.getScriptProperties();

/* ================= أول تشغيل ================= */
function setup() {
  folder_();
  if (!P.getProperty('KEY')) P.setProperty('KEY', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8));
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'dailyBackup'; });
  if (!has) ScriptApp.newTrigger('dailyBackup').timeBased().everyDays(1).atHour(3).inTimezone(TZ).create();
  Logger.log('اتعمل ✓');
  linkCode();
}
function linkCode() {
  var url = ScriptApp.getService().getUrl();
  if (!url) { Logger.log('⚠ لسه ماتنشرش. Deploy ← New deployment ← Web app، وبعدين شغّل linkCode() تاني.'); return; }
  if (/\/dev$/.test(url)) Logger.log('⚠ الرابط آخره /dev (رابط التجربة). استخدم رابط /exec من Deploy ← Manage deployments.');
  Logger.log('كود الربط (سري — حطه في البرنامج على اللاب ← الإعدادات ← الربط):\n' + url + '#' + P.getProperty('KEY'));
}
function nowCairo() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss"); }

/* ================= التخزين ================= */
function folder_() {
  var id = P.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  var f = DriveApp.createFolder(APP_NAME + ' (بيانات)');
  f.setDescription('بيانات مبيعات الطنطاوي للموبايل — نسخة من اللاب + اللي اتسجل من الموبايل. ماتمسحش الفولدر ده.');
  P.setProperty('FOLDER_ID', f.getId());
  return f;
}
function file_(name, create) {
  var pk = 'F_' + name, id = P.getProperty(pk);
  if (id) { try { var f = DriveApp.getFileById(id); if (!f.isTrashed()) return f; } catch (e) { } }
  var it = folder_().getFilesByName(name);
  if (it.hasNext()) { var g = it.next(); P.setProperty(pk, g.getId()); return g; }
  if (!create) return null;
  var n = folder_().createFile(name, '', 'application/json');
  P.setProperty(pk, n.getId());
  return n;
}
function readText_(name) { var f = file_(name, false); return f ? f.getBlob().getDataAsString('UTF-8') : ''; }
function writeText_(name, txt) { file_(name, true).setContent(txt); }
function readJson_(name, def) { var t = readText_(name); if (!t) return def; try { return JSON.parse(t); } catch (e) { throw new Error('الملف ' + name + ' مش مقروء: ' + e.message); } }
function writeJson_(name, obj) { writeText_(name, JSON.stringify(obj)); }
function inbox_() { var b = readJson_('inbox.json', null) || {}; b.items = b.items || []; b.done = b.done || {}; return b; }

function dailyBackup() {
  var day = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var bf = folder_().getFoldersByName('نسخ احتياطية');
  var dir = bf.hasNext() ? bf.next() : folder_().createFolder('نسخ احتياطية');
  ['inbox.json', 'snap.json'].forEach(function (n) {
    var t = readText_(n); if (!t) return;
    var name = day + ' ' + n;
    if (!dir.getFilesByName(name).hasNext()) dir.createFile(name, t, 'application/json');
  });
  var all = []; var it = dir.getFiles(); while (it.hasNext()) all.push(it.next());
  all.sort(function (a, b) { return a.getName() < b.getName() ? -1 : 1; });
  while (all.length > 60) all.shift().setTrashed(true);
}

/* ================= الطلبات ================= */
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function sha_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function doGet() { return json_({ ok: true, app: 'tantawy-sales', ver: VER, msg: 'سكربت مبيعات الطنطاوي شغال ✓' }); }
function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, error: 'طلب مش مفهوم' }); }
  var key = P.getProperty('KEY');
  if (!key || b.key !== key) return json_({ ok: false, code: 'script', error: 'كود الربط غلط' });
  if (b.op !== 'lapSync' && b.op !== 'ping') {          // الموبايل لازم كلمة السر
    var h = P.getProperty('PW_HASH');
    if (!h) return json_({ ok: false, code: 'no_pw', error: 'لسه مفيش كلمة سر للموبايل — اعملها من البرنامج على اللاب' });
    if (sha_('tantawy-sales:' + String(b.pw || '')) !== h) { Utilities.sleep(700); return json_({ ok: false, code: 'pw', error: 'كلمة السر غلط' }); }
  }
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (x) { return json_({ ok: false, error: 'السكربت مشغول، جرّب كمان شوية' }); }
  try {
    var fn = OPS[b.op];
    if (!fn) return json_({ ok: false, error: 'عملية مش معروفة: ' + b.op });
    var r = fn(b) || {};
    r.ok = true; r.at = nowCairo(); r.ver = VER;
    return json_(r);
  } catch (x) {
    return json_({ ok: false, error: String(x && x.message || x) });
  } finally { lock.releaseLock(); }
}

var OPS = {
  ping: function () { return { app: 'tantawy-sales' }; },

  /* اللاب: يبعت النسخة (لو اتغيرت) + بصمة كلمة سر الموبايل + اللي دخّله أو رفضه، ويرجع اللي لسه مستني */
  lapSync: function (b) {
    if (b.pwHash) P.setProperty('PW_HASH', String(b.pwHash));
    var meta = readJson_('meta.json', null) || {};
    if (typeof b.snap === 'string' && b.snap) { writeText_('snap.json', b.snap); meta.hash = b.hash || ''; meta.snapAt = nowCairo(); }
    meta.lapAt = nowCairo();
    writeJson_('meta.json', meta);
    var box = inbox_(), now = nowCairo();
    (b.applied || []).forEach(function (id) { box.done[id] = now; });
    (b.rejected || []).forEach(function (r) { if (r && r.id) box.done[r.id] = now; });
    box.items = box.items.filter(function (it) { return !box.done[it.id]; });
    var ids = Object.keys(box.done); if (ids.length > 6000) ids.sort(function (a, c) { return box.done[a] < box.done[c] ? -1 : 1; }).slice(0, ids.length - 5000).forEach(function (k) { delete box.done[k]; });
    writeJson_('inbox.json', box);
    return { inbox: box.items };
  },

  /* الموبايل: النسخة (لو عنده قديمة) + اللي لسه في صندوق الوارد */
  mobGet: function (b) {
    var meta = readJson_('meta.json', null) || {};
    var res = { hash: meta.hash || '', snapAt: meta.snapAt || '', lapAt: meta.lapAt || '', inbox: inbox_().items.map(function (it) { return it.data; }) };
    if (b.hash !== meta.hash) res.snap = readText_('snap.json');
    return res;
  },

  /* الموبايل: يحط حاجات جديدة في صندوق الوارد (نفس الـ id مرتين = مرة واحدة) */
  mobPut: function (b) {
    var box = inbox_(), results = {};
    (b.entries || []).forEach(function (en) {
      var id = String(en && en.id || ''); if (!id) return;
      if (box.done[id]) { results[id] = 'applied'; return; }
      var i = -1; box.items.forEach(function (x, k) { if (x.id === id) i = k; });
      var row = { id: id, data: en, at: nowCairo() };
      if (i >= 0) box.items[i] = row; else box.items.push(row);
      results[id] = 'ok';
    });
    writeJson_('inbox.json', box);
    return { results: results };
  }
};
