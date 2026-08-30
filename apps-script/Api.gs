function doPost(e) { return handleApi_(e); }
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'ping') return ApiResponse.ok({ service: 'mayordomia-apps-script', status: 'OK' }, Utilities.getUuid());
  return handleApi_(e);
}
function handleApi_(e) {
  var requestId = Utilities.getUuid();
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    if (raw.length > 100000) throw ApiError.badRequest('PAYLOAD_TOO_LARGE', 'El payload excede 100 KB');
    var request = JSON.parse(raw); Validation.object(request, 'request'); Validation.string(request.action, 'action', { max: 100 });
    var result = Router.dispatch(request, e, { requestId: requestId, clientKey: String((e.parameter && e.parameter.client) || 'anonymous').slice(0, 100) });
    return ApiResponse.ok(result, requestId);
  } catch (error) {
    console.error(JSON.stringify({ requestId: requestId, code: error.code || 'INTERNAL_ERROR', message: error.message, stack: error.stack }));
    return ApiResponse.fail(error, requestId);
  }
}
