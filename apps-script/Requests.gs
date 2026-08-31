/**
 * Requests catalog for Mayordomía.
 *
 * Surfaces the requests (Solicitudes) that the operations team reviews and
 * approves. The public entry point (`PublicRequests.create`) keeps writing
 * directly to the Requests sheet; this module handles every read and
 * authenticated mutation.
 *
 * All routes:
 *   - scope every read/write to ctx.auth.organizationId
 *   - require the caller to be an ACTIVE member of the org
 *   - validate inputs (Validation.*)
 *   - record audit entries for mutations
 *   - enforce optimistic concurrency via `expectedVersion` on writes
 */
var Requests = (function () {
  var TYPES = ['RESOURCE','LOCATION','AUDIO','MULTIMEDIA','LIGHTING','SUPPORT','MAINTENANCE','PURCHASE','OTHER'];
  var STATUSES = ['DRAFT','PENDING','PENDING_AREA_APPROVAL','PENDING_GENERAL_APPROVAL','APPROVED','REJECTED','DELIVERED','CANCELLED'];
  var KINDS = ['PHYSICAL','SERVICE','MAINTENANCE','PURCHASE'];
  var SCOPES = ['AREA','GENERAL'];

  // ---------------- list ----------------
  function list(payload, ctx) {
    Validation.object(payload, 'payload');
    var filters = {
      status: payload.status ? Validation.enumValue(payload.status, 'status', STATUSES) : null,
      type: payload.type ? Validation.enumValue(payload.type, 'type', TYPES) : null,
      kind: payload.kind ? Validation.enumValue(payload.kind, 'kind', KINDS) : null,
      siteId: payload.siteId ? Validation.id(payload.siteId, 'siteId') : null,
      since: parseDate_(payload.since, 'since'),
      until: parseDate_(payload.until, 'until'),
    };
    var rows = SheetsRepository.rows('Requests').filter(function (r) {
      return String(r.organizationId) === ctx.auth.organizationId;
    });
    if (filters.status) rows = rows.filter(function (r) { return String(r.status) === filters.status; });
    if (filters.type) rows = rows.filter(function (r) { return String(r.type) === filters.type; });
    if (filters.kind) rows = rows.filter(function (r) { return String(r.kind) === filters.kind; });
    if (filters.siteId) rows = rows.filter(function (r) { return String(r.siteId) === filters.siteId; });
    if (filters.since) rows = rows.filter(function (r) { return toIso_(r.createdAt) >= filters.since; });
    if (filters.until) rows = rows.filter(function (r) { return toIso_(r.createdAt) <= filters.until; });
    rows.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    var approvalsByRequest = indexApprovals_(ctx.auth.organizationId);
    return { requests: rows.map(function (r) { return toListItem_(r, approvalsByRequest[String(r.id)] || []); }) };
  }

  // ---------------- get ----------------
  function get(payload, ctx) {
    Validation.object(payload, 'payload');
    var id = Validation.id(payload.id, 'id');
    var row = findRequest_(id, ctx.auth.organizationId);
    if (!row) throw ApiError.notFound('Solicitud');
    var approvals = SheetsRepository.rows('RequestApprovals')
      .filter(function (a) { return String(a.organizationId) === ctx.auth.organizationId && String(a.requestId) === id; })
      .map(toApproval_);
    var timeline = buildTimeline_(row, approvals);
    var request = toRequest_(row);
    request.approvals = approvals;
    request.timeline = timeline;
    request.flags = computeFlags_(row, approvals);
    return { request: request };
  }

  // ---------------- approve ----------------
  function approve(payload, ctx) {
    var input = parseDecisionPayload_(payload, ctx, 'request.approve.area', 'request.approve.general');
    var request = findRequest_(input.id, ctx.auth.organizationId);
    if (!request) throw ApiError.notFound('Solicitud');
    ensureVersion_(request, input.expectedVersion);
    var currentStatus = String(request.status || '');
    if (currentStatus === 'APPROVED' || currentStatus === 'REJECTED' || currentStatus === 'CANCELLED' || currentStatus === 'DELIVERED')
      throw ApiError.conflict('REQUEST_LOCKED', 'La solicitud ya fue cerrada');
    var approval = pickApproval_(request.id, ctx.auth.organizationId, input.scope, request.currentArea);
    if (!approval) throw ApiError.notFound('Aprobación');
    if (String(approval.status) === 'APPROVED' || String(approval.status) === 'REJECTED')
      throw ApiError.conflict('APPROVAL_LOCKED', 'La aprobación ya fue registrada');
    var now = new Date().toISOString();
    var newStatus = 'APPROVED';
    updateSheetRow_('RequestApprovals', approval, {
      status: newStatus,
      reviewedBy: String(ctx.auth.user.id),
      reviewedAt: now,
      comment: input.comment || '',
      updatedAt: now,
      updatedBy: String(ctx.auth.user.id),
      version: Number(approval.version || 1) + 1,
    });
    var freshApprovals = SheetsRepository.rows('RequestApprovals')
      .filter(function (a) { return String(a.organizationId) === ctx.auth.organizationId && String(a.requestId) === input.id; });
    var nextStatus = computeRequestStatus_(request, freshApprovals);
    updateSheetRow_('Requests', request, {
      status: nextStatus,
      updatedAt: now,
      updatedBy: String(ctx.auth.user.id),
      version: Number(request.version || 1) + 1,
    });
    AuditService.record({
      organizationId: ctx.auth.organizationId,
      actorId: String(ctx.auth.user.id),
      actorType: 'USER',
      action: 'request.approve',
      entityType: 'Request',
      entityId: input.id,
      requestId: ctx.requestId,
      metadata: { scope: input.scope, areaId: approval.areaId || null, comment: input.comment || '' }
    });
    publishApprovalNotification_(request, 'REQUEST_APPROVED', ctx);
    return { id: input.id, status: nextStatus, version: Number(request.version || 1) + 1 };
  }

  // ---------------- reject ----------------
  function reject(payload, ctx) {
    var input = parseDecisionPayload_(payload, ctx, 'request.approve.area', 'request.approve.general');
    var request = findRequest_(input.id, ctx.auth.organizationId);
    if (!request) throw ApiError.notFound('Solicitud');
    ensureVersion_(request, input.expectedVersion);
    var approval = pickApproval_(request.id, ctx.auth.organizationId, input.scope, request.currentArea);
    if (!approval) throw ApiError.notFound('Aprobación');
    if (String(approval.status) === 'APPROVED' || String(approval.status) === 'REJECTED')
      throw ApiError.conflict('APPROVAL_LOCKED', 'La aprobación ya fue registrada');
    var now = new Date().toISOString();
    updateSheetRow_('RequestApprovals', approval, {
      status: 'REJECTED',
      reviewedBy: String(ctx.auth.user.id),
      reviewedAt: now,
      comment: input.comment || '',
      updatedAt: now,
      updatedBy: String(ctx.auth.user.id),
      version: Number(approval.version || 1) + 1,
    });
    var nextStatus = 'REJECTED';
    updateSheetRow_('Requests', request, {
      status: nextStatus,
      updatedAt: now,
      updatedBy: String(ctx.auth.user.id),
      version: Number(request.version || 1) + 1,
    });
    AuditService.record({
      organizationId: ctx.auth.organizationId,
      actorId: String(ctx.auth.user.id),
      actorType: 'USER',
      action: 'request.reject',
      entityType: 'Request',
      entityId: input.id,
      requestId: ctx.requestId,
      metadata: { scope: input.scope, areaId: approval.areaId || null, comment: input.comment || '' }
    });
    publishApprovalNotification_(request, 'REQUEST_REJECTED', ctx);
    return { id: input.id, status: nextStatus, version: Number(request.version || 1) + 1 };
  }

  // Best-effort fan-out to the in-app notification center. Wrapped in
  // try/catch so a notification failure never breaks the approval flow.
  function publishApprovalNotification_(request, kind, ctx) {
    try {
      var title = kind === 'REQUEST_APPROVED' ? 'Solicitud aprobada' : 'Solicitud rechazada';
      var link = '/requests/' + String(request.id);
      var body = String(request.description || request.title || '').slice(0, 200);
      Notifications.publish({
        organizationId: ctx.auth.organizationId,
        userId: null,
        kind: kind,
        title: title,
        body: body,
        link: link,
        entityType: 'Request',
        entityId: String(request.id),
      }, { auth: { user: { id: 'system' }, organizationId: ctx.auth.organizationId }, requestId: ctx.requestId });
    } catch (e) {
      console.error('publishApprovalNotification_ failed: ' + e);
    }
  }

  // ---------------- helpers ----------------
  function parseDecisionPayload_(payload, ctx, areaPermission, generalPermission) {
    Validation.object(payload, 'payload');
    var id = Validation.id(payload.id, 'id');
    var scope = Validation.enumValue(payload.scope, 'scope', SCOPES);
    var expectedVersion = Number(payload.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1)
      throw ApiError.badRequest('VALIDATION_ERROR', 'expectedVersion debe ser un entero positivo');
    var comment = payload.comment ? Validation.safeText(payload.comment, 'comment', 500) : '';
    var required = scope === 'AREA' ? areaPermission : generalPermission;
    AuthService.requirePermission(ctx.auth, required);
    return { id: id, scope: scope, expectedVersion: expectedVersion, comment: comment };
  }

  function findRequest_(id, organizationId) {
    return SheetsRepository.findOne('Requests', function (r) {
      return String(r.id) === id && String(r.organizationId) === organizationId;
    });
  }

  function ensureVersion_(row, expectedVersion) {
    var actual = Number(row.version || 1);
    if (actual !== expectedVersion) throw ApiError.conflict('VERSION_MISMATCH', 'La solicitud fue modificada por otro usuario', { expectedVersion: expectedVersion, actualVersion: actual });
  }

  function pickApproval_(requestId, organizationId, scope, currentArea) {
    var rows = SheetsRepository.rows('RequestApprovals').filter(function (a) {
      return String(a.organizationId) === organizationId && String(a.requestId) === requestId && String(a.scope) === scope;
    });
    if (scope !== 'AREA') return rows[0] || null;
    if (!currentArea) return rows[0] || null;
    var matched = rows.filter(function (r) { return String(r.areaId) === String(currentArea); });
    return matched[0] || rows[0] || null;
  }

  function indexApprovals_(organizationId) {
    var map = {};
    SheetsRepository.rows('RequestApprovals')
      .filter(function (a) { return String(a.organizationId) === organizationId; })
      .forEach(function (a) {
        var key = String(a.requestId);
        if (!map[key]) map[key] = [];
        map[key].push(a);
      });
    return map;
  }

  function toListItem_(row, approvals) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      siteId: row.siteId ? String(row.siteId) : undefined,
      type: String(row.type || 'OTHER'),
      kind: row.kind ? String(row.kind) : undefined,
      requesterName: String(row.requesterName || ''),
      requesterEmail: row.requesterEmail ? String(row.requesterEmail) : undefined,
      description: String(row.description || ''),
      requestedFor: row.requestedFor ? String(row.requestedFor) : undefined,
      source: String(row.source || 'INTERNAL'),
      status: String(row.status || 'PENDING'),
      eventStart: row.eventStart ? String(row.eventStart) : undefined,
      eventEnd: row.eventEnd ? String(row.eventEnd) : undefined,
      urgencyReason: row.urgencyReason ? String(row.urgencyReason) : undefined,
      lateReason: row.lateReason ? String(row.lateReason) : undefined,
      currentArea: row.currentArea ? String(row.currentArea) : undefined,
      createdAt: String(row.createdAt || ''),
      updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
      version: Number(row.version || 1),
      approvalSummary: summarizeApprovals_(approvals),
      needsAreaApproval: computeFlags_(row, approvals).needsAreaApproval,
      needsGeneralApproval: computeFlags_(row, approvals).needsGeneralApproval,
    };
  }

  function toRequest_(row) {
    var out = toListItem_(row, []);
    return out;
  }

  function toApproval_(row) {
    return {
      id: String(row.id),
      requestId: String(row.requestId),
      scope: String(row.scope),
      areaId: row.areaId ? String(row.areaId) : undefined,
      status: String(row.status || 'PENDING'),
      reviewedBy: row.reviewedBy ? String(row.reviewedBy) : undefined,
      reviewedAt: row.reviewedAt ? String(row.reviewedAt) : undefined,
      comment: row.comment ? String(row.comment) : undefined,
      createdAt: String(row.createdAt || ''),
      updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
      version: Number(row.version || 1),
    };
  }

  function summarizeApprovals_(approvals) {
    if (!approvals || !approvals.length) return { area: 'NONE', general: 'NONE' };
    var area = approvals.filter(function (a) { return String(a.scope) === 'AREA'; });
    var general = approvals.filter(function (a) { return String(a.scope) === 'GENERAL'; });
    return {
      area: rollup_(area),
      general: rollup_(general),
    };
  }

  function rollup_(list) {
    if (!list.length) return 'NONE';
    if (list.some(function (a) { return String(a.status) === 'REJECTED'; })) return 'REJECTED';
    if (list.every(function (a) { return String(a.status) === 'APPROVED'; })) return 'APPROVED';
    return 'PENDING';
  }

  function computeFlags_(row, approvals) {
    var area = approvals.filter(function (a) { return String(a.scope) === 'AREA'; });
    var general = approvals.filter(function (a) { return String(a.scope) === 'GENERAL'; });
    var needsArea = area.length > 0 && area.every(function (a) { return String(a.status) === 'PENDING'; });
    var needsGeneral = general.length > 0 && general.every(function (a) { return String(a.status) === 'PENDING'; });
    return { needsAreaApproval: needsArea, needsGeneralApproval: needsGeneral };
  }

  function computeRequestStatus_(request, approvals) {
    if (!approvals.length) return request.status;
    if (approvals.some(function (a) { return String(a.status) === 'REJECTED'; })) return 'REJECTED';
    if (approvals.every(function (a) { return String(a.status) === 'APPROVED'; })) return 'APPROVED';
    var general = approvals.filter(function (a) { return String(a.scope) === 'GENERAL'; });
    if (general.length && general.every(function (a) { return String(a.status) === 'PENDING'; })) return 'PENDING_GENERAL_APPROVAL';
    return 'PENDING_AREA_APPROVAL';
  }

  function buildTimeline_(row, approvals) {
    var events = [];
    events.push({ at: String(row.createdAt || ''), kind: 'CREATED', actor: String(row.createdBy || ''), label: 'Solicitud creada' });
    approvals.forEach(function (a) {
      if (a.reviewedAt) {
        events.push({
          at: String(a.reviewedAt),
          kind: a.status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          actor: String(a.reviewedBy || ''),
          scope: a.scope,
          areaId: a.areaId,
          comment: a.comment,
          label: a.scope === 'AREA' ? 'Aprobación de área' : 'Aprobación general',
        });
      }
    });
    if (row.updatedAt && String(row.updatedAt) !== String(row.createdAt)) {
      events.push({ at: String(row.updatedAt), kind: 'STATUS_CHANGED', actor: String(row.updatedBy || ''), label: 'Estado actualizado' });
    }
    events.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
    return events;
  }

  function parseDate_(value, label) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') throw ApiError.badRequest('VALIDATION_ERROR', label + ' inválido');
    var d = new Date(value);
    if (isNaN(d.getTime())) throw ApiError.badRequest('VALIDATION_ERROR', label + ' inválido');
    return d.toISOString();
  }

  function toIso_(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toISOString();
  }

  function updateSheetRow_(tableName, original, changes) {
    var db = SheetsRepository.db();
    var sheet = db.getSheetByName(tableName);
    if (!sheet) throw ApiError.internal('SCHEMA_INVALID', 'No existe la hoja ' + tableName);
    var range = sheet.getDataRange();
    var values = range.getValues();
    if (!values.length) throw ApiError.notFound('Registro');
    var headers = values[0].map(String);
    var idIndex = headers.indexOf('id');
    if (idIndex < 0) throw ApiError.internal('SCHEMA_INVALID', 'Falta columna id en ' + tableName);
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][idIndex]) === String(original.id)) {
        var row = values[r];
        Object.keys(changes).forEach(function (key) {
          var idx = headers.indexOf(key);
          if (idx >= 0) row[idx] = changes[key];
        });
        sheet.getRange(r + 1, 1, 1, headers.length).setValues([row]);
        return { row: r + 1 };
      }
    }
    throw ApiError.notFound('Registro');
  }

  return { list: list, get: get, approve: approve, reject: reject };
})();
