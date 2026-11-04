/* ================= سكربت جوجل — برنامج العهدة =================
   مشروع جديد ولوحده: مش بيلمس أي مشروع أو ملف تاني غير الفولدر اللي هو عامله لنفسه
   («برنامج العهدة (بيانات)» في درايف).

   الفكرة:
   - برنامج اللاب هو المرجع. كل شوية بيبعت نسخة من كل شركة (snap-<id>.json) ويسحب اللي اتسجل من الموبايل.
   - الموبايل بيشوف النسخة دي، وبيسجل حركات جديدة في «صندوق الوارد» (inbox.json) لحد ما اللاب يدخّلها.
   - أي حركة اللاب دخّلها خلاص، اللاب بقى هو المرجع ليها، والموبايل مايقدرش يعدّلها.
   - كل طلب لازم يكون معاه key (كود الربط). من غيره السكربت مش بيرد بأي بيانات.

   أول مرة: شغّل setup() من المحرر ← انشر Web app (Execute as: Me — Who has access: Anyone)
   ← شغّل setup() تاني (أو linkCode()) وخد «كود الربط» من السجل وحطه في البرنامج على اللاب. */

var APP_NAME = 'برنامج العهدة';
var VER = '1.0';
var TZ = 'Africa/Cairo';
var MOBILE_PAGE = 'https://hassaneltantawy10.github.io/tantawy-mobile/custody/';
var P = PropertiesService.getScriptProperties();

/* ================= أول تشغيل ================= */
function setup() {
  folder_();
  if (!P.getProperty('KEY')) P.setProperty('KEY', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8));
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'dailyBackup'; });
  if (!has) ScriptApp.newTrigger('dailyBackup').timeBased().everyDays(1).atHour(3).inTimezone(TZ).create();
  Logger.log('اتعمل ✓');
  linkCode();   // لو اتنشر خلاص بيطبع كود الربط على طول
}
function linkCode() {
  var url = ScriptApp.getService().getUrl();
  if (!url) { Logger.log('⚠ لسه ماتنشرش. Deploy ← New deployment ← Web app، وبعدين شغّل linkCode() تاني.'); return; }
  if (/\/dev$/.test(url)) Logger.log('⚠ الرابط آخره /dev (رابط التجربة). استخدم رابط /exec من Deploy ← Manage deployments، وحط بعده نفس الـ # والحروف.');
  var code = url + '#' + P.getProperty('KEY');
  Logger.log('كود الربط (انسخه كله وحطه في البرنامج على اللاب ← الإعدادات ← الربط مع الموبايل):\n' + code);
  Logger.log('ولينك الموبايل الجاهز (افتحه على التليفون مرة واحدة):\n' + MOBILE_PAGE + '#link=' + encodeURIComponent(code));
}

function nowCairo() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss"); }

