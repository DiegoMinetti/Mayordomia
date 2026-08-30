var PublicRequests = (function () {
  function tokenHash_(token) {
    var pepper = AppConfig.requireValue(AppConfig.KEYS.publicPepper);
    return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token + pepper));
  }
  function create(payload, context) {
    var data = Validation.publicRequest(payload);
    // Apps Script web apps do not expose a trustworthy client IP. Limit by public
    // entry point, never by a caller-controlled "client id".
    RateLimit.assertAllowed(data.publicToken, 20, 600);
    var tokenHash = tokenHash_(data.publicToken);
    var access = SheetsRepository.findOne('PublicAccessTokens', function (r) { return String(r.tokenHash) === tokenHash && r.status === 'ACTIVE'; });
    if (!access) throw ApiError.notFound('Acceso público');
    var id = Utilities.getUuid();
    SheetsRepository.append('Requests', { id: id, organizationId: access.organizationId, siteId: access.siteId, type: data.type, requesterName: data.requesterName, requesterEmail: data.requesterEmail, description: data.description, requestedFor: data.requestedFor, source: 'PUBLIC_QR', status: 'PENDING', createdAt: new Date().toISOString() });
    AuditService.record({ organizationId: access.organizationId, actorType: 'PUBLIC', action: 'request.createPublic', entityType: 'Request', entityId: id, requestId: context.requestId });
    return { id: id, status: 'PENDING' };
  }
  return { create: create };
})();
