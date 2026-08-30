var AuditService = (function () {
  function record(entry) {
    try { SheetsRepository.append('AuditLog', { id: Utilities.getUuid(), organizationId: entry.organizationId || '', actorId: entry.actorId || '', actorType: entry.actorType || 'SYSTEM', action: entry.action, entityType: entry.entityType || '', entityId: entry.entityId || '', requestId: entry.requestId || '', occurredAt: new Date().toISOString(), metadataJson: JSON.stringify(entry.metadata || {}) }); }
    catch (error) { console.error('AUDIT_WRITE_FAILED', error); }
  }
  return { record: record };
})();
