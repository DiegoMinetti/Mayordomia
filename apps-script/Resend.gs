var EmailQueue = (function () {
  function enqueue(message) {
    Validation.email(message.to, 'to'); Validation.string(message.subject, 'subject', { max: 200 });
    var dedupeKey = Validation.string(message.dedupeKey, 'dedupeKey', { max: 180 });
    var existing = SheetsRepository.findOne('EmailQueue', function (r) { return String(r.dedupeKey) === dedupeKey && ['PENDING','SENDING','SENT'].indexOf(String(r.status)) >= 0; });
    if (existing) return { id: existing.id, deduplicated: true };
    var id = Utilities.getUuid();
    SheetsRepository.append('EmailQueue', { id: id, organizationId: message.organizationId || '', to: message.to, subject: message.subject, html: String(message.html || '').slice(0, 50000), dedupeKey: dedupeKey, status: 'PENDING', attempts: 0, nextAttemptAt: new Date().toISOString(), createdAt: new Date().toISOString(), lastError: '' });
    return { id: id, deduplicated: false };
  }

  function processBatch() {
    if (!AppConfig.get(AppConfig.KEYS.resendKey) || !AppConfig.get(AppConfig.KEYS.resendFrom)) return { status: 'NOT_CONFIGURED', processed: 0 };
    var lock = LockService.getScriptLock(); if (!lock.tryLock(1000)) return { status: 'BUSY', processed: 0 };
    try {
      var sheet = SheetsRepository.db().getSheetByName('EmailQueue'); var values = sheet.getDataRange().getValues(); var headers = values[0].map(String); var now = new Date(); var processed = 0;
      for (var i = 1; i < values.length && processed < 10; i++) {
        var row = {}; headers.forEach(function (h, j) { row[h] = values[i][j]; });
        if (row.status !== 'PENDING' || new Date(row.nextAttemptAt) > now) continue;
        processed++; var statusCol = headers.indexOf('status') + 1; var attemptsCol = headers.indexOf('attempts') + 1; var nextCol = headers.indexOf('nextAttemptAt') + 1; var errorCol = headers.indexOf('lastError') + 1;
        sheet.getRange(i + 1, statusCol).setValue('SENDING');
        try {
          var response = UrlFetchApp.fetch('https://api.resend.com/emails', { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + AppConfig.get(AppConfig.KEYS.resendKey) }, payload: JSON.stringify({ from: AppConfig.get(AppConfig.KEYS.resendFrom), to: [row.to], subject: row.subject, html: row.html }), muteHttpExceptions: true });
          if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error('Resend HTTP ' + response.getResponseCode());
          sheet.getRange(i + 1, statusCol).setValue('SENT');
        } catch (error) {
          var attempts = Number(row.attempts || 0) + 1; sheet.getRange(i + 1, attemptsCol).setValue(attempts); sheet.getRange(i + 1, errorCol).setValue(String(error.message).slice(0, 500));
          sheet.getRange(i + 1, statusCol).setValue(attempts >= 5 ? 'FAILED' : 'PENDING'); sheet.getRange(i + 1, nextCol).setValue(new Date(Date.now() + Math.pow(2, attempts) * 60000).toISOString());
        }
        Utilities.sleep(150);
      }
      return { status: 'OK', processed: processed };
    } finally { lock.releaseLock(); }
  }
  return { enqueue: enqueue, processBatch: processBatch };
})();

function processEmailQueue() { return EmailQueue.processBatch(); }
