/**
 * Events gateway module.
 *
 * Read endpoints for the Events domain. All handlers:
 *  - require auth (caller is a member of the requested org)
 *  - scope every read by the caller's organizationId
 *  - never expose a row from another org
 *
 * Write endpoints (create/update/cancel) are intentionally out of scope for
 * this PR. The schema already includes the columns they will need.
 */
var Events = (function () {
  var KINDS = ['SERVICE', 'REHEARSAL', 'CLASS', 'MEETING', 'OTHER'];
  var STATUSES = ['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'];

  function list(payload, ctx) {
    var filters = normalizeFilters_(payload);
    var rows = SheetsRepository.rows('Events').filter(function (r) {
      return String(r.organizationId) === ctx.auth.organizationId;
    });
    rows = rows.filter(function (r) { return matchesFilters_(r, filters); });
    rows.sort(function (a, b) { return String(a.startAt).localeCompare(String(b.startAt)); });
    return { events: rows.map(toEvent_) };
  }

  function get(payload, ctx) {
    Validation.object(payload, 'payload');
    var id = Validation.id(payload.id, 'id');
    var row = SheetsRepository.findOne('Events', function (r) {
      return String(r.id) === id && String(r.organizationId) === ctx.auth.organizationId;
    });
    if (!row) throw ApiError.notFound('Evento');
    var event = toEvent_(row);
    var areas = SheetsRepository.rows('EventAreas').filter(function (r) {
      return String(r.eventId) === id && String(r.organizationId) === ctx.auth.organizationId;
    }).map(toEventArea_);
    var resources = SheetsRepository.rows('EventResources').filter(function (r) {
      return String(r.eventId) === id && String(r.organizationId) === ctx.auth.organizationId;
    }).map(toEventResource_);
    var people = SheetsRepository.rows('EventPeople').filter(function (r) {
      return String(r.eventId) === id && String(r.organizationId) === ctx.auth.organizationId;
    }).map(toEventPerson_);
    var template = null;
    if (row.parentEventId) {
      var tpl = SheetsRepository.findOne('EventTemplates', function (r) {
        return String(r.id) === String(row.parentEventId) && String(r.organizationId) === ctx.auth.organizationId;
      });
      if (tpl) template = toEventTemplate_(tpl);
    }
    return { event: Object.assign({}, event, { areas: areas, resources: resources, people: people, template: template }) };
  }

  function upcoming(payload, ctx) {
    var days = payload && payload.days ? Math.max(1, Math.min(90, Number(payload.days))) : 14;
    var now = new Date();
    var horizon = new Date(now.getTime() + days * 86400000);
    var rows = SheetsRepository.rows('Events').filter(function (r) {
      if (String(r.organizationId) !== ctx.auth.organizationId) return false;
      if (r.status === 'CANCELLED') return false;
      var end = new Date(r.endAt);
      return end.getTime() >= now.getTime() && end.getTime() <= horizon.getTime();
    });
    rows.sort(function (a, b) { return String(a.startAt).localeCompare(String(b.startAt)); });
    return { events: rows.map(toEvent_) };
  }

  function toEvent_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      siteId: row.siteId ? String(row.siteId) : undefined,
      name: String(row.name || ''),
      description: row.description ? String(row.description) : undefined,
      kind: String(row.kind || 'OTHER'),
      startAt: String(row.startAt || ''),
      endAt: String(row.endAt || ''),
      allDay: row.allDay === true || row.allDay === 'TRUE' || row.allDay === 'true',
      recurrenceRule: row.recurrenceRule ? String(row.recurrenceRule) : undefined,
      parentEventId: row.parentEventId ? String(row.parentEventId) : undefined,
      status: String(row.status || 'DRAFT'),
      createdAt: String(row.createdAt || ''),
      createdBy: String(row.createdBy || ''),
      updatedAt: String(row.updatedAt || ''),
      updatedBy: String(row.updatedBy || ''),
      version: Number(row.version || 1)
    };
  }

  function toEventArea_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      eventId: String(row.eventId || ''),
      areaId: String(row.areaId || ''),
      responsibility: String(row.responsibility || 'SUPPORT')
    };
  }

  function toEventResource_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      eventId: String(row.eventId || ''),
      resourceId: String(row.resourceId || ''),
      quantity: Number(row.quantity || 0)
    };
  }

  function toEventPerson_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      eventId: String(row.eventId || ''),
      personId: String(row.personId || ''),
      role: String(row.role || 'ATTENDEE')
    };
  }

  function toEventTemplate_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      name: String(row.name || ''),
      description: row.description ? String(row.description) : undefined,
      durationMinutes: Number(row.durationMinutes || 0),
      defaultAreas: parseList_(row.defaultAreas),
      defaultResources: parseMap_(row.defaultResources)
    };
  }

  function parseList_(raw) {
    if (!raw) return undefined;
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === 'string') {
      var trimmed = raw.trim();
      if (!trimmed) return undefined;
      try {
        var parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch (e) { /* fallthrough */ }
      return trimmed.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }
    return undefined;
  }

  function parseMap_(raw) {
    if (!raw) return undefined;
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      var out = {};
      Object.keys(raw).forEach(function (k) { out[String(k)] = Number(raw[k]) || 0; });
      return out;
    }
    if (typeof raw === 'string') {
      var trimmed = raw.trim();
      if (!trimmed) return undefined;
      try { return JSON.parse(trimmed); } catch (e) { return undefined; }
    }
    return undefined;
  }

  function normalizeFilters_(payload) {
    if (!payload || typeof payload !== 'object') return {};
    var f = {};
    if (payload.siteId) f.siteId = String(payload.siteId);
    if (payload.status) f.status = Validation.enumValue(payload.status, 'status', STATUSES);
    if (payload.kind) f.kind = Validation.enumValue(payload.kind, 'kind', KINDS);
    if (payload.startAfter) f.startAfter = String(payload.startAfter);
    if (payload.endBefore) f.endBefore = String(payload.endBefore);
    return f;
  }

  function matchesFilters_(row, f) {
    if (f.siteId && String(row.siteId) !== f.siteId) return false;
    if (f.status && String(row.status) !== f.status) return false;
    if (f.kind && String(row.kind) !== f.kind) return false;
    if (f.startAfter && String(row.startAt) < f.startAfter) return false;
    if (f.endBefore && String(row.endAt) > f.endBefore) return false;
    return true;
  }

  return { list: list, get: get, upcoming: upcoming };
})();
