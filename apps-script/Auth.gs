var AuthService = (function () {
  function verifyGoogleToken_(token) {
    if (!token) throw ApiError.unauthorized();
    var response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) throw ApiError.unauthorized('Token de Google inválido o vencido');
    var profile = JSON.parse(response.getContentText());
    if (!profile.email || profile.email_verified === 'false') throw ApiError.unauthorized('Email de Google no verificado');
    return String(profile.email).toLowerCase();
  }
  function context(event, organizationId, auth) {
    var email = verifyGoogleToken_(auth && auth.accessToken);
    var user = SheetsRepository.findOne('Users', function (r) { return String(r.organizationId) === organizationId && String(r.email).toLowerCase() === email && r.status === 'ACTIVE'; });
    if (!user) throw ApiError.forbidden('organization.member');
    var assignments = SheetsRepository.rows('UserRoles').filter(function (r) { return String(r.organizationId) === organizationId && String(r.userId) === String(user.id); });
    var roleIds = assignments.map(function (r) { return String(r.roleId); });
    var permissions = SheetsRepository.rows('RolePermissions').filter(function (r) { return String(r.organizationId) === organizationId && roleIds.indexOf(String(r.roleId)) >= 0; }).map(function (r) { return String(r.permission); });
    return { user: user, organizationId: organizationId, permissions: permissions };
  }
  function requirePermission(ctx, permission) { if (ctx.permissions.indexOf(permission) < 0) throw ApiError.forbidden(permission); }
  return { context: context, requirePermission: requirePermission };
})();
