/**
 * Catalog read endpoints for Mayordomía.
 *
 * These are the data-layer reads the frontend needs to populate the app
 * after authentication and organization selection. Every endpoint:
 *   - requires auth (validates the Google access token)
 *   - requires the caller to be a member of the requested organization
 *   - returns the rows for that organization, filtered for the caller as
 *     appropriate
 *
 * Writes (create/update/delete) are intentionally out of scope for this PR.
 * They will land in their own modules once the read path is stable and the
 * concurrency rules are tested against a real spreadsheet.
 */
var Catalog = (function () {
  function organization(payload, ctx) {
    var org = SheetsRepository.findOne('Organizations', function (r) { return String(r.id) === ctx.auth.organizationId; });
    if (!org) throw ApiError.notFound('Organization');
    return { organization: toOrg_(org) };
  }

  function listOrganizations(payload, ctx) {
    // The caller is bound to a single org in this request. Return it as a
    // list of one so the API matches the multi-tenant future shape.
    return { organizations: [organization(payload, ctx).organization] };
  }

  function listSites(payload, ctx) {
    var rows = SheetsRepository.rows('Sites').filter(function (r) { return String(r.organizationId) === ctx.auth.organizationId; });
    return { sites: rows.map(toSite_) };
  }

  function listUsers(payload, ctx) {
    var rows = SheetsRepository.rows('Users').filter(function (r) { return String(r.organizationId) === ctx.auth.organizationId; });
    return { users: rows.map(toUser_) };
  }

  function listRoles(payload, ctx) {
    var rows = SheetsRepository.rows('Roles').filter(function (r) { return String(r.organizationId) === ctx.auth.organizationId; });
    return { roles: rows.map(toRole_) };
  }

  function toOrg_(row) {
    return {
      id: String(row.id),
      name: String(row.name || ''),
      timezone: String(row.timezone || 'UTC'),
      active: row.active === true || row.active === 'TRUE' || row.active === 'true',
      createdAt: row.createdAt ? String(row.createdAt) : undefined,
      updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
      version: Number(row.version || 1),
    };
  }

  function toSite_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      name: String(row.name || ''),
      address: String(row.address || ''),
      active: row.active === true || row.active === 'TRUE' || row.active === 'true',
      createdAt: row.createdAt ? String(row.createdAt) : undefined,
      updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
      version: Number(row.version || 1),
    };
  }

  function toUser_(row) {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      email: String(row.email || ''),
      name: String(row.name || ''),
      picture: row.picture ? String(row.picture) : undefined,
      status: String(row.status || 'PENDING'),
      version: Number(row.version || 1),
    };
  }

  function toRole_(row) {
    var raw = row.permissionIds;
    var permissions = [];
    if (typeof raw === 'string') permissions = raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    else if (Array.isArray(raw)) permissions = raw.map(String);
    return {
      id: String(row.id),
      organizationId: String(row.organizationId || ''),
      name: String(row.name || ''),
      permissionIds: permissions,
      version: Number(row.version || 1),
    };
  }

  return {
    organization: organization,
    listOrganizations: listOrganizations,
    listSites: listSites,
    listUsers: listUsers,
    listRoles: listRoles,
  };
})();
