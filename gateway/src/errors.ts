/**
 * ApiError — typed errors that map to the stable envelope.
 *
 * Mirrors apps-script/Errors.gs but expressed as a class hierarchy so callers
 * can `throw` and `instanceof` instead of constructing plain objects.
 */

export class ApiException extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, message: string, status = 400, details: unknown = null) {
    super(message);
    this.name = 'ApiException';
    this.code = code;
    this.status = status;
    this.details = details;
    // Capture a useful stack but trim the constructor frame.
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export const ApiError = {
  badRequest: (code: string, message: string, details?: unknown) =>
    new ApiException(code, message, 400, details ?? null),
  unauthorized: (message = 'Autenticación requerida') => new ApiException('UNAUTHORIZED', message, 401),
  forbidden: (permission: string) =>
    new ApiException('FORBIDDEN', 'Permiso insuficiente', 403, { permission }),
  notFound: (entity: string) => new ApiException('NOT_FOUND', `${entity} no encontrado`, 404),
  conflict: (code: string, message: string) => new ApiException(code, message, 409),
  rateLimited: () => new ApiException('RATE_LIMITED', 'Demasiadas solicitudes; intentá más tarde', 429),
  internal: (code: string, message: string) => new ApiException(code, message, 500),
} as const;
