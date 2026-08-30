function ApiException(code, message, status, details) {
  this.name = 'ApiException';
  this.code = code;
  this.message = message;
  this.status = status || 400;
  this.details = details || null;
  this.stack = (new Error(message)).stack;
}
ApiException.prototype = Object.create(Error.prototype);

var ApiError = {
  badRequest: function (code, message, details) { return new ApiException(code, message, 400, details); },
  unauthorized: function (message) { return new ApiException('UNAUTHORIZED', message || 'Autenticación requerida', 401); },
  forbidden: function (permission) { return new ApiException('FORBIDDEN', 'Permiso insuficiente', 403, { permission: permission }); },
  notFound: function (entity) { return new ApiException('NOT_FOUND', entity + ' no encontrado', 404); },
  conflict: function (code, message) { return new ApiException(code, message, 409); },
  rateLimited: function () { return new ApiException('RATE_LIMITED', 'Demasiadas solicitudes; intentá más tarde', 429); },
  internal: function (code, message) { return new ApiException(code, message, 500); }
};
