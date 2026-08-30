var SheetsRepository = (function () {
  function db_() { return SpreadsheetApp.openById(AppConfig.requireValue(AppConfig.KEYS.databaseId)); }
  function sheet_(name) { var sheet = db_().getSheetByName(name); if (!sheet) throw ApiError.internal('SCHEMA_INVALID', 'No existe la hoja ' + name); return sheet; }
  function rows(name) {
    var values = sheet_(name).getDataRange().getValues(); if (!values.length) return [];
    var headers = values.shift().map(String);
    return values.filter(function (r) { return r.some(function (v) { return v !== ''; }); }).map(function (r) {
      var out = {}; headers.forEach(function (h, i) { out[h] = r[i]; }); return out;
    });
  }
  function findOne(name, predicate) { var list = rows(name); for (var i = 0; i < list.length; i++) if (predicate(list[i])) return list[i]; return null; }
  function append(name, record) {
    var sheet = sheet_(name); var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    sheet.appendRow(headers.map(function (h) { return record[h] === undefined ? '' : record[h]; })); return record;
  }
  function ensure(name, headers) { var db = db_(); var sheet = db.getSheetByName(name) || db.insertSheet(name); if (sheet.getLastRow() === 0) sheet.appendRow(headers); return sheet; }
  return { db: db_, rows: rows, findOne: findOne, append: append, ensure: ensure };
})();