/* ================= التخزين: ملفات JSON في فولدر واحد ================= */
function folder_() {
  var id = P.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  var f = DriveApp.createFolder(APP_NAME + ' (بيانات)');
  f.setDescription('بيانات برنامج العهدة للموبايل — نسخة من اللاب + اللي اتسجل من الموبايل. ماتمسحش الفولدر ده.');
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
function inbox_() { var b = readJson_('inbox.json', null) || {}; b.items = b.items || []; b.applied = b.applied || {}; return b; }
function safeId_(s) { return String(s || '').replace(/[^A-Za-z0-9_-]/g, ''); }

/* نسخة احتياطية كل يوم من صندوق الوارد والشركات (آخر 30) */
function dailyBackup() {
  var day = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var bf = folder_().getFoldersByName('نسخ احتياطية');
  var dir = bf.hasNext() ? bf.next() : folder_().createFolder('نسخ احتياطية');
  ['inbox.json', 'companies.json'].forEach(function (n) {
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
function doGet(e) { return json_({ ok: true, app: 'tantawy-custody', ver: VER, msg: 'سكربت برنامج العهدة شغال ✓' }); }
function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, error: 'طلب مش مفهوم' }); }
  var key = P.getProperty('KEY');
  if (!key || b.key !== key) return json_({ ok: false, error: 'كود الربط غلط — خده تاني من linkCode()' });
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
  ping: function () { return { app: 'tantawy-custody' }; },

  /* اللاب: يبعت الشركات (والنسخة لو اتغيرت) + اللي دخّله من الموبايل، ويرجع اللي لسه في صندوق الوارد */
  lapSync: function (b) {
    var idx = readJson_('companies.json', null) || { list: [] };
    var old = {}; idx.list.forEach(function (c) { old[c.id] = c; });
    var list = [];
    (b.companies || []).forEach(function (c) {
      var id = safeId_(c.id); if (!id) return;
      var o = old[id] || {};
      var row = { id: id, name: c.name, nameEn: c.nameEn || '', pw: c.pw || null, hash: o.hash || '', at: o.at || '' };
      if (typeof c.snap === 'string' && c.snap) { writeText_('snap-' + id + '.json', c.snap); row.hash = c.hash || ''; row.at = nowCairo(); }
      list.push(row);
    });
    idx.list = list; idx.lapAt = nowCairo();
    writeJson_('companies.json', idx);
    var box = inbox_();
    var ap = b.applied || {};
    Object.keys(ap).forEach(function (id) { if (!box.applied[id] || box.applied[id] < ap[id]) box.applied[id] = ap[id]; });
    box.items = box.items.filter(function (it) { return !(box.applied[it.id] >= it.rev); });
    var ids = Object.keys(box.applied); if (ids.length > 5000) ids.slice(0, ids.length - 4000).forEach(function (k) { delete box.applied[k]; });
    writeJson_('inbox.json', box);
    return { inbox: box.items, hashes: list.reduce(function (m, c) { m[c.id] = c.hash; return m; }, {}) };
  },

  /* الموبايل: قايمة الشركات (الاسم وبصمة كلمة السر عشان يتأكد منها على التليفون) */
  mobInit: function () {
    var idx = readJson_('companies.json', null) || { list: [] };
    return { companies: idx.list.map(function (c) { return { id: c.id, name: c.name, nameEn: c.nameEn, pw: c.pw, at: c.at }; }), lapAt: idx.lapAt || '' };
  },

  /* الموبايل: نسخة شركة + اللي لسه في صندوق الوارد بتاعها */
  mobGet: function (b) {
    var id = safeId_(b.coId);
    var idx = readJson_('companies.json', null) || { list: [] };
    var c = idx.list.filter(function (x) { return x.id === id; })[0];
    if (!c) throw new Error('الشركة دي مش موجودة على السكربت — افتح البرنامج على اللاب وزامن');
    var box = inbox_();
    var res = { at: c.at, hash: c.hash, lapAt: idx.lapAt || '', inbox: box.items.filter(function (it) { return it.coId === id; }) };
    if (b.hash !== c.hash) res.snap = readText_('snap-' + id + '.json');
    return res;
  },

  /* الموبايل: يحط أو يعدّل أو يمسح حركات لسه اللاب مادخّلهاش */
  mobPut: function (b) {
    var box = inbox_(), results = {};
    (b.entries || []).forEach(function (en) {
      var id = String(en.id || ''); if (!id) return;
      if (box.applied[id]) { results[id] = 'applied'; return; }
      var i = -1; box.items.forEach(function (x, k) { if (x.id === id) i = k; });
      if (i >= 0 && box.items[i].rev > en.rev) { results[id] = 'old'; return; }
      if (en.del) { if (i >= 0) box.items.splice(i, 1); results[id] = 'deleted'; return; }
      var row = { id: id, rev: en.rev || 1, coId: safeId_(en.coId), data: en.data, by: en.by || '', at: nowCairo() };
      if (i >= 0) box.items[i] = row; else box.items.push(row);
      results[id] = 'ok';
    });
    writeJson_('inbox.json', box);
    return { results: results };
  }
};
