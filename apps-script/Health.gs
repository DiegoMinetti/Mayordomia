var HealthService = (function () {
  function check() {
    var sheets = { status: 'ERROR' }; try { SheetsRepository.db().getId(); sheets = { status: 'OK' }; } catch (e) {}
    return { version: '1.0.0', schemaVersion: Schema.current(), expectedSchemaVersion: Schema.VERSION, drive: DriveProvider.health(), sheets: sheets, calendar: CalendarProvider.health(), email: { status: AppConfig.get(AppConfig.KEYS.resendKey) && AppConfig.get(AppConfig.KEYS.resendFrom) ? 'OK' : 'NOT_CONFIGURED' }, push: { status: 'NOT_AVAILABLE', reason: 'Proveedor no configurado' }, checkedAt: new Date().toISOString() };
  }
  return { check: check };
})();
