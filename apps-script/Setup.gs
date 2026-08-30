/** Run once from the Apps Script editor as the deployment owner. */
function initializeMayordomiaGateway() {
  var props = PropertiesService.getScriptProperties();
  var dbId = props.getProperty(AppConfig.KEYS.databaseId);
  if (!dbId) {
    var root = DriveApp.createFolder('Mayordomia');
    var database = SpreadsheetApp.create('Mayordomia DB');
    DriveApp.getFileById(database.getId()).moveTo(root);
    props.setProperties({ DATABASE_SPREADSHEET_ID: database.getId(), ROOT_FOLDER_ID: root.getId() }, false);
  }
  if (!props.getProperty(AppConfig.KEYS.publicPepper)) props.setProperty(AppConfig.KEYS.publicPepper, Utilities.getUuid() + Utilities.getUuid());
  return Schema.migrate();
}

/** Admin helper: returns the raw token once; only its peppered hash is stored. */
function createPublicAccessToken(organizationId, siteId) {
  Validation.id(organizationId, 'organizationId'); Validation.id(siteId, 'siteId');
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var pepper = AppConfig.requireValue(AppConfig.KEYS.publicPepper);
  var tokenHash = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token + pepper));
  SheetsRepository.append('PublicAccessTokens', { id: Utilities.getUuid(), organizationId: organizationId, siteId: siteId, tokenHash: tokenHash, status: 'ACTIVE', createdAt: new Date().toISOString() });
  return token;
}
