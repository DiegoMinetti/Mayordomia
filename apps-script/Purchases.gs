/**
 * Ola 3b — Compras (procurement with multi-criteria scoring).
 *
 * Endpoints exposed via Router.gs. Every read/write:
 *   - scopes to ctx.auth.organizationId
 *   - requires the caller to be an ACTIVE member of the org
 *   - validates inputs (Validation.*)
 *   - records audit entries for mutations
 *   - enforces optimistic concurrency via `expectedVersion` on writes
 *
 * The scoring algorithm is intentionally duplicated from
 * `src/domain/purchasing.ts` (Apps Script can't import TS) and the two
 * implementations MUST agree — they share the same fixtures in tests
 * (see `purchasing.test.ts`).
 */
var Purchases = (function () {
  var REQUEST_STATUSES = ['DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED','COMPLETED'];
  var QUOTE_STATUSES = ['PENDING','ACCEPTED','REJECTED','WITHDRAWN'];
  var WEIGHT_KEYS = ['price','quality','delivery','warranty','supplierHistory','technicalFit'];

  // ---------------- suppliers ----------------
  function listSuppliers(payload, ctx) {
    Validation.object(payload, 'payload');
    var active = payload.active === undefined ? null : payload.active === true;
    var rows = SheetsRepository.rows('Suppliers').filter(function (r) { return String(r.organizationId) === ctx.auth.organizationId; });
    if (active !== null) rows = rows.filter(function (r) { return toBool_(r.active) === active; });
    rows.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    return { suppliers: rows.map(toSupplier_) };
  }

  function upsertSupplier(payload, ctx) {
    Validation.object(payload, 'payload');
    var id = payload.id ? Validation.id(payload.id, 'id') : Utilities.getUuid();
    var existing = id ? findSupplier_(id, ctx.auth.organizationId) : null;
    var now = new Date().toISOString();
    var name = Validation.string(payload.name, 'name', { max: 160 });
    var contactName = payload.contactName ? Validation.string(payload.contactName, 'contactName', { max: 160 }) : '';
    var email = payload.email ? Validation.email(payload.email, 'email') : '';
    var phone = payload.phone ? Validation.string(payload.phone, 'phone', { max: 60 }) : '';
    var notes = payload.notes ? Validation.safeText(payload.notes, 'notes', 1000) : '';
    var rating = payload.rating === undefined || payload.rating === null || payload.rating === '' ? null : Number(payload.rating);
    if (rating !== null && (isNaN(rating) || rating < 0 || rating > 5)) throw ApiError.badRequest('VALIDATION_ERROR', 'rating inválido');
    var active = payload.active === undefined ? true : !!payload.active;
    var expectedVersion = payload.expectedVersion === undefined ? null : Number(payload.expectedVersion);
    var userId = String(ctx.auth.user.id);
    if (existing) {
      if (expectedVersion !== null && Number(existing.version || 1) !== expectedVersion)
        throw ApiError.conflict('VERSION_MISMATCH', 'El proveedor fue modificado por otro usuario');
      var updates = {
        name: name, contactName: contactName, email: email, phone: phone, notes: notes,
        rating: rating === null ? '' : rating, active: active,
        updatedAt: now, updatedBy: userId,
        version: Number(existing.version || 1) + 1,
      };
      updateSheetRow_('Suppliers', existing, updates);
      AuditService.record({
        organizationId: ctx.auth.organizationId, actorId: userId, actorType: 'USER',
        action: 'purchase.upsertSupplier', entityType: 'Supplier', entityId: id,
        requestId: ctx.requestId, metadata: { mode: 'update', version: updates.version }
      });
      return { supplier: toSupplier_(Object.assign({}, existing, updates)) };
    }
    var record = {
      id: id, organizationId: ctx.auth.organizationId,
      name: name, contactName: contactName, email: email, phone: phone, notes: notes,
      rating: rating === null ? '' : rating, active: active,
      createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId, version: 1,
    };
    SheetsRepository.append('Suppliers', record);
    AuditService.record({
      organizationId: ctx.auth.organizationId, actorId: userId, actorType: 'USER',
      action: 'purchase.upsertSupplier', entityType: 'Supplier', entityId: id,
      requestId: ctx.requestId, metadata: { mode: 'create' }
    });
    return { supplier: toSupplier_(record) };
  }

  // ---------------- purchase requests ----------------
  function listRequests(payload, ctx) {
    Validation.object(payload, 'payload');
    var filters = parseRequestFilters_(payload);
    var rows = SheetsRepository.rows('PurchaseRequests').filter(function (r) { return String(r.organizationId) === ctx.auth.organizationId; });
    if (filters.status) rows = rows.filter(function (r) { return String(r.status) === filters.status; });
    if (filters.requesterId) rows = rows.filter(function (r) { return String(r.requesterId) === filters.requesterId; });
    if (filters.since) rows = rows.filter(function (r) { return toIso_(r.createdAt) >= filters.since; });
    if (filters.until) rows = rows.filter(function (r) { return toIso_(r.createdAt) <= filters.until; });
    rows.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    return { requests: rows.map(function (r) { return toRequestListItem_(r, indexItems_(ctx.auth.organizationId)[String(r.id)] || [], indexQuotes_(ctx.auth.organizationId)[String(r.id)] || []); }) };
  }

  function getRequest(payload, ctx) {
    Validation.object(payload, 'payload');
    var id = Validation.id(payload.id, 'id');
    var row = findRequest_(id, ctx.auth.organizationId);
    if (!row) throw ApiError.notFound('Solicitud de compra');
    var items = SheetsRepository.rows('PurchaseRequestItems').filter(function (r) { return String(r.organizationId) === ctx.auth.organizationId && String(r.purchaseRequestId) === id; });
    var quotes = SheetsRepository.rows('Quotes').filter(function (r) { return String(r.organizationId) === ctx.auth.organizationId && String(r.purchaseRequestId) === id; });
    var decisions = SheetsRepository.rows('PurchaseDecisions').filter(function (r) { return String(r.organizationId) === ctx.auth.organizationId && String(r.purchaseRequestId) === id; });
    var decision = decisions.length ? toDecision_(decisions[decisions.length - 1]) : undefined;
    return {
      request: toRequestListItem_(row, items, quotes),
      items: items.map(toItem_),
      quotes: quotes.map(function (q) { return toQuote_(q, lookupSupplierName_(q.supplierId, ctx.auth.organizationId)); }),
      decision: decision,
    };
  }

  function createRequest(payload, ctx) {
    Validation.object(payload, 'payload');
    var title = Validation.string(payload.title, 'title', { max: 200 });
    var description = payload.description ? Validation.safeText(payload.description, 'description', 4000) : '';
    var siteId = payload.siteId ? Validation.id(payload.siteId, 'siteId') : '';
    var needId = payload.needId ? Validation.id(payload.needId, 'needId') : '';
    var requesterId = payload.requesterId ? Validation.id(payload.requesterId, 'requesterId') : String(ctx.auth.user.id);
    var itemsIn = Array.isArray(payload.items) ? payload.items : [];
    if (!itemsIn.length) throw ApiError.badRequest('VALIDATION_ERROR', 'La compra debe tener al menos un ítem');
    var now = new Date().toISOString();
    var id = Utilities.getUuid();
    var userId = String(ctx.auth.user.id);
    var requestRecord = {
      id: id, organizationId: ctx.auth.organizationId,
      siteId: siteId, needId: needId,
      title: title, description: description,
      status: 'SUBMITTED', requesterId: requesterId,
      createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId, version: 1,
    };
    SheetsRepository.append('PurchaseRequests', requestRecord);
    var persistedItems = itemsIn.map(function (it) {
      var itemRecord = {
        id: Utilities.getUuid(), organizationId: ctx.auth.organizationId,
        purchaseRequestId: id,
        name: Validation.string(it.name, 'items.name', { max: 200 }),
        description: it.description ? Validation.safeText(it.description, 'items.description', 1000) : '',
        quantity: Number(it.quantity) || 0,
        unit: it.unit ? Validation.string(it.unit, 'items.unit', { max: 30 }) : 'unidad',
        estimatedCost: it.estimatedCost === undefined || it.estimatedCost === '' ? '' : Number(it.estimatedCost),
        version: 1,
      };
      if (itemRecord.quantity <= 0) throw ApiError.badRequest('VALIDATION_ERROR', 'items.quantity debe ser positivo');
      SheetsRepository.append('PurchaseRequestItems', itemRecord);
      return itemRecord;
    });
    AuditService.record({
      organizationId: ctx.auth.organizationId, actorId: userId, actorType: 'USER',
      action: 'purchase.createRequest', entityType: 'PurchaseRequest', entityId: id,
      requestId: ctx.requestId, metadata: { items: persistedItems.length }
    });
    return {
      request: toRequestListItem_(requestRecord, persistedItems, []),
      items: persistedItems.map(toItem_),
    };
  }

  // ---------------- quotes ----------------
  function listQuotes(payload, ctx) {
    Validation.object(payload, 'payload');
    var requestId = Validation.id(payload.requestId, 'requestId');
    var rows = SheetsRepository.rows('Quotes').filter(function (r) { return String(r.organizationId) === ctx.auth.organizationId && String(r.purchaseRequestId) === requestId; });
    return { quotes: rows.map(function (q) { return toQuote_(q, lookupSupplierName_(q.supplierId, ctx.auth.organizationId)); }) };
  }

  function addQuote(payload, ctx) {
    Validation.object(payload, 'payload');
    var requestId = Validation.id(payload.requestId, 'requestId');
    var request = findRequest_(requestId, ctx.auth.organizationId);
    if (!request) throw ApiError.notFound('Solicitud de compra');
    if (String(request.status) === 'CANCELLED' || String(request.status) === 'REJECTED' || String(request.status) === 'COMPLETED')
      throw ApiError.conflict('REQUEST_LOCKED', 'La solicitud no acepta cotizaciones en su estado actual');
    var supplierId = Validation.id(payload.supplierId, 'supplierId');
    var supplier = findSupplier_(supplierId, ctx.auth.organizationId);
    if (!supplier) throw ApiError.notFound('Proveedor');
    var price = Number(payload.price);
    if (!Number.isFinite(price) || price <= 0) throw ApiError.badRequest('VALIDATION_ERROR', 'price debe ser positivo');
    var currency = payload.currency ? Validation.string(payload.currency, 'currency', { max: 8 }) : 'ARS';
    var qualityScore = clampScore_(payload.qualityScore, 'qualityScore');
    var technicalFitScore = clampScore_(payload.technicalFitScore, 'technicalFitScore');
    var deliveryDays = Number(payload.deliveryDays);
    if (!Number.isInteger(deliveryDays) || deliveryDays < 0) throw ApiError.badRequest('VALIDATION_ERROR', 'deliveryDays inválido');
    var warrantyMonths = Number(payload.warrantyMonths);
    if (!Number.isInteger(warrantyMonths) || warrantyMonths < 0) throw ApiError.badRequest('VALIDATION_ERROR', 'warrantyMonths inválido');
    var notes = payload.notes ? Validation.safeText(payload.notes, 'notes', 1000) : '';
    var now = new Date().toISOString();
    var userId = String(ctx.auth.user.id);
    var id = Utilities.getUuid();
    var record = {
      id: id, organizationId: ctx.auth.organizationId,
      purchaseRequestId: requestId, supplierId: supplierId,
      price: price, currency: currency,
      qualityScore: qualityScore, deliveryDays: deliveryDays, warrantyMonths: warrantyMonths,
      technicalFitScore: technicalFitScore,
      notes: notes, status: 'PENDING',
      submittedAt: now,
      createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId, version: 1,
    };
    SheetsRepository.append('Quotes', record);
    AuditService.record({
      organizationId: ctx.auth.organizationId, actorId: userId, actorType: 'USER',
      action: 'purchase.addQuote', entityType: 'Quote', entityId: id,
      requestId: ctx.requestId, metadata: { purchaseRequestId: requestId, supplierId: supplierId, price: price }
    });
    return { quote: toQuote_(record, String(supplier.name || '')) };
  }

  // ---------------- decision ----------------
  function decide(payload, ctx) {
    Validation.object(payload, 'payload');
    var requestId = Validation.id(payload.requestId, 'purchaseRequestId');
    var request = findRequest_(requestId, ctx.auth.organizationId);
    if (!request) throw ApiError.notFound('Solicitud de compra');
    if (String(request.status) === 'CANCELLED' || String(request.status) === 'COMPLETED')
      throw ApiError.conflict('REQUEST_LOCKED', 'La solicitud no admite una nueva decisión');
    var chosenQuoteId = Validation.id(payload.chosenQuoteId, 'chosenQuoteId');
    var quotes = SheetsRepository.rows('Quotes').filter(function (r) { return String(r.organizationId) === ctx.auth.organizationId && String(r.purchaseRequestId) === requestId; });
    if (!quotes.length) throw ApiError.badRequest('VALIDATION_ERROR', 'La solicitud no tiene cotizaciones');
    var weights = parseWeights_(payload.weights);
    var assessments = quotes.map(function (q) {
      var supplier = findSupplier_(q.supplierId, ctx.auth.organizationId);
      return {
        quoteId: String(q.id),
        price: Number(q.price),
        quality: Number(q.qualityScore),
        delivery: deliveryScore_(Number(q.deliveryDays)),
        warranty: warrantyScore_(Number(q.warrantyMonths)),
        supplierHistory: supplierHistoryScore_(supplier),
        technicalFit: Number(q.technicalFitScore),
      };
    });
    var scores = scoreQuotes_(assessments, weights);
    var justification = payload.justification ? Validation.safeText(payload.justification, 'justification', 2000) : '';
    try {
      validatePurchaseDecision_(chosenQuoteId, scores, justification);
    } catch (e) {
      throw ApiError.badRequest(e.code || 'VALIDATION_ERROR', e.message);
    }
    var now = new Date().toISOString();
    var userId = String(ctx.auth.user.id);
    var decisionId = Utilities.getUuid();
    var decisionRecord = {
      id: decisionId, organizationId: ctx.auth.organizationId,
      purchaseRequestId: requestId, decidedBy: userId, decidedAt: now,
      chosenQuoteId: chosenQuoteId, justification: justification,
      weightConfig: JSON.stringify(weights),
      scores: JSON.stringify(scores),
      createdAt: now, updatedAt: now, version: 1,
    };
    SheetsRepository.append('PurchaseDecisions', decisionRecord);
    // Apply status changes to the request and the chosen quote.
    updateSheetRow_('PurchaseRequests', request, {
      status: 'APPROVED', updatedAt: now, updatedBy: userId, version: Number(request.version || 1) + 1,
    });
    quotes.forEach(function (q) {
      var isChosen = String(q.id) === chosenQuoteId;
      var newStatus = isChosen ? 'ACCEPTED' : 'REJECTED';
      updateSheetRow_('Quotes', q, {
        status: newStatus, updatedAt: now, updatedBy: userId, version: Number(q.version || 1) + 1,
      });
    });
    AuditService.record({
      organizationId: ctx.auth.organizationId, actorId: userId, actorType: 'USER',
      action: 'purchase.decide', entityType: 'PurchaseRequest', entityId: requestId,
      requestId: ctx.requestId, metadata: {
        chosenQuoteId: chosenQuoteId, decisionId: decisionId, quotes: quotes.length,
        scores: scores.map(function (s) { return s.quoteId + ':' + s.score; }).join(','),
        override: scores.length > 0 && scores[0].quoteId !== chosenQuoteId,
      }
    });
    return {
      decision: toDecision_(decisionRecord),
      scores: scores,
      weights: weights,
    };
  }

  // ---------------- helpers ----------------
  function parseRequestFilters_(payload) {
    return {
      status: payload.status ? Validation.enumValue(payload.status, 'status', REQUEST_STATUSES) : null,
      requesterId: payload.requesterId ? Validation.id(payload.requesterId, 'requesterId') : null,
      since: parseDate_(payload.since, 'since'),
      until: parseDate_(payload.until, 'until'),
    };
  }

  function parseWeights_(raw) {
    Validation.object(raw, 'weights');
    var w = {};
    WEIGHT_KEYS.forEach(function (k) {
      var v = Number(raw[k] === undefined ? 0 : raw[k]);
      if (!Number.isFinite(v) || v < 0) throw ApiError.badRequest('VALIDATION_ERROR', 'weights.' + k + ' inválido');
      w[k] = v;
    });
    return w;
  }

  function findRequest_(id, organizationId) {
    return SheetsRepository.findOne('PurchaseRequests', function (r) { return String(r.id) === id && String(r.organizationId) === organizationId; });
  }

  function findSupplier_(id, organizationId) {
    return SheetsRepository.findOne('Suppliers', function (r) { return String(r.id) === id && String(r.organizationId) === organizationId; });
  }

  function indexItems_(organizationId) {
    var map = {};
    SheetsRepository.rows('PurchaseRequestItems')
      .filter(function (r) { return String(r.organizationId) === organizationId; })
      .forEach(function (r) {
        var k = String(r.purchaseRequestId); if (!map[k]) map[k] = []; map[k].push(r);
      });
    return map;
  }

  function indexQuotes_(organizationId) {
    var map = {};
    SheetsRepository.rows('Quotes')
      .filter(function (r) { return String(r.organizationId) === organizationId; })
      .forEach(function (r) {
        var k = String(r.purchaseRequestId); if (!map[k]) map[k] = []; map[k].push(r);
      });
    return map;
  }

  function lookupSupplierName_(supplierId, organizationId) {
    if (!supplierId) return '';
    var s = findSupplier_(String(supplierId), organizationId);
    return s ? String(s.name || '') : '';
  }

  function toRequestListItem_(row, items, quotes) {
    var totalEstimated = items.reduce(function (acc, it) { return acc + (Number(it.estimatedCost) || 0) * (Number(it.quantity) || 0); }, 0);
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      siteId: row.siteId ? String(row.siteId) : undefined,
      needId: row.needId ? String(row.needId) : undefined,
      title: String(row.title || ''),
      description: row.description ? String(row.description) : undefined,
      status: String(row.status || 'DRAFT'),
      requesterId: row.requesterId ? String(row.requesterId) : undefined,
      createdAt: String(row.createdAt || ''),
      updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
      version: Number(row.version || 1),
      itemCount: items.length,
      quoteCount: quotes.length,
      estimatedTotal: totalEstimated,
    };
  }

  function toItem_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      purchaseRequestId: String(row.purchaseRequestId || ''),
      name: String(row.name || ''),
      description: row.description ? String(row.description) : undefined,
      quantity: Number(row.quantity || 0),
      unit: String(row.unit || 'unidad'),
      estimatedCost: row.estimatedCost === '' || row.estimatedCost === undefined ? undefined : Number(row.estimatedCost),
      version: Number(row.version || 1),
    };
  }

  function toQuote_(row, supplierName) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      purchaseRequestId: String(row.purchaseRequestId || ''),
      supplierId: String(row.supplierId || ''),
      supplierName: supplierName,
      price: Number(row.price || 0),
      currency: String(row.currency || 'ARS'),
      qualityScore: Number(row.qualityScore || 0),
      deliveryDays: Number(row.deliveryDays || 0),
      warrantyMonths: Number(row.warrantyMonths || 0),
      technicalFitScore: Number(row.technicalFitScore || 0),
      notes: row.notes ? String(row.notes) : undefined,
      status: String(row.status || 'PENDING'),
      submittedAt: row.submittedAt ? String(row.submittedAt) : undefined,
      version: Number(row.version || 1),
    };
  }

  function toSupplier_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      name: String(row.name || ''),
      contactName: row.contactName ? String(row.contactName) : undefined,
      email: row.email ? String(row.email) : undefined,
      phone: row.phone ? String(row.phone) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      rating: row.rating === '' || row.rating === undefined || row.rating === null ? undefined : Number(row.rating),
      active: toBool_(row.active),
      createdAt: row.createdAt ? String(row.createdAt) : undefined,
      updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
      version: Number(row.version || 1),
    };
  }

  function toDecision_(row) {
    var weights = safeJson_(row.weightConfig, null);
    var scores = safeJson_(row.scores, []);
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      purchaseRequestId: String(row.purchaseRequestId || ''),
      decidedBy: String(row.decidedBy || ''),
      decidedAt: String(row.decidedAt || ''),
      chosenQuoteId: String(row.chosenQuoteId || ''),
      justification: row.justification ? String(row.justification) : undefined,
      weightConfig: weights,
      scores: scores,
      version: Number(row.version || 1),
    };
  }

  function safeJson_(raw, fallback) {
    if (raw === null || raw === undefined || raw === '') return fallback;
    try { return JSON.parse(String(raw)); } catch (e) { return fallback; }
  }

  function toBool_(v) {
    if (v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1') return true;
    return false;
  }

  function toIso_(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toISOString();
  }

  function parseDate_(value, label) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') throw ApiError.badRequest('VALIDATION_ERROR', label + ' inválido');
    var d = new Date(value);
    if (isNaN(d.getTime())) throw ApiError.badRequest('VALIDATION_ERROR', label + ' inválido');
    return d.toISOString();
  }

  function clampScore_(value, label) {
    var n = Number(value === undefined || value === null || value === '' ? 0 : value);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw ApiError.badRequest('VALIDATION_ERROR', label + ' debe estar entre 0 y 100');
    return n;
  }

  function deliveryScore_(days) {
    if (!Number.isFinite(days) || days <= 0) return 0;
    if (days <= 3) return 100;
    if (days >= 60) return 0;
    // Linear falloff between 3 and 60 days.
    return Math.round((1 - (days - 3) / 57) * 100);
  }

  function warrantyScore_(months) {
    if (!Number.isFinite(months) || months < 0) return 0;
    if (months >= 24) return 100;
    if (months === 0) return 30;
    return Math.round((months / 24) * 100);
  }

  function supplierHistoryScore_(supplier) {
    if (!supplier) return 50;
    var rating = Number(supplier.rating || 0);
    if (!Number.isFinite(rating) || rating <= 0) return 50;
    return Math.max(0, Math.min(100, Math.round((rating / 5) * 100)));
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

  // ----------------------------------------------------------------------- //
  // Scoring algorithm (DUPLICATED from src/domain/purchasing.ts).            //
  // The two implementations MUST agree.                                     //
  // ----------------------------------------------------------------------- //

  function scoreQuotes_(quotes, weights) {
    if (!quotes.length) return [];
    var weightTotal = WEIGHT_KEYS.reduce(function (a, k) { return a + Number(weights[k] || 0); }, 0);
    if (weightTotal <= 0 || WEIGHT_KEYS.some(function (k) { return Number(weights[k] || 0) < 0; }))
      throw new Error('Weights must be non-negative and total more than zero');
    var prices = quotes.map(function (q) { return q.price; });
    if (prices.some(function (p) { return p <= 0; })) throw new Error('Prices must be positive');
    var minPrice = Math.min.apply(null, prices);
    return quotes.map(function (quote) {
      var normalized = Object.assign({}, quote, { price: (minPrice / quote.price) * 100 });
      var breakdown = {};
      var score = 0;
      WEIGHT_KEYS.forEach(function (key) {
        var value = key === 'price' ? normalized.price : Math.max(0, Math.min(100, quote[key]));
        var contribution = (value * Number(weights[key] || 0)) / weightTotal;
        breakdown[key] = { normalized: round_(value, 4), weight: Number(weights[key] || 0), contribution: round_(contribution, 4) };
        score += contribution;
      });
      return { quoteId: quote.quoteId, score: round_(score, 2), breakdown: breakdown };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  function validatePurchaseDecision_(selectedQuoteId, scores, reason) {
    var best = scores[0];
    if (!scores.some(function (s) { return s.quoteId === selectedQuoteId; })) throw new Error('Unknown quote');
    if (best && selectedQuoteId !== best.quoteId && !(reason && String(reason).trim()))
      throw new Error('A justification is required when selecting a lower-scored quote');
  }

  function round_(value, decimals) {
    var factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  return {
    listSuppliers: listSuppliers,
    upsertSupplier: upsertSupplier,
    listRequests: listRequests,
    getRequest: getRequest,
    createRequest: createRequest,
    listQuotes: listQuotes,
    addQuote: addQuote,
    decide: decide,
  };
})();
