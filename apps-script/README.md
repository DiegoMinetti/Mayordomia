# Gateway Google Apps Script de Mayordomía

Gateway mínimo para operaciones que no pueden confiarse al frontend estático: solicitudes QR anónimas, RBAC server-side, cola Resend, auditoría, health y migraciones. Sheets, Drive y Calendar están detrás de adaptadores chicos; no es el backend general de la PWA.

## Despliegue

1. Crear un proyecto Apps Script y copiar los `.gs` y `appsscript.json` (o usar `clasp`).
2. Ejecutar manualmente `initializeMayordomiaGateway()` como propietario. Crea carpeta, spreadsheet, pepper y schema v1.
3. En **Project Settings → Script Properties** configurar solo lo necesario: `ALLOWED_ORIGINS`, `CALENDAR_ID` (opcional), `RESEND_API_KEY` y `RESEND_FROM` (opcionales; nunca usar `VITE_*`).
4. Crear una Web App que ejecute como propietario y acepte acceso anónimo. Las rutas privilegiadas siguen requiriendo token Google + RBAC.
5. Crear un trigger temporal cada 5–10 minutos para `processEmailQueue` si se habilita Resend.
6. Ejecutar localmente `node apps-script/tests/validation.test.cjs`.

La primera organización/usuario/roles se carga durante el wizard de aprovisionamiento. Hasta que exista un `Users.status=ACTIVE` con `config.manage`, health y migraciones remotas quedan cerrados. Para bootstrap, el propietario ejecuta funciones desde el editor.

## Envelope API

POST JSON:

```json
{
  "action": "system.health",
  "organizationId": "org_123456",
  "auth": { "accessToken": "GOOGLE_ACCESS_TOKEN_CORTO" },
  "payload": {}
}
```

Respuesta estable: `{"ok":true,"data":{},"error":null,"meta":{"requestId":"..."}}`. Los errores llevan `code`, `message`, `details` y `status` dentro del JSON. Apps Script ContentService no permite elegir de manera fiable el HTTP status; el consumidor debe leer el envelope.

Rutas:

- `requests.createPublic`: anónima; token opaco, honeypot `website`, validación, 100 KB máximo, sanitización y límite de 20/10 min por token.
- `requests.list` / `requests.get`: `request.review`; listado con filtros (`status`, `type`, `siteId`, `since`, `until`) y detalle con aprobaciones + timeline.
- `requests.approve` / `requests.reject`: `request.approve.area` o `request.approve.general` según `scope`; concurrencia optimista vía `expectedVersion` (`VERSION_MISMATCH` si choca).
- `system.health`: `config.manage`.
- `system.migrate`: `config.manage`, backup previo y auditoría.
- `emails.enqueue` / `emails.process`: `notification.manage`.
- GET `?action=ping`: liveness sin datos privados.

El access token va en el cuerpo HTTPS porque los Web Apps de Apps Script no exponen el header Authorization a `doPost`. No se persiste ni se registra. Debe tener vida corta. `tokeninfo` verifica el token y el email; después `Users`, `UserRoles` y `RolePermissions` se consultan desde el spreadsheet, siempre en contexto de organización.

## Seguridad y límites conocidos

- Los tokens públicos no son secretos de autorización: identifican el formulario. Se guarda solo SHA-256(token + pepper). Revocar poniendo `status=DISABLED`.
- Apps Script no entrega una IP de cliente confiable. El rate limit se aplica por entry point; CAPTCHA queda como evolución si aparece abuso distribuido.
- `ALLOWED_ORIGINS` no puede imponerse como CORS con `ContentService`. CORS no es una barrera de autenticación: toda ruta sensible usa Google + RBAC. Si se necesita CORS estricto, colocar un gateway compatible delante, sin mover secretos al frontend.
- La cola procesa como máximo 10 emails por ejecución, deduplica, espera 150 ms, reintenta exponencialmente y falla definitivamente al quinto intento. No incluye broadcasts.
- Push reporta honestamente `NOT_AVAILABLE`; no se simula soporte Web Push.
- No se registran tokens, API keys, cuerpos de email ni payloads sensibles en auditoría.

## Migraciones y operación

`Schema.VERSION` y `Schema.TABLES` son la fuente de verdad. Cada nueva versión debe ser idempotente, hacer backup antes de modificar y registrar `schema.migrate`. Nunca editar headers manualmente.

Revisar `AuditLog`, `EmailQueue` y Apps Script Executions. Si Resend o Calendar no están configurados, el core sigue activo y health devuelve `NOT_CONFIGURED`. Ante cuotas agotadas, no reintentar en loops; conservar la fila pendiente para la próxima ejecución.
