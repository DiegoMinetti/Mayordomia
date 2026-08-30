var ApiResponse = (function () {
  function json_(body) {
    return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
  }
  function ok(data, requestId) { return json_({ ok: true, data: data === undefined ? null : data, error: null, meta: { requestId: requestId } }); }
  function fail(error, requestId) {
    var known = error instanceof ApiException;
    return json_({ ok: false, data: null, error: {
      code: known ? error.code : 'INTERNAL_ERROR',
      message: known ? error.message : 'Ocurrió un error inesperado',
      details: known ? error.details : null,
      status: known ? error.status : 500
    }, meta: { requestId: requestId } });
  }
  return { ok: ok, fail: fail };
})();
