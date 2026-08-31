var Schema = (function () {
  var VERSION = 2;
  var TABLES = {
    SchemaMeta: ['key','value','updatedAt'],
    Organizations: ['id','name','timezone','active','status','createdAt','updatedAt','createdBy','updatedBy','version'],
    Sites: ['id','organizationId','name','address','active','createdAt','updatedAt','createdBy','updatedBy','version'],
    Users: ['id','organizationId','email','name','picture','personId','status','createdAt','updatedAt','createdBy','updatedBy','version'],
    Roles: ['id','organizationId','name','permissionIds','status','createdAt','updatedAt','createdBy','updatedBy','version'],
    UserRoles: ['id','organizationId','userId','roleId','siteId','createdAt'],
    RolePermissions: ['id','organizationId','roleId','permission'],
    PublicAccessTokens: ['id','organizationId','siteId','tokenHash','status','createdAt'],
    Requests: ['id','organizationId','siteId','type','kind','requesterName','requesterEmail','description','requestedFor','source','status','eventStart','eventEnd','urgencyReason','lateReason','currentArea','createdAt','updatedAt','createdBy','updatedBy','version'],
    RequestApprovals: ['id','organizationId','requestId','scope','areaId','status','reviewedBy','reviewedAt','comment','createdAt','updatedAt','createdBy','updatedBy','version'],
    AuditLog: ['id','organizationId','actorId','actorType','action','entityType','entityId','requestId','occurredAt','metadataJson'],
    EmailQueue: ['id','organizationId','to','subject','html','dedupeKey','status','attempts','nextAttemptAt','createdAt','lastError'],
    // PR 1B — Recursos / Espacios
    Resources: ['id','organizationId','siteId','areaId','locationId','categoryId','name','description','inventoryType','status','quantity','unit','brand','model','serialNumber','internalCode','photo','purchaseDate','purchaseCost','supplierId','warrantyUntil','notes','createdAt','updatedAt','createdBy','updatedBy','version'],
    Locations: ['id','organizationId','siteId','name','description','capacity','rules','active','createdAt','updatedAt','createdBy','updatedBy','version'],
    Reservations: ['id','organizationId','kind','targetId','requestId','startAt','endAt','quantity','status','createdAt','updatedAt','createdBy','updatedBy','version'],
    ResourceMovements: ['id','organizationId','resourceId','type','fromLocationId','toLocationId','fromStatus','toStatus','quantity','actorId','reason','occurredAt'],
    // PR 1C — Eventos
    Events: ['id','organizationId','siteId','name','description','kind','startAt','endAt','allDay','recurrenceRule','parentEventId','status','createdAt','updatedAt','createdBy','updatedBy','version'],
    EventAreas: ['id','organizationId','eventId','areaId','responsibility'],
    EventResources: ['id','organizationId','eventId','resourceId','quantity'],
    EventPeople: ['id','organizationId','eventId','personId','role'],
    EventTemplates: ['id','organizationId','name','description','durationMinutes','defaultAreas','defaultResources']
  };
  function current_() { try { var row = SheetsRepository.findOne('SchemaMeta', function (r) { return r.key === 'schemaVersion'; }); return row ? Number(row.value) : 0; } catch (e) { return 0; } }
  function addColumns_(sheet, expectedHeaders) {
    if (!sheet) return;
    var lastCol = sheet.getLastColumn();
    if (lastCol === 0) { sheet.appendRow(expectedHeaders); return; }
    var existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    var existingSet = {}; existing.forEach(function (h) { existingSet[h] = true; });
    var missing = expectedHeaders.filter(function (h) { return !existingSet[h]; });
    if (!missing.length) return;
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  }
  function migrate() {
    var lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      var from = current_(); if (from >= VERSION) return { from: from, to: VERSION, changed: false };
      var db = SheetsRepository.db(); var backup = DriveApp.getFileById(db.getId()).makeCopy(db.getName() + ' backup pre-migration v' + VERSION + ' ' + new Date().toISOString());
      Object.keys(TABLES).forEach(function (name) { SheetsRepository.ensure(name, TABLES[name]); });
      // Additive: when upgrading from v1, the Requests sheet already exists with
      // the original columns. Append the new ones instead of overwriting.
      if (from > 0 && from < VERSION) {
        var requestsSheet = db.getSheetByName('Requests');
        addColumns_(requestsSheet, TABLES.Requests);
      }
      var meta = db.getSheetByName('SchemaMeta'); var values = meta.getDataRange().getValues(); var found = false;
      for (var i = 1; i < values.length; i++) if (values[i][0] === 'schemaVersion') { meta.getRange(i + 1, 2, 1, 2).setValues([[VERSION, new Date().toISOString()]]); found = true; }
      if (!found) meta.appendRow(['schemaVersion', VERSION, new Date().toISOString()]);
      AuditService.record({ actorType: 'SYSTEM', action: 'schema.migrate', entityType: 'Schema', metadata: { from: from, to: VERSION, backupFileId: backup.getId() } });
      return { from: from, to: VERSION, changed: true, backupFileId: backup.getId() };
    } finally { lock.releaseLock(); }
  }
  return { VERSION: VERSION, TABLES: TABLES, current: current_, migrate: migrate };
})();
