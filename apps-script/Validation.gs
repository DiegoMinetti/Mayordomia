var Validation = (function () {
  var ID_RE = /^[A-Za-z0-9_-]{6,128}$/;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function object(value, label) {
    if (!value || Object.prototype.toString.call(value) !== '[object Object]') throw ApiError.badRequest('INVALID_PAYLOAD', (label || 'payload') + ' debe ser un objeto');
    return value;
  }
  function string(value, label, opts) {
    opts = opts || {}; var clean = typeof value === 'string' ? value.trim() : '';
    if (!clean && opts.required !== false) throw ApiError.badRequest('VALIDATION_ERROR', label + ' es obligatorio');
    if (clean.length > (opts.max || 500)) throw ApiError.badRequest('VALIDATION_ERROR', label + ' excede el máximo');
    return clean;
  }
  function id(value, label) { var clean = string(value, label, { max: 128 }); if (!ID_RE.test(clean)) throw ApiError.badRequest('VALIDATION_ERROR', label + ' inválido'); return clean; }
  function email(value, label) { var clean = string(value, label, { max: 254 }).toLowerCase(); if (!EMAIL_RE.test(clean)) throw ApiError.badRequest('VALIDATION_ERROR', label + ' inválido'); return clean; }
  function enumValue(value, label, allowed) { if (allowed.indexOf(value) < 0) throw ApiError.badRequest('VALIDATION_ERROR', label + ' inválido'); return value; }
  function safeText(value, label, max) { return string(value, label, { max: max || 2000 }).replace(/[<>]/g, ''); }
  function publicRequest(payload) {
    object(payload); if (payload.website) throw ApiError.badRequest('SPAM_DETECTED', 'Solicitud inválida');
    return {
      publicToken: id(payload.publicToken, 'publicToken'),
      type: enumValue(payload.type, 'type', ['RESOURCE','LOCATION','AUDIO','MULTIMEDIA','LIGHTING','SUPPORT','MAINTENANCE','PURCHASE','OTHER']),
      requesterName: safeText(payload.requesterName, 'requesterName', 120),
      requesterEmail: payload.requesterEmail ? email(payload.requesterEmail, 'requesterEmail') : '',
      description: safeText(payload.description, 'description', 2000),
      requestedFor: payload.requestedFor ? string(payload.requestedFor, 'requestedFor', { max: 40 }) : '',
      website: ''
    };
  }
  return { object: object, string: string, id: id, email: email, enumValue: enumValue, safeText: safeText, publicRequest: publicRequest };
})();
