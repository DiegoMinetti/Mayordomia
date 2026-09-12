/**
 * Maintenance gateway module (PR 3a).
 *
 * Tracks corrective/preventive maintenance and inspections. Records can be
 * created manually (`maintenance.create`) or automatically by Operations
 * (`returnDeliveryItem` with condition=DAMAGED). The `update` path supports
 * status transitions, resolution text, costs, and free-form notes — every
 * change appends a `MaintenanceUpdates` entry for an audit trail.
 *
 * Auth: `maintenance.manage` for every route. Optimistic concurrency on
 * the maintenance record via `expectedVersion`.
 */
var MaintenanceService = (function () {
  var KINDS = ['CORRECTIVE', 'PREVENTIVE', 'INSPECTION'];
  var SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  var STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'];
  var UPDATE_KINDS = ['NOTE', 'STATUS', 'COST', 'RESOLUTION'];

  function list(payload, ctx) {
    Validation.object(payload, 'payload');
    var filters = {
      status: payload.status ? Validation.enumValue(payload.status, 'status', STATUSES) : null,
      kind: payload.kind ? Validation.enumValue(payload.kind, 'kind', KINDS) : null,
      severity: payload.severity ? Validation.enumValue(payload.severity, 'severity', SEVERITIES) : null,
      resourceId: payload.resourceId ? Validation.id(payload.resourceId, 'resourceId') : null,
      siteId: payload.siteId ? Validation.id(payload.siteId, 'siteId') : null,
    };
    var rows = SheetsRepository.rows('Maintenance').filter(function (r) {
      return String(r.organizationId) === ctx.auth.organizationId;
    });
    if (filters.status) rows = rows.filter(function (r) { return String(r.status) === filters.status; });
    if (filters.kind) rows = rows.filter(function (r) { return String(r.kind) === filters.kind; });
    if (filters.severity) rows = rows.filter(function (r) { return String(r.severity) === filters.severity; });
    if (filters.resourceId) rows = rows.filter(function (r) { return String(r.resourceId) === filters.resourceId; });
    if (filters.siteId) rows = rows.filter(function (r) { return String(r.siteId) === filters.siteId; });
    rows.sort(function (a, b) { return String(b.reportedAt).localeCompare(String(a.reportedAt)); });
    return { maintenance: rows.map(toMaintenance_) };
  }

  function get(payload, ctx) {
    Validation.object(payload, 'payload');
    var id = Validation.id(payload.id, 'id');
    var row = findMaintenance_(id, ctx.auth.organizationId);
    if (!row) throw ApiError.notFound('Mantenimiento');
    var updates = SheetsRepository.rows('MaintenanceUpdates')
      .filter(function (u) { return String(u.organizationId) === ctx.auth.organizationId && String(u.maintenanceId) === id; })
      .sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); })
      .map(toMaintenanceUpdate_);
    var resource = row.resourceId
      ? SheetsRepository.findOne('Resources', function (r) {
          return String(r.organizationId) === ctx.auth.organizationId && String(r.id) === String(row.resourceId);
        })
      : null;
    return {
      maintenance: toMaintenance_(row),
      updates: updates,
      resource: resource
        ? { id: String(resource.id), name: String(resource.name || ''), status: String(resource.status || '') }
        : undefined,
    };
  }

  function create(payload, ctx) {
    Validation.object(payload, 'payload');
    var kind = Validation.enumValue(payload.kind, 'kind', KINDS);
    var severity = Validation.enumValue(payload.severity, 'severity', SEVERITIES);
    var description = Validation.safeText(payload.description, 'description', 2000);
    var reportedBy = payload.reportedBy ? Validation.id(payload.reportedBy, 'reportedBy') : String(ctx.auth.user.id);
    if (String(ctx.auth.user.id) !== reportedBy) throw ApiError.forbidden('maintenance.manage');
    var resourceId = payload.resourceId ? Validation.id(payload.resourceId, 'resourceId') : '';
    var siteId = payload.siteId ? Validation.id(payload.siteId, 'siteId') : '';
    var sourceDeliveryItemId = payload.sourceDeliveryItemId ? Validation.id(payload.sourceDeliveryItemId, 'sourceDeliveryItemId') : '';
    if (resourceId) {
      var resource = SheetsRepository.findOne('Resources', function (r) {
        return String(r.organizationId) === ctx.auth.organizationId && String(r.id) === resourceId;
      });
      if (!resource) throw ApiError.notFound('Recurso');
    }
    var now = new Date().toISOString();
    var id = 'mnt-' + Utilities.getUuid().slice(0, 8);
    var row = {
      id: id,
      organizationId: ctx.auth.organizationId,
      siteId: siteId,
      resourceId: resourceId,
      reportedBy: reportedBy,
      reportedAt: now,
      kind: kind,
      severity: severity,
      status: 'OPEN',
      description: description,
      resolution: '',
      cost: '',
      supplierId: '',
      startedAt: '',
      resolvedAt: '',
      sourceDeliveryItemId: sourceDeliveryItemId,
      createdAt: now,
      updatedAt: now,
      createdBy: String(ctx.auth.user.id),
      updatedBy: String(ctx.auth.user.id),
      version: 1,
    };
    SheetsRepository.append('Maintenance', row);
    SheetsRepository.append('MaintenanceUpdates', {
      id: 'mntu-' + Utilities.getUuid().slice(0, 8),
      organizationId: ctx.auth.organizationId,
      maintenanceId: id,
      authorId: String(ctx.auth.user.id),
      at: now,
      kind: 'NOTE',
      text: 'Reporte creado.',
      createdAt: now,
      version: 1,
    });
    AuditService.record({
      organizationId: ctx.auth.organizationId,
      actorId: String(ctx.auth.user.id),
      actorType: 'USER',
      action: 'maintenance.create',
      entityType: 'Maintenance',
      entityId: id,
      requestId: ctx.requestId,
      metadata: { kind: kind, severity: severity, resourceId: resourceId, sourceDeliveryItemId: sourceDeliveryItemId }
    });
    return { maintenance: toMaintenance_(row) };
  }

  function update(payload, ctx) {
    Validation.object(payload, 'payload');
    var id = Validation.id(payload.id, 'id');
    var expectedVersion = Number(payload.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1)
      throw ApiError.badRequest('VALIDATION_ERROR', 'expectedVersion debe ser un entero positivo');
    var actorId = payload.actorId ? Validation.id(payload.actorId, 'actorId') : String(ctx.auth.user.id);
    if (String(ctx.auth.user.id) !== actorId) throw ApiError.forbidden('maintenance.manage');
    var row = findMaintenance_(id, ctx.auth.organizationId);
    if (!row) throw ApiError.notFound('Mantenimiento');
    if (Number(row.version || 1) !== expectedVersion) {
      throw ApiError.conflict('VERSION_MISMATCH', 'El mantenimiento fue modificado por otro usuario');
    }
    var now = new Date().toISOString();
    var changes = {};
    var status = payload.status ? Validation.enumValue(payload.status, 'status', STATUSES) : null;
    if (status) {
      changes.status = status;
      if (status === 'IN_PROGRESS' && !row.startedAt) changes.startedAt = now;
      if (status === 'RESOLVED') changes.resolvedAt = now;
      appendUpdate_(ctx.auth.organizationId, row.id, actorId, now, 'STATUS', 'Estado: ' + status);
    }
    if (payload.resolution) {
      var resolution = Validation.safeText(payload.resolution, 'resolution', 2000);
      changes.resolution = resolution;
      changes.status = 'RESOLVED';
      changes.resolvedAt = now;
      appendUpdate_(ctx.auth.organizationId, row.id, actorId, now, 'RESOLUTION', resolution);
    }
    if (typeof payload.cost === 'number' && Number.isFinite(payload.cost)) {
      changes.cost = payload.cost;
      appendUpdate_(ctx.auth.organizationId, row.id, actorId, now, 'COST', 'Costo: ' + payload.cost);
    }
    if (payload.note) {
      appendUpdate_(ctx.auth.organizationId, row.id, actorId, now, 'NOTE', Validation.safeText(payload.note, 'note', 2000));
    }
    if (Object.keys(changes).length === 0) {
      throw ApiError.badRequest('VALIDATION_ERROR', 'Sin cambios para aplicar');
    }
    changes.updatedAt = now;
    changes.updatedBy = actorId;
    changes.version = Number(row.version || 1) + 1;
    var updated = updateSheetRow_('Maintenance', row, changes);
    AuditService.record({
      organizationId: ctx.auth.organizationId,
      actorId: actorId,
      actorType: 'USER',
      action: 'maintenance.update',
      entityType: 'Maintenance',
      entityId: id,
      requestId: ctx.requestId,
      metadata: { status: changes.status || row.status, cost: changes.cost || null, hasResolution: !!changes.resolution }
    });
    return { maintenance: toMaintenance_(updated) };
  }

  /* ---------------- helpers ---------------- */

  function findMaintenance_(id, organizationId) {
    return SheetsRepository.findOne('Maintenance', function (r) {
      return String(r.id) === id && String(r.organizationId) === organizationId;
    });
  }

  function appendUpdate_(organizationId, maintenanceId, authorId, at, kind, text) {
    SheetsRepository.append('MaintenanceUpdates', {
      id: 'mntu-' + Utilities.getUuid().slice(0, 8),
      organizationId: organizationId,
      maintenanceId: maintenanceId,
      authorId: authorId,
      at: at,
      kind: kind,
      text: text,
      createdAt: at,
      version: 1,
    });
  }

  function toMaintenance_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      siteId: row.siteId ? String(row.siteId) : undefined,
      resourceId: row.resourceId ? String(row.resourceId) : undefined,
      reportedBy: String(row.reportedBy || ''),
      reportedAt: String(row.reportedAt || ''),
      kind: String(row.kind || 'CORRECTIVE'),
      severity: String(row.severity || 'MEDIUM'),
      status: String(row.status || 'OPEN'),
      description: String(row.description || ''),
      resolution: row.resolution ? String(row.resolution) : undefined,
      cost: row.cost !== undefined && row.cost !== '' ? Number(row.cost) : undefined,
      supplierId: row.supplierId ? String(row.supplierId) : undefined,
      startedAt: row.startedAt ? String(row.startedAt) : undefined,
      resolvedAt: row.resolvedAt ? String(row.resolvedAt) : undefined,
      sourceDeliveryItemId: row.sourceDeliveryItemId ? String(row.sourceDeliveryItemId) : undefined,
      createdAt: String(row.createdAt || ''),
      updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
      createdBy: String(row.createdBy || ''),
      updatedBy: String(row.updatedBy || ''),
      version: Number(row.version || 1),
    };
  }

  function toMaintenanceUpdate_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      maintenanceId: String(row.maintenanceId || ''),
      authorId: String(row.authorId || ''),
      at: String(row.at || ''),
      kind: String(row.kind || 'NOTE'),
      text: String(row.text || ''),
      createdAt: String(row.createdAt || ''),
      version: Number(row.version || 1),
    };
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
        var rebuilt = {};
        for (var c = 0; c < headers.length; c++) rebuilt[headers[c]] = row[c];
        return rebuilt;
      }
    }
    throw ApiError.notFound('Registro');
  }

  return { list: list, get: get, create: create, update: update };
})();
