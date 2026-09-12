/**
 * Resources / Locations gateway module (PR 1B).
 *
 * Read endpoints for inventory (resources) and spaces (locations), plus the
 * reservation + movement history. Mirrors the shape of `Catalog.gs` so the
 * frontend can keep one request envelope.
 *
 * Availability checks replicate the frontend's `findReservationConflicts`
 * rule so the client and the server agree on the same overlap semantics.
 * Writes (create/update) stay out of scope for this PR — they will land
 * once optimistic concurrency and the test sheet are in place.
 */
var Resources = (function () {
  function list(payload, ctx) {
    var filters = payload || {};
    var rows = SheetsRepository.rows('Resources').filter(function (r) { return String(r.organizationId) === ctx.auth.organizationId; });
    if (filters.siteId) rows = rows.filter(function (r) { return String(r.siteId) === String(filters.siteId); });
    if (filters.areaId) rows = rows.filter(function (r) { return String(r.areaId) === String(filters.areaId); });
    if (filters.status) rows = rows.filter(function (r) { return String(r.status) === String(filters.status); });
    if (filters.kind) rows = rows.filter(function (r) { return String(r.inventoryType) === String(filters.kind); });
    return { resources: rows.map(toResource_) };
  }

  function get(payload, ctx) {
    var data = Validation.object(payload);
    var id = Validation.id(data.id, 'id');
    var row = SheetsRepository.findOne('Resources', function (r) {
      return String(r.organizationId) === ctx.auth.organizationId && String(r.id) === id;
    });
    if (!row) throw ApiError.notFound('Recurso');
    var movements = SheetsRepository.rows('ResourceMovements')
      .filter(function (m) { return String(m.organizationId) === ctx.auth.organizationId && String(m.resourceId) === id; })
      .sort(byOccurredAtDesc_)
      .slice(0, 10);
    return { resource: toResource_(row), movements: movements.map(toMovement_) };
  }

  function listLocations(payload, ctx) {
    var filters = payload || {};
    var rows = SheetsRepository.rows('Locations').filter(function (r) { return String(r.organizationId) === ctx.auth.organizationId; });
    if (filters.siteId) rows = rows.filter(function (r) { return String(r.siteId) === String(filters.siteId); });
    if (filters.active !== undefined) {
      var wantActive = filters.active === true || filters.active === 'TRUE' || filters.active === 'true';
      rows = rows.filter(function (r) { return (r.active === true || r.active === 'TRUE' || r.active === 'true') === wantActive; });
    }
    return { locations: rows.map(toLocation_) };
  }

  function getLocation(payload, ctx) {
    var data = Validation.object(payload);
    var id = Validation.id(data.id, 'id');
    var row = SheetsRepository.findOne('Locations', function (r) {
      return String(r.organizationId) === ctx.auth.organizationId && String(r.id) === id;
    });
    if (!row) throw ApiError.notFound('Espacio');
    return { location: toLocation_(row) };
  }

  function listReservations(payload, ctx) {
    var filters = payload || {};
    var rows = SheetsRepository.rows('Reservations').filter(function (r) { return String(r.organizationId) === ctx.auth.organizationId; });
    if (filters.targetId) rows = rows.filter(function (r) { return String(r.targetId) === String(filters.targetId); });
    if (filters.kind) rows = rows.filter(function (r) { return String(r.kind) === String(filters.kind); });
    if (filters.status) rows = rows.filter(function (r) { return String(r.status) === String(filters.status); });
    if (filters.startAfter) rows = rows.filter(function (r) { return new Date(r.endAt) > new Date(filters.startAfter); });
    if (filters.endBefore) rows = rows.filter(function (r) { return new Date(r.startAt) < new Date(filters.endBefore); });
    rows = rows.sort(byStartAtAsc_);
    return { reservations: rows.map(toReservation_) };
  }

  function listMovements(payload, ctx) {
    var filters = payload || {};
    var rows = SheetsRepository.rows('ResourceMovements').filter(function (r) { return String(r.organizationId) === ctx.auth.organizationId; });
    if (filters.resourceId) rows = rows.filter(function (r) { return String(r.resourceId) === String(filters.resourceId); });
    rows = rows.sort(byOccurredAtDesc_);
    if (typeof filters.limit === 'number') rows = rows.slice(0, filters.limit);
    return { movements: rows.map(toMovement_) };
  }

  function checkAvailability(payload, ctx) {
    var items = (payload && payload.items) || [];
    if (!Array.isArray(items)) throw ApiError.badRequest('INVALID_PAYLOAD', 'items debe ser un arreglo');
    var result = { available: { resource: {}, location: {} }, conflicts: [] };
    var reservations = SheetsRepository.rows('Reservations').filter(function (r) { return String(r.organizationId) === ctx.auth.organizationId; });
    var resources = SheetsRepository.rows('Resources').filter(function (r) { return String(r.organizationId) === ctx.auth.organizationId; });
    var locations = SheetsRepository.rows('Locations').filter(function (r) { return String(r.organizationId) === ctx.auth.organizationId; });
    items.forEach(function (item) {
      var start = new Date(item.startAt);
      var end = new Date(item.endAt);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
        var conflict = { code: 'INVALID_INTERVAL', item: item };
        result.conflicts.push(conflict);
        if (item.resourceId) result.available.resource[item.resourceId] = false;
        if (item.locationId) result.available.location[item.locationId] = false;
        return;
      }
      if (item.resourceId) {
        var resource = resources.find(function (r) { return String(r.id) === String(item.resourceId); });
        if (!resource) {
          result.conflicts.push({ code: 'NOT_FOUND', target: 'resource', item: item });
          result.available.resource[item.resourceId] = false;
          return;
        }
        if (['MAINTENANCE', 'BROKEN', 'MISSING', 'RETIRED'].indexOf(String(resource.status)) >= 0) {
          result.conflicts.push({ code: 'UNAVAILABLE_RESOURCE', resourceId: resource.id, item: item });
          result.available.resource[item.resourceId] = false;
          return;
        }
        var concurrent = reservations.filter(function (r) {
          return String(r.targetId) === String(item.resourceId) && r.status !== 'CANCELLED' && overlaps_(r.startAt, r.endAt, item.startAt, item.endAt);
        });
        if (String(resource.inventoryType) === 'SERIALIZED') {
          if (concurrent.length) {
            result.conflicts.push({ code: 'SERIALIZED_OVERLAP', resourceId: resource.id, reservationIds: concurrent.map(function (r) { return String(r.id); }), item: item });
            result.available.resource[item.resourceId] = false;
            return;
          }
          result.available.resource[item.resourceId] = true;
          return;
        }
        var available = Number(resource.quantity || 0) - concurrent.reduce(function (sum, r) { return sum + Number(r.quantity || 0); }, 0);
        var wanted = Number(item.quantity || 1);
        if (wanted > available) {
          result.conflicts.push({ code: 'INSUFFICIENT_QUANTITY', resourceId: resource.id, available: available, wanted: wanted, reservationIds: concurrent.map(function (r) { return String(r.id); }), item: item });
          result.available.resource[item.resourceId] = false;
          return;
        }
        result.available.resource[item.resourceId] = true;
      }
      if (item.locationId) {
        var location = locations.find(function (l) { return String(l.id) === String(item.locationId); });
        if (!location) {
          result.conflicts.push({ code: 'NOT_FOUND', target: 'location', item: item });
          result.available.location[item.locationId] = false;
          return;
        }
        var concurrentLoc = reservations.filter(function (r) {
          return String(r.targetId) === String(item.locationId) && r.status !== 'CANCELLED' && overlaps_(r.startAt, r.endAt, item.startAt, item.endAt);
        });
        if (concurrentLoc.length) {
          result.conflicts.push({ code: 'LOCATION_OVERLAP', locationId: location.id, reservationIds: concurrentLoc.map(function (r) { return String(r.id); }), item: item });
          result.available.location[item.locationId] = false;
          return;
        }
        result.available.location[item.locationId] = true;
      }
    });
    return result;
  }

  function overlaps_(aStart, aEnd, bStart, bEnd) {
    return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
  }

  function byOccurredAtDesc_(a, b) {
    return new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0);
  }

  function byStartAtAsc_(a, b) {
    return new Date(a.startAt || 0) - new Date(b.startAt || 0);
  }

  function toResource_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      siteId: row.siteId ? String(row.siteId) : undefined,
      areaId: row.areaId ? String(row.areaId) : undefined,
      locationId: row.locationId ? String(row.locationId) : undefined,
      categoryId: row.categoryId ? String(row.categoryId) : undefined,
      name: String(row.name || ''),
      description: row.description ? String(row.description) : undefined,
      inventoryType: String(row.inventoryType || 'SERIALIZED'),
      status: String(row.status || 'AVAILABLE'),
      quantity: Number(row.quantity || 0),
      unit: String(row.unit || 'unidad'),
      brand: row.brand ? String(row.brand) : undefined,
      model: row.model ? String(row.model) : undefined,
      serialNumber: row.serialNumber ? String(row.serialNumber) : undefined,
      internalCode: row.internalCode ? String(row.internalCode) : undefined,
      photo: row.photo ? String(row.photo) : undefined,
      purchaseDate: row.purchaseDate ? String(row.purchaseDate) : undefined,
      purchaseCost: row.purchaseCost !== undefined && row.purchaseCost !== '' ? Number(row.purchaseCost) : undefined,
      supplierId: row.supplierId ? String(row.supplierId) : undefined,
      warrantyUntil: row.warrantyUntil ? String(row.warrantyUntil) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      createdAt: row.createdAt ? String(row.createdAt) : undefined,
      updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
      version: Number(row.version || 1),
    };
  }

  function toLocation_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      siteId: row.siteId ? String(row.siteId) : undefined,
      name: String(row.name || ''),
      description: row.description ? String(row.description) : undefined,
      capacity: row.capacity !== undefined && row.capacity !== '' ? Number(row.capacity) : undefined,
      rules: row.rules ? String(row.rules) : undefined,
      active: row.active === true || row.active === 'TRUE' || row.active === 'true',
      createdAt: row.createdAt ? String(row.createdAt) : undefined,
      updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
      version: Number(row.version || 1),
    };
  }

  function toReservation_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      kind: String(row.kind || 'RESOURCE'),
      targetId: String(row.targetId || ''),
      requestId: String(row.requestId || ''),
      startAt: String(row.startAt || ''),
      endAt: String(row.endAt || ''),
      quantity: Number(row.quantity || 0),
      status: String(row.status || 'PENDING_RESERVATION'),
      createdAt: row.createdAt ? String(row.createdAt) : undefined,
      updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
      version: Number(row.version || 1),
    };
  }

  function toMovement_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      resourceId: String(row.resourceId || ''),
      type: String(row.type || 'ADJUST'),
      fromLocationId: row.fromLocationId ? String(row.fromLocationId) : undefined,
      toLocationId: row.toLocationId ? String(row.toLocationId) : undefined,
      fromStatus: row.fromStatus ? String(row.fromStatus) : undefined,
      toStatus: row.toStatus ? String(row.toStatus) : undefined,
      quantity: row.quantity !== undefined && row.quantity !== '' ? Number(row.quantity) : undefined,
      actorId: row.actorId ? String(row.actorId) : undefined,
      reason: row.reason ? String(row.reason) : undefined,
      occurredAt: String(row.occurredAt || ''),
    };
  }

  return {
    list: list,
    get: get,
    listLocations: listLocations,
    getLocation: getLocation,
    listReservations: listReservations,
    listMovements: listMovements,
    checkAvailability: checkAvailability,
  };
})();
