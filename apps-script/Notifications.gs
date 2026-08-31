/**
 * Notifications — in-app notification center backing store.
 *
 * Read endpoints (`listMine`, `markRead`, `markAllRead`, `unreadCount`) are
 * exposed to authenticated members; `publish` requires the
 * `notification.manage` permission so other modules can fan out a notice
 * from inside their own transactions.
 *
 * Each row is scoped to an organization; a `null` userId means "org-wide"
 * and is included for every member when listing. Single-tenant per
 * deployment, so we keep the simple `append` semantics for v1.
 */
var Notifications = (function () {
  var KINDS = [
    'REQUEST_SUBMITTED',
    'REQUEST_APPROVED',
    'REQUEST_REJECTED',
    'MAINTENANCE_OPENED',
    'DELIVERY_CREATED',
    'RETURN_DAMAGED',
    'PURCHASE_DECISION',
    'EVENT_REMINDER',
    'OTHER'
  ];

  function isOrgWide_(userId) { return !userId; }

  // ---------------- listMine ----------------
  function listMine(payload, ctx) {
    Validation.object(payload, 'payload');
    var userId = String(ctx.auth.user.id);
    var organizationId = String(ctx.auth.organizationId);
    var kinds = parseKinds_(payload.kinds);
    var unreadOnly = payload.unreadOnly === true || payload.unreadOnly === 'true';
    var since = parseDate_(payload.since, 'since');
    var until = parseDate_(payload.until, 'until');
    var limit = parseLimit_(payload.limit);

    var rows = SheetsRepository.rows('Notifications')
      .filter(function (r) { return String(r.organizationId) === organizationId; })
      .filter(function (r) { return isOrgWide_(r.userId) || String(r.userId) === userId; });
    if (kinds) rows = rows.filter(function (r) { return kinds.indexOf(String(r.kind)) >= 0; });
    if (unreadOnly) rows = rows.filter(function (r) { return !truthy_(r.read); });
    if (since) rows = rows.filter(function (r) { return String(r.createdAt) >= since; });
    if (until) rows = rows.filter(function (r) { return String(r.createdAt) <= until; });
    rows.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    if (limit && rows.length > limit) rows = rows.slice(0, limit);

    return {
      notifications: rows.map(function (r) { return toDto_(r); })
    };
  }

  // ---------------- markRead ----------------
  function markRead(payload, ctx) {
    Validation.object(payload, 'payload');
    var ids = parseIds_(payload.ids);
    if (!ids.length) throw ApiError.badRequest('VALIDATION_ERROR', 'ids es obligatorio');
    var userId = String(ctx.auth.user.id);
    var organizationId = String(ctx.auth.organizationId);
    var now = new Date().toISOString();
    var updated = 0;
    ids.forEach(function (id) {
      var row = SheetsRepository.findOne('Notifications', function (r) {
        return String(r.id) === id && String(r.organizationId) === organizationId;
      });
      if (!row) return;
      if (!isOrgWide_(row.userId) && String(row.userId) !== userId) return;
      if (truthy_(row.read)) return;
      updateRow_(row, { read: true, version: Number(row.version || 1) + 1 });
      updated++;
    });
    return { updated: updated };
  }

  // ---------------- markAllRead ----------------
  function markAllRead(payload, ctx) {
    Validation.object(payload, 'payload');
    var userId = String(ctx.auth.user.id);
    var organizationId = String(ctx.auth.organizationId);
    var updated = 0;
    SheetsRepository.rows('Notifications')
      .filter(function (r) { return String(r.organizationId) === organizationId; })
      .filter(function (r) { return isOrgWide_(r.userId) || String(r.userId) === userId; })
      .filter(function (r) { return !truthy_(r.read); })
      .forEach(function (r) {
        updateRow_(r, { read: true, version: Number(r.version || 1) + 1 });
        updated++;
      });
    return { updated: updated };
  }

  // ---------------- unreadCount ----------------
  function unreadCount(payload, ctx) {
    Validation.object(payload, 'payload');
    var userId = String(ctx.auth.user.id);
    var organizationId = String(ctx.auth.organizationId);
    var count = SheetsRepository.rows('Notifications')
      .filter(function (r) { return String(r.organizationId) === organizationId; })
      .filter(function (r) { return isOrgWide_(r.userId) || String(r.userId) === userId; })
      .filter(function (r) { return !truthy_(r.read); })
      .length;
    return { count: count };
  }

  // ---------------- publish (server-side helper, exposed via router) ----------------
  // Called by other modules. Permission: notification.manage.
  function publish(payload, ctx) {
    Validation.object(payload, 'payload');
    var kind = Validation.enumValue(payload.kind, 'kind', KINDS);
    var title = Validation.string(payload.title, 'title', { max: 200 });
    var body = payload.body ? Validation.safeText(payload.body, 'body', 1000) : '';
    var link = payload.link ? Validation.string(payload.link, 'link', { max: 500 }) : '';
    var entityType = payload.entityType ? Validation.string(payload.entityType, 'entityType', { max: 60 }) : '';
    var entityId = payload.entityId ? Validation.id(payload.entityId, 'entityId') : '';
    var userId = payload.userId ? Validation.id(payload.userId, 'userId') : '';
    var organizationId = String(ctx.auth.organizationId);
    var id = Utilities.getUuid();
    var now = new Date().toISOString();
    SheetsRepository.append('Notifications', {
      id: id,
      organizationId: organizationId,
      userId: userId,
      kind: kind,
      title: title,
      body: body,
      link: link,
      entityType: entityType,
      entityId: entityId,
      read: false,
      createdAt: now,
      version: 1
    });
    return { id: id };
  }

  // ---------------- helpers ----------------
  function toDto_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      userId: row.userId ? String(row.userId) : undefined,
      kind: String(row.kind || 'OTHER'),
      title: String(row.title || ''),
      body: row.body ? String(row.body) : '',
      link: row.link ? String(row.link) : '',
      entityType: row.entityType ? String(row.entityType) : '',
      entityId: row.entityId ? String(row.entityId) : '',
      read: truthy_(row.read),
      createdAt: String(row.createdAt || ''),
      version: Number(row.version || 1)
    };
  }

  function truthy_(value) {
    if (value === true) return true;
    if (typeof value === 'string') return value === 'true' || value === '1';
    if (typeof value === 'number') return value !== 0;
    return false;
  }

  function parseKinds_(raw) {
    if (!raw) return null;
    var list = Array.isArray(raw) ? raw : String(raw).split(',');
    var cleaned = list.map(function (k) { return String(k || '').trim(); }).filter(Boolean);
    if (!cleaned.length) return null;
    cleaned.forEach(function (k) { Validation.enumValue(k, 'kinds', KINDS); });
    return cleaned;
  }

  function parseIds_(raw) {
    if (!raw) return [];
    var list = Array.isArray(raw) ? raw : String(raw).split(',');
    return list.map(function (i) { return Validation.id(i, 'id'); });
  }

  function parseDate_(value, label) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') throw ApiError.badRequest('VALIDATION_ERROR', label + ' inválido');
    var d = new Date(value);
    if (isNaN(d.getTime())) throw ApiError.badRequest('VALIDATION_ERROR', label + ' inválido');
    return d.toISOString();
  }

  function parseLimit_(raw) {
    if (raw === null || raw === undefined || raw === '') return 50;
    var n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 200) {
      throw ApiError.badRequest('VALIDATION_ERROR', 'limit fuera de rango');
    }
    return n;
  }

  function updateRow_(row, changes) {
    var db = SheetsRepository.db();
    var sheet = db.getSheetByName('Notifications');
    if (!sheet) throw ApiError.internal('SCHEMA_INVALID', 'No existe la hoja Notifications');
    var range = sheet.getDataRange();
    var values = range.getValues();
    if (!values.length) throw ApiError.notFound('Notificación');
    var headers = values[0].map(String);
    var idIndex = headers.indexOf('id');
    if (idIndex < 0) throw ApiError.internal('SCHEMA_INVALID', 'Falta columna id en Notifications');
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][idIndex]) === String(row.id)) {
        var current = values[r];
        Object.keys(changes).forEach(function (key) {
          var idx = headers.indexOf(key);
          if (idx >= 0) current[idx] = changes[key];
        });
        sheet.getRange(r + 1, 1, 1, headers.length).setValues([current]);
        return;
      }
    }
    throw ApiError.notFound('Notificación');
  }

  return { listMine: listMine, markRead: markRead, markAllRead: markAllRead, unreadCount: unreadCount, publish: publish };
})();
