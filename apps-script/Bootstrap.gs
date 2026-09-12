/**
 * Bootstrap and discovery for Mayordomía.
 *
 * `bootstrap.organization` provisions a new organization for the calling user:
 *   - Creates the "Mayordomia" root folder in the owner's Drive (or reuses one).
 *   - Creates the "Mayordomia DB" spreadsheet (or reuses the configured one).
 *   - Migrates the schema.
 *   - Creates the Organization row, the first Site (optional), the base
 *     Permissions, the SUPER_ADMIN role, and the first ACTIVE User with the role.
 *   - Writes a JSON descriptor file at the root of the org folder so other
 *     members can discover the org by Drive search once they are granted access
 *     to the folder.
 *
 * The ceremony is one-shot per Google account: if a descriptor already exists
 * for the caller's account, we return it instead of creating a duplicate.
 *
 * `org.listMine` searches the caller's accessible Drive for descriptor files
 * and returns the list of orgs the user could pick.
 */
var Bootstrap = (function () {
  var DESCRIPTOR_NAME = 'mayordomia-descriptor.json';
  var SCHEMA_VERSION = 1;
  var ROOT_FOLDER_NAME = 'Mayordomia';
  var DB_FILE_NAME = 'Mayordomia DB';

  var BASE_PERMISSIONS = [
    'organization.manage', 'site.view', 'site.manage',
    'user.view', 'user.manage', 'role.manage',
    'area.view', 'area.manage',
    'resource.view', 'resource.create', 'resource.update', 'resource.retire',
    'request.create', 'request.view', 'request.review', 'request.approve.area', 'request.approve.general', 'request.reject',
    'event.view', 'event.create', 'event.manage',
    'reservation.manage',
    'delivery.manage', 'return.manage',
    'maintenance.view', 'maintenance.manage',
    'need.create', 'need.manage',
    'purchase.request', 'purchase.review', 'purchase.approve', 'purchase.manage',
    'quote.create', 'quote.review',
    'supplier.manage',
    'calendar.view', 'calendar.manage',
    'notification.manage', 'audit.view', 'config.manage',
  ];

  function organization(payload, ctx) {
    Validation.object(payload, 'payload');
    var orgName = Validation.string(payload.organizationName, 'organizationName', { min: 1, max: 120 });
    var timezone = Validation.string(payload.timezone || 'UTC', 'timezone', { max: 80 });
    var siteName = payload.siteName ? Validation.string(payload.siteName, 'siteName', { max: 120 }) : null;
    var siteAddress = payload.siteAddress ? Validation.string(payload.siteAddress, 'siteAddress', { max: 240 }) : null;
    if (!ctx.identity) throw ApiError.unauthorized('Identity required to bootstrap');

    var adminEmail = String(ctx.identity.email).toLowerCase();

    // 1. Reuse the root folder if the same caller already bootstrapped.
    var existing = findDescriptorForEmail_(adminEmail);
    if (existing) return existing;

    // 2. Find or create the root folder in the owner's Drive.
    var rootFolder = findOrCreateRootFolder_();
    // 3. Find or create the database spreadsheet and put it in the root folder.
    var dbId = ensureDatabase_(rootFolder);
    // 4. Migrate schema (idempotent).
    Schema.migrate();
    // 5. Find or create the Organization row.
    var org = findOrCreateOrganization_(orgName, timezone);
    org.ownerEmail = adminEmail;
    // 6. Optionally create the first site.
    var site = siteName ? findOrCreateSite_(org.id, siteName, siteAddress) : null;
    // 7. Create base permissions and SUPER_ADMIN role.
    var permissionIds = ensurePermissions_();
    var role = ensureRole_(org.id, 'SUPER_ADMIN', permissionIds);
    // 8. Create the first user and assign the role.
    var user = ensureUser_(org.id, adminEmail, ctx.identity);
    ensureUserRole_(org.id, user.id, role.id);
    // 9. Write the descriptor at the root of the org folder.
    var descriptor = writeDescriptor_(rootFolder, org, dbId);
    descriptor.site = site;
    descriptor.isFirstUser = true;
    return descriptor;
  }

  function listMine(payload, ctx) {
    if (!ctx.identity) throw ApiError.unauthorized();
    var adminEmail = String(ctx.identity.email).toLowerCase();
    var files = DriveApp.searchFiles('title contains "' + DESCRIPTOR_NAME + '" and trashed = false');
    var results = [];
    while (files.hasNext()) {
      var file = files.next();
      try {
        var json = JSON.parse(file.getBlob().getDataAsString());
        if (!json.organizationId || !json.rootFolderId || !json.databaseFileId) continue;
        results.push({
          organizationId: json.organizationId,
          name: json.name || 'Organización',
          rootFolderId: json.rootFolderId,
          databaseFileId: json.databaseFileId,
          schemaVersion: json.schemaVersion || 1,
          isOwner: adminEmail === String(json.ownerEmail || '').toLowerCase(),
        });
      } catch (e) {
        // skip malformed descriptor
      }
    }
    return { organizations: results };
  }

  // ---------- private helpers ----------

  function findDescriptorForEmail_(email) {
    var files = DriveApp.searchFiles('title contains "' + DESCRIPTOR_NAME + '" and trashed = false');
    while (files.hasNext()) {
      var f = files.next();
      try {
        var json = JSON.parse(f.getBlob().getDataAsString());
        if (String(json.ownerEmail || '').toLowerCase() === email) return json;
      } catch (e) { /* skip */ }
    }
    return null;
  }

  function findOrCreateRootFolder_() {
    var folders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
    while (folders.hasNext()) {
      var f = folders.next();
      if (!f.isTrashed()) return f;
    }
    return DriveApp.createFolder(ROOT_FOLDER_NAME);
  }

  function ensureDatabase_(rootFolder) {
    var existing = AppConfig.get(AppConfig.KEYS.databaseId);
    if (existing) {
      try { SpreadsheetApp.openById(existing); return existing; } catch (e) { /* fall through and recreate */ }
    }
    var db = SpreadsheetApp.create(DB_FILE_NAME);
    DriveApp.getFileById(db.getId()).moveTo(rootFolder);
    var props = PropertiesService.getScriptProperties();
    props.setProperty(AppConfig.KEYS.databaseId, db.getId());
    props.setProperty(AppConfig.KEYS.rootFolderId, rootFolder.getId());
    return db.getId();
  }

  function findOrCreateOrganization_(name, timezone) {
    var existing = SheetsRepository.findOne('Organizations', function (r) { return String(r.name) === name; });
    if (existing) return existing;
    var id = Utilities.getUuid();
    var now = new Date().toISOString();
    SheetsRepository.append('Organizations', { id: id, name: name, timezone: timezone, active: true, createdAt: now, updatedAt: now, createdBy: 'bootstrap', updatedBy: 'bootstrap', version: 1 });
    return { id: id, name: name, timezone: timezone };
  }

  function findOrCreateSite_(organizationId, name, address) {
    var existing = SheetsRepository.findOne('Sites', function (r) { return String(r.organizationId) === organizationId && String(r.name) === name; });
    if (existing) return existing;
    var id = Utilities.getUuid();
    var now = new Date().toISOString();
    SheetsRepository.append('Sites', { id: id, organizationId: organizationId, name: name, address: address || '', createdAt: now, updatedAt: now, createdBy: 'bootstrap', updatedBy: 'bootstrap', version: 1 });
    return { id: id, organizationId: organizationId, name: name };
  }

  function ensurePermissions_() {
    var ids = [];
    for (var i = 0; i < BASE_PERMISSIONS.length; i++) {
      var key = BASE_PERMISSIONS[i];
      var existing = SheetsRepository.findOne('Permissions', function (r) { return String(r.key) === key; });
      if (existing) { ids.push(String(existing.id)); continue; }
      var id = Utilities.getUuid();
      SheetsRepository.append('Permissions', { id: id, key: key });
      ids.push(id);
    }
    return ids;
  }

  function ensureRole_(organizationId, name, permissionIds) {
    var existing = SheetsRepository.findOne('Roles', function (r) { return String(r.organizationId) === organizationId && String(r.name) === name; });
    if (existing) return existing;
    var id = Utilities.getUuid();
    var now = new Date().toISOString();
    SheetsRepository.append('Roles', { id: id, organizationId: organizationId, name: name, permissionIds: permissionIds.join(','), createdAt: now, updatedAt: now, createdBy: 'bootstrap', updatedBy: 'bootstrap', version: 1 });
    return { id: id, name: name };
  }

  function ensureUser_(organizationId, email, identity) {
    var existing = SheetsRepository.findOne('Users', function (r) { return String(r.organizationId) === organizationId && String(r.email).toLowerCase() === email; });
    if (existing) return existing;
    var id = Utilities.getUuid();
    var now = new Date().toISOString();
    SheetsRepository.append('Users', { id: id, organizationId: organizationId, email: email, name: identity.name || '', picture: identity.picture || '', status: 'ACTIVE', createdAt: now, updatedAt: now, createdBy: 'bootstrap', updatedBy: 'bootstrap', version: 1 });
    return { id: id, email: email };
  }

  function ensureUserRole_(organizationId, userId, roleId) {
    var existing = SheetsRepository.findOne('UserRoles', function (r) { return String(r.organizationId) === organizationId && String(r.userId) === userId; });
    if (existing) return existing;
    SheetsRepository.append('UserRoles', { id: Utilities.getUuid(), organizationId: organizationId, userId: userId, roleId: roleId, createdAt: new Date().toISOString() });
  }

  function writeDescriptor_(rootFolder, org, dbId) {
    var descriptor = {
      organizationId: org.id,
      name: org.name,
      rootFolderId: rootFolder.getId(),
      databaseFileId: dbId,
      schemaVersion: SCHEMA_VERSION,
      ownerEmail: org.ownerEmail || '',
      createdAt: new Date().toISOString(),
    };
    var existing = rootFolder.getFilesByName(DESCRIPTOR_NAME);
    if (existing.hasNext()) {
      var f = existing.next();
      f.setContent(JSON.stringify(descriptor, null, 2));
      return descriptor;
    }
    rootFolder.createFile(DESCRIPTOR_NAME, JSON.stringify(descriptor, null, 2), 'application/json');
    return descriptor;
  }

  return { organization: organization, listMine: listMine };
})();
