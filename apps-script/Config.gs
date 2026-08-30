var AppConfig = (function () {
  var KEYS = {
    databaseId: 'DATABASE_SPREADSHEET_ID',
    rootFolderId: 'ROOT_FOLDER_ID',
    calendarId: 'CALENDAR_ID',
    resendKey: 'RESEND_API_KEY',
    resendFrom: 'RESEND_FROM',
    allowedOrigins: 'ALLOWED_ORIGINS',
    publicPepper: 'PUBLIC_TOKEN_PEPPER'
  };

  function properties_() { return PropertiesService.getScriptProperties(); }
  function get(key) { return properties_().getProperty(key); }
  function requireValue(key) {
    var value = get(key);
    if (!value) throw ApiError.internal('CONFIG_MISSING', 'Falta configuración server-side: ' + key);
    return value;
  }
  function allowedOrigins() {
    return (get(KEYS.allowedOrigins) || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  }
  return { KEYS: KEYS, get: get, requireValue: requireValue, allowedOrigins: allowedOrigins };
})();
