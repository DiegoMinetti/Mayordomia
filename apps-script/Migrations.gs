var Schema = (function () {
  var VERSION = 1;
  var TABLES = {
    SchemaMeta: ['key','value','updatedAt'],
    Organizations: ['id','name','timezone','active','status','createdAt','updatedAt','createdBy','updatedBy','version'],
    Sites: ['id','organizationId','name','address','active','createdAt','updatedAt','createdBy','updatedBy','version'],
    Users: ['id','organizationId','email','name','picture','personId','status','createdAt','updatedAt','createdBy','updatedBy','version'],
    Roles: ['id','organizationId','name','permissionIds','status','createdAt','updatedAt','createdBy','updatedBy','version'],
    UserRoles: ['id','organizationId','userId','roleId','siteId','createdAt'],
    RolePermissions: ['id','organizationId','roleId','permission'],
    PublicAccessTokens: ['id','organizationId','siteId','tokenHash','status','createdAt'],
    Requests: ['id','organizationId','siteId','type','requesterName','requesterEmail','description','requestedFor','source','status','createdAt'],
    AuditLog: ['id','organizationId','actorId','actorType','action','entityType','entityId','requestId','occurredAt','metadataJson'],
    EmailQueue: ['id','organizationId','to','subject','html','dedupeKey','status','attempts','nextAttemptAt','createdAt','lastError']
  };
  function current_() { try { var row = SheetsRepository.findOne('SchemaMeta', function (r) { return r.key === 'schemaVersion'; }); return row ? Number(row.value) : 0; } catch (e) { return 0; } }
  function migrate() {
    var lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      var from = current_(); if (from >= VERSION) return { from: from, to: VERSION, changed: false };
      var db = SheetsRepository.db(); var backup = DriveApp.getFileById(db.getId()).makeCopy(db.getName() + ' backup pre-migration v' + VERSION + ' ' + new Date().toISOString());
      Object.keys(TABLES).forEach(function (name) { SheetsRepository.ensure(name, TABLES[name]); });
      var meta = db.getSheetByName('SchemaMeta'); var values = meta.getDataRange().getValues(); var found = false;
      for (var i = 1; i < values.length; i++) if (values[i][0] === 'schemaVersion') { meta.getRange(i + 1, 2, 1, 2).setValues([[VERSION, new Date().toISOString()]]); found = true; }
      if (!found) meta.appendRow(['schemaVersion', VERSION, new Date().toISOString()]);
      AuditService.record({ actorType: 'SYSTEM', action: 'schema.migrate', entityType: 'Schema', metadata: { from: from, to: VERSION, backupFileId: backup.getId() } });
      return { from: from, to: VERSION, changed: true, backupFileId: backup.getId() };
    } finally { lock.releaseLock(); }
  }
  return { VERSION: VERSION, TABLES: TABLES, current: current_, migrate: migrate };
})();
