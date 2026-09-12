var AuthService = (function () {
  function verifyGoogleToken_(token) {
    if (!token) throw ApiError.unauthorized();
    var response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) throw ApiError.unauthorized('Token de Google inválido o vencido');
    var profile = JSON.parse(response.getContentText());
    if (!profile.email || profile.email_verified === 'false') throw ApiError.unauthorized('Email de Google no verificado');
    return String(profile.email).toLowerCase();
  }
  /**
   * Verifies the Google access token and returns the caller's identity profile.
   * Unlike `context`, this does NOT require the user to already be a member of
   * any organization. It is used by the bootstrap flow for the very first
   * user of a new organization.
   */
  function verifyIdentity(auth) {
    var token = auth && auth.accessToken;
    var email = verifyGoogleToken_(token);
    var response = UrlFetchApp.fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    var profile = response.getResponseCode() === 200 ? JSON.parse(response.getContentText()) : {};
    return {
      email: email,
      name: profile.name || '',
      picture: profile.picture || '',
      sub: profile.sub || '',
    };
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
  return { context: context, requirePermission: requirePermission, verifyIdentity: verifyIdentity };
})();
