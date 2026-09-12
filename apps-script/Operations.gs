/**
 * Operations gateway module (PR 3a).
 *
 * Handles the bridge between an approved request and the inventory:
 *   - `listDeliveries` / `getDelivery` (read; supports filters)
 *   - `deliver` (mark an approved request as delivered, create Delivery +
 *     DeliveryItems, transition resources, record movements)
 *   - `returnDeliveryItem` (mark a single item as returned; auto-create a
 *     Maintenance record when condition=DAMAGED via `applyReturnCondition_`)
 *
 * The `applyReturnCondition_` helper is the Apps Script port of the
 * `applyReturnCondition` function in `src/domain/operations.ts`. They must
 * stay in lock-step (see `applyReturnConditionSpecs` in the TS file for the
 * canonical truth table).
 *
 * Auth: every route requires `delivery.manage`. Writes go through
 * `expectedVersion` for optimistic concurrency on the request. The
 * `idempotencyKey` on `deliver` lets clients safely retry a flaky POST.
 */
var Operations = (function () {
  var DELIVERY_STATUSES = ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  var RETURN_CONDITIONS = ['OK', 'DAMAGED', 'LOST'];
  var MAINTENANCE_KINDS = ['CORRECTIVE', 'PREVENTIVE', 'INSPECTION'];
  var MAINTENANCE_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  var MAINTENANCE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'];
  var IDEM_RE = /^[A-Za-z0-9_:-]{6,128}$/;

  function list(payload, ctx) {
    Validation.object(payload, 'payload');
    var filters = {
      requestId: payload.requestId ? Validation.id(payload.requestId, 'requestId') : null,
      status: payload.status ? Validation.enumValue(payload.status, 'status', DELIVERY_STATUSES) : null,
      since: parseDate_(payload.since, 'since'),
      until: parseDate_(payload.until, 'until'),
    };
    var rows = SheetsRepository.rows('Deliveries').filter(function (r) {
      return String(r.organizationId) === ctx.auth.organizationId;
    });
    if (filters.requestId) rows = rows.filter(function (r) { return String(r.requestId) === filters.requestId; });
    if (filters.status) rows = rows.filter(function (r) { return String(r.status) === filters.status; });
    if (filters.since) rows = rows.filter(function (r) { return toIso_(r.deliveredAt) >= filters.since; });
    if (filters.until) rows = rows.filter(function (r) { return toIso_(r.deliveredAt) <= filters.until; });
    rows.sort(function (a, b) { return String(b.deliveredAt).localeCompare(String(a.deliveredAt)); });
    return { deliveries: rows.map(toDelivery_) };
  }

  function get(payload, ctx) {
    Validation.object(payload, 'payload');
    var id = Validation.id(payload.id, 'id');
    var delivery = findDelivery_(id, ctx.auth.organizationId);
    if (!delivery) throw ApiError.notFound('Entrega');
    var items = SheetsRepository.rows('DeliveryItems')
      .filter(function (it) { return String(it.organizationId) === ctx.auth.organizationId && String(it.deliveryId) === id; })
      .map(toDeliveryItem_);
    var progress = computeProgress_(items);
    var request = findRequestHeader_(String(delivery.requestId), ctx.auth.organizationId);
    var resources = resolveResources_(items, ctx.auth.organizationId);
    return {
      delivery: toDelivery_(delivery),
      items: items,
      progress: progress,
      request: request,
      resources: resources,
    };
  }

  function deliver(payload, ctx) {
    Validation.object(payload, 'payload');
    var input = parseDeliverPayload_(payload, ctx);
    var existing = findDeliveryByIdem_(input.idempotencyKey, ctx.auth.organizationId);
    if (existing) {
      var existingItems = SheetsRepository.rows('DeliveryItems')
        .filter(function (it) { return String(it.organizationId) === ctx.auth.organizationId && String(it.deliveryId) === existing.id; })
        .map(toDeliveryItem_);
      return {
        delivery: toDelivery_(existing),
        items: existingItems,
        resourceIds: existingItems.map(function (it) { return String(it.resourceId); }),
      };
    }
    var request = findRequest_(input.requestId, ctx.auth.organizationId);
    if (!request) throw ApiError.notFound('Solicitud');
    ensureVersion_(request, input.expectedVersion);
    if (String(request.status) !== 'APPROVED') {
      throw ApiError.conflict('REQUEST_NOT_APPROVED', 'La solicitud no está aprobada');
    }
    var resources = SheetsRepository.rows('Resources').filter(function (r) {
      return String(r.organizationId) === ctx.auth.organizationId;
    });
    var now = input.deliveredAt || new Date().toISOString();
    var deliveryId = 'del-' + Utilities.getUuid().slice(0, 8);
    var delivery = {
      id: deliveryId,
      organizationId: ctx.auth.organizationId,
      requestId: input.requestId,
      deliveredBy: String(ctx.auth.user.id),
      deliveredAt: now,
      siteId: input.siteId || request.siteId || '',
      recipientName: input.recipientName,
      notes: input.notes || '',
      status: 'IN_PROGRESS',
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
      createdBy: String(ctx.auth.user.id),
      updatedBy: String(ctx.auth.user.id),
      version: 1,
    };
    SheetsRepository.append('Deliveries', delivery);
    var items = [];
    var resourceIds = [];
    var actorId = String(ctx.auth.user.id);
    input.items.forEach(function (it) {
      var resource = resources.find(function (r) { return String(r.id) === it.resourceId; });
      if (!resource) throw ApiError.notFound('Recurso ' + it.resourceId);
      var row = {
        id: 'deli-' + Utilities.getUuid().slice(0, 8),
        organizationId: ctx.auth.organizationId,
        deliveryId: deliveryId,
        resourceId: it.resourceId,
        quantity: it.quantity,
        returnedAt: '',
        returnedBy: '',
        returnNotes: '',
        returnedQuantity: '',
        condition: '',
        version: 1,
      };
      SheetsRepository.append('DeliveryItems', row);
      items.push(toDeliveryItem_(row));
      resourceIds.push(it.resourceId);
      // Decide between DELIVERED and IN_USE for the new status.
      var toStatus = String(resource.inventoryType) === 'SERIALIZED' ? 'IN_USE' : 'DELIVERED';
      SheetsRepository.append('ResourceMovements', {
        id: 'mov-' + Utilities.getUuid().slice(0, 8),
        organizationId: ctx.auth.organizationId,
        resourceId: it.resourceId,
        type: 'DELIVER',
        fromLocationId: '',
        toLocationId: '',
        fromStatus: String(resource.status || 'AVAILABLE'),
        toStatus: toStatus,
        quantity: it.quantity,
        actorId: actorId,
        reason: 'Entrega ' + deliveryId,
        occurredAt: now,
      });
      updateSheetRow_('Resources', resource, {
        status: toStatus,
        currentDeliveryId: deliveryId,
        updatedAt: now,
        updatedBy: actorId,
        version: Number(resource.version || 1) + 1,
      });
    });
    // Request lifecycle: APPROVED -> DELIVERED.
    updateSheetRow_('Requests', request, {
      status: 'DELIVERED',
      updatedAt: now,
      updatedBy: actorId,
      version: Number(request.version || 1) + 1,
    });
    // Related reservations: keep them CONFIRMED; they go CANCELLED when the
    // delivery is COMPLETED via `returnDeliveryItem` (handled per item).
    AuditService.record({
      organizationId: ctx.auth.organizationId,
      actorId: actorId,
      actorType: 'USER',
      action: 'operations.deliver',
      entityType: 'Delivery',
      entityId: deliveryId,
      requestId: ctx.requestId,
      metadata: { requestId: input.requestId, itemCount: input.items.length }
    });
    return { delivery: toDelivery_(delivery), items: items, resourceIds: resourceIds };
  }

  function returnDeliveryItem(payload, ctx) {
    Validation.object(payload, 'payload');
    var input = parseReturnPayload_(payload, ctx);
    var rows = SheetsRepository.rows('DeliveryItems');
    var item = rows.find(function (r) {
      return String(r.organizationId) === ctx.auth.organizationId && String(r.id) === input.deliveryItemId;
    });
    if (!item) throw ApiError.notFound('Item de entrega');
    if (Number(item.version) !== input.expectedVersion) {
      throw ApiError.conflict('VERSION_MISMATCH', 'El item fue modificado por otro usuario');
    }
    if (item.returnedAt && String(item.returnedAt) !== '') {
      throw ApiError.conflict('ALREADY_RETURNED', 'El item ya fue devuelto');
    }
    var resource = SheetsRepository.findOne('Resources', function (r) {
      return String(r.organizationId) === ctx.auth.organizationId && String(r.id) === String(item.resourceId);
    });
    if (!resource) throw ApiError.notFound('Recurso');
    var decision = applyReturnCondition_({
      currentStatus: String(resource.status || 'AVAILABLE'),
      inventoryType: String(resource.inventoryType || 'SERIALIZED'),
      condition: input.condition,
    });
    var now = input.returnedAt || new Date().toISOString();
    var actorId = String(ctx.auth.user.id);
    updateSheetRow_('DeliveryItems', item, {
      returnedAt: now,
      returnedBy: actorId,
      returnNotes: input.notes || '',
      returnedQuantity: typeof input.returnedQuantity === 'number' ? input.returnedQuantity : Number(item.quantity || 0),
      condition: input.condition,
      version: Number(item.version || 1) + 1,
    });
    SheetsRepository.append('ResourceMovements', {
      id: 'mov-' + Utilities.getUuid().slice(0, 8),
      organizationId: ctx.auth.organizationId,
      resourceId: String(item.resourceId),
      type: decision.movementType,
      fromLocationId: '',
      toLocationId: '',
      fromStatus: String(resource.status || ''),
      toStatus: decision.newStatus,
      quantity: item.quantity,
      actorId: actorId,
      reason: input.notes || ('Devolución ' + input.condition),
      occurredAt: now,
    });
    updateSheetRow_('Resources', resource, {
      status: decision.newStatus,
      currentDeliveryId: decision.permanentlyLost ? '' : String(item.deliveryId || resource.currentDeliveryId || ''),
      updatedAt: now,
      updatedBy: actorId,
      version: Number(resource.version || 1) + 1,
    });
    var maintenanceId;
    if (decision.autoCreateMaintenance) {
      var m = {
        id: 'mnt-' + Utilities.getUuid().slice(0, 8),
        organizationId: ctx.auth.organizationId,
        siteId: '',
        resourceId: String(item.resourceId),
        reportedBy: actorId,
        reportedAt: now,
        kind: decision.autoMaintenanceKind || 'CORRECTIVE',
        severity: decision.autoMaintenanceSeverity || 'MEDIUM',
        status: 'OPEN',
        description: input.notes
          ? 'Devuelto con daños: ' + input.notes
          : 'Devuelto con daños',
        resolution: '',
        cost: '',
        supplierId: '',
        startedAt: '',
        resolvedAt: '',
        sourceDeliveryItemId: String(item.id),
        createdAt: now,
        updatedAt: now,
        createdBy: actorId,
        updatedBy: actorId,
        version: 1,
      };
      SheetsRepository.append('Maintenance', m);
      SheetsRepository.append('MaintenanceUpdates', {
        id: 'mntu-' + Utilities.getUuid().slice(0, 8),
        organizationId: ctx.auth.organizationId,
        maintenanceId: m.id,
        authorId: actorId,
        at: now,
        kind: 'NOTE',
        text: 'Generado automáticamente al recibir el item con daños.',
        createdAt: now,
        version: 1,
      });
      maintenanceId = m.id;
      // Best-effort fan-out to the in-app notification center.
      publishMaintenanceOpenedNotification_(m, ctx);
    }
    // Recompute delivery status: if every item is now returned -> COMPLETED.
    var allItems = SheetsRepository.rows('DeliveryItems').filter(function (it) {
      return String(it.organizationId) === ctx.auth.organizationId && String(it.deliveryId) === String(item.deliveryId);
    });
    var open = allItems.filter(function (it) { return !it.returnedAt || String(it.returnedAt) === ''; }).length;
    var delivery = findDelivery_(String(item.deliveryId), ctx.auth.organizationId);
    if (delivery) {
      var nextStatus = open === 0 && allItems.length > 0 ? 'COMPLETED' : 'IN_PROGRESS';
      if (String(delivery.status) !== nextStatus) {
        updateSheetRow_('Deliveries', delivery, {
          status: nextStatus,
          updatedAt: now,
          updatedBy: actorId,
          version: Number(delivery.version || 1) + 1,
        });
      }
    }
    AuditService.record({
      organizationId: ctx.auth.organizationId,
      actorId: actorId,
      actorType: 'USER',
      action: 'operations.returnDeliveryItem',
      entityType: 'DeliveryItem',
      entityId: String(item.id),
      requestId: ctx.requestId,
      metadata: { condition: input.condition, newStatus: decision.newStatus, autoMaintenance: maintenanceId || null }
    });
    return {
      item: toDeliveryItem_(updateSheetRow_('DeliveryItems', item, {})),
      resourceId: String(item.resourceId),
      newStatus: decision.newStatus,
      maintenanceId: maintenanceId,
    };
  }

  /* ---------------- helpers ---------------- */

  function parseDeliverPayload_(payload, ctx) {
    var idempotencyKey = Validation.string(payload.idempotencyKey, 'idempotencyKey', { max: 128 });
    if (!IDEM_RE.test(idempotencyKey)) throw ApiError.badRequest('VALIDATION_ERROR', 'idempotencyKey inválido');
    var requestId = Validation.id(payload.requestId, 'requestId');
    var expectedVersion = Number(payload.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1)
      throw ApiError.badRequest('VALIDATION_ERROR', 'expectedVersion debe ser un entero positivo');
    var deliveredBy = payload.deliveredBy ? Validation.id(payload.deliveredBy, 'deliveredBy') : String(ctx.auth.user.id);
    if (String(ctx.auth.user.id) !== deliveredBy) {
      // deliveredBy must match the caller; refuse the override.
      throw ApiError.forbidden('delivery.manage');
    }
    var siteId = payload.siteId ? Validation.id(payload.siteId, 'siteId') : '';
    var recipientName = Validation.string(payload.recipientName, 'recipientName', { max: 120 });
    var notes = payload.notes ? Validation.safeText(payload.notes, 'notes', 2000) : '';
    if (!Array.isArray(payload.items) || payload.items.length === 0)
      throw ApiError.badRequest('VALIDATION_ERROR', 'items debe ser un arreglo con al menos un recurso');
    var items = payload.items.map(function (it, idx) {
      return {
        resourceId: Validation.id(it.resourceId, 'items[' + idx + '].resourceId'),
        quantity: Number(it.quantity),
      };
    }).filter(function (it) { return Number.isFinite(it.quantity) && it.quantity > 0; });
    if (items.length !== payload.items.length) {
      throw ApiError.badRequest('VALIDATION_ERROR', 'items[*].quantity debe ser numérico > 0');
    }
    return {
      idempotencyKey: idempotencyKey,
      requestId: requestId,
      expectedVersion: expectedVersion,
      deliveredBy: deliveredBy,
      deliveredAt: parseDate_(payload.deliveredAt, 'deliveredAt'),
      siteId: siteId,
      recipientName: recipientName,
      notes: notes,
      items: items,
    };
  }

  function parseReturnPayload_(payload, ctx) {
    var deliveryItemId = Validation.id(payload.deliveryItemId, 'deliveryItemId');
    var expectedVersion = Number(payload.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1)
      throw ApiError.badRequest('VALIDATION_ERROR', 'expectedVersion debe ser un entero positivo');
    var condition = Validation.enumValue(payload.condition, 'condition', RETURN_CONDITIONS);
    var returnedBy = payload.returnedBy ? Validation.id(payload.returnedBy, 'returnedBy') : String(ctx.auth.user.id);
    if (String(ctx.auth.user.id) !== returnedBy) {
      throw ApiError.forbidden('delivery.manage');
    }
    var notes = payload.notes ? Validation.safeText(payload.notes, 'notes', 1000) : '';
    var returnedQuantity = typeof payload.returnedQuantity === 'number' ? Number(payload.returnedQuantity) : null;
    return {
      deliveryItemId: deliveryItemId,
      expectedVersion: expectedVersion,
      condition: condition,
      returnedBy: returnedBy,
      returnedAt: parseDate_(payload.returnedAt, 'returnedAt'),
      returnedQuantity: returnedQuantity,
      notes: notes,
    };
  }

  /**
   * Apps Script port of `applyReturnCondition` in `src/domain/operations.ts`.
   * Keep the two implementations in sync.
   */
  function applyReturnCondition_(input) {
    switch (input.condition) {
      case 'OK':
        return {
          newStatus: 'AVAILABLE',
          movementType: 'RETURN',
          autoCreateMaintenance: false,
          permanentlyLost: false,
        };
      case 'DAMAGED':
        return {
          newStatus: 'BROKEN',
          movementType: 'RETURN',
          autoCreateMaintenance: true,
          autoMaintenanceKind: 'CORRECTIVE',
          autoMaintenanceSeverity: 'MEDIUM',
          permanentlyLost: false,
        };
      case 'LOST':
        return {
          newStatus: 'MISSING',
          movementType: 'ADJUST',
          autoCreateMaintenance: false,
          permanentlyLost: true,
        };
      default:
        return {
          newStatus: 'AVAILABLE',
          movementType: 'RETURN',
          autoCreateMaintenance: false,
          permanentlyLost: false,
        };
    }
  }

  function findDelivery_(id, organizationId) {
    return SheetsRepository.findOne('Deliveries', function (r) {
      return String(r.id) === id && String(r.organizationId) === organizationId;
    });
  }

  function findDeliveryByIdem_(key, organizationId) {
    return SheetsRepository.findOne('Deliveries', function (r) {
      return String(r.organizationId) === organizationId && String(r.idempotencyKey) === key;
    });
  }

  function findRequest_(id, organizationId) {
    return SheetsRepository.findOne('Requests', function (r) {
      return String(r.id) === id && String(r.organizationId) === organizationId;
    });
  }

  function findRequestHeader_(id, organizationId) {
    var row = findRequest_(id, organizationId);
    if (!row) return undefined;
    return {
      id: String(row.id),
      type: String(row.type || 'OTHER'),
      requesterName: String(row.requesterName || ''),
      description: String(row.description || ''),
      eventStart: row.eventStart ? String(row.eventStart) : undefined,
      eventEnd: row.eventEnd ? String(row.eventEnd) : undefined,
      siteId: row.siteId ? String(row.siteId) : undefined,
    };
  }

  function resolveResources_(items, organizationId) {
    var out = {};
    var resources = SheetsRepository.rows('Resources').filter(function (r) {
      return String(r.organizationId) === organizationId;
    });
    items.forEach(function (it) {
      var r = resources.find(function (rr) { return String(rr.id) === String(it.resourceId); });
      if (r) out[String(r.id)] = { id: String(r.id), name: String(r.name || ''), status: String(r.status || '') };
    });
    return out;
  }

  function computeProgress_(items) {
    var total = items.length;
    var returned = 0;
    var damage = 0;
    items.forEach(function (it) {
      if (it.returnedAt) {
        returned += 1;
        if (String(it.condition) === 'DAMAGED') damage += 1;
      }
    });
    return { totalItems: total, returnedItems: returned, openItems: total - returned, damageCount: damage };
  }

  function ensureVersion_(row, expectedVersion) {
    var actual = Number(row.version || 1);
    if (actual !== expectedVersion) {
      throw ApiError.conflict('VERSION_MISMATCH', 'La solicitud fue modificada por otro usuario', { expectedVersion: expectedVersion, actualVersion: actual });
    }
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

  function toDelivery_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      requestId: String(row.requestId || ''),
      deliveredBy: String(row.deliveredBy || ''),
      deliveredAt: String(row.deliveredAt || ''),
      siteId: row.siteId ? String(row.siteId) : undefined,
      recipientName: String(row.recipientName || ''),
      notes: row.notes ? String(row.notes) : undefined,
      status: String(row.status || 'IN_PROGRESS'),
      createdAt: String(row.createdAt || ''),
      updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
      createdBy: String(row.createdBy || ''),
      updatedBy: String(row.updatedBy || ''),
      version: Number(row.version || 1),
    };
  }

  function toDeliveryItem_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      deliveryId: String(row.deliveryId || ''),
      resourceId: String(row.resourceId || ''),
      quantity: Number(row.quantity || 0),
      returnedAt: row.returnedAt ? String(row.returnedAt) : undefined,
      returnedBy: row.returnedBy ? String(row.returnedBy) : undefined,
      returnNotes: row.returnNotes ? String(row.returnNotes) : undefined,
      returnedQuantity: row.returnedQuantity !== undefined && row.returnedQuantity !== '' ? Number(row.returnedQuantity) : undefined,
      condition: row.condition ? String(row.condition) : undefined,
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

  return {
    list: list,
    get: get,
    deliver: deliver,
    returnDeliveryItem: returnDeliveryItem,
    // exposed for tests so the .gs port can be unit-tested against the
    // shared truth table in src/domain/operations.ts.
    applyReturnCondition_: applyReturnCondition_,
  };

  // Best-effort fan-out to the in-app notification center. Wrapped in
  // try/catch so a notification failure never breaks the return flow.
  function publishMaintenanceOpenedNotification_(maintenanceRecord, ctx) {
    try {
      Notifications.publish(
        {
          organizationId: ctx.auth.organizationId,
          userId: null,
          kind: 'MAINTENANCE_OPENED',
          title: 'Nuevo mantenimiento abierto',
          body: String(maintenanceRecord.description || 'Devolución con daños').slice(0, 200),
          link: '/maintenance/' + String(maintenanceRecord.id),
          entityType: 'Maintenance',
          entityId: String(maintenanceRecord.id),
        },
        {
          auth: { user: { id: 'system' }, organizationId: ctx.auth.organizationId },
          requestId: ctx.requestId,
        }
      );
    } catch (e) {
      console.error('publishMaintenanceOpenedNotification_ failed: ' + e);
    }
  }
})();
