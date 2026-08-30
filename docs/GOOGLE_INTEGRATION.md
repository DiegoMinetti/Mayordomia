# Integración Google

## Proyecto y OAuth

1. Crear un proyecto en Google Cloud Console y configurar la pantalla de consentimiento.
2. Habilitar Drive API, Sheets API y Calendar API sólo si se usa Calendar.
3. Crear Client ID tipo Web; registrar `http://localhost:<puerto>` y el origen exacto de GitHub Pages.
4. Añadir usuarios de prueba mientras la app permanezca en testing.
5. Publicar/verificar consentimiento según audiencia y scopes exigidos por Google.

No se necesita ni se distribuye OAuth client secret en una SPA. GIS entrega tokens de acceso de vida corta; no persistirlos. Solicitar scopes incrementalmente y explicar su finalidad.

## Scopes

- `openid email profile`: identidad.
- `drive.file`: preferido para archivos creados/abiertos por la app; validar que cubra redescubrimiento/colaboración elegidos.
- Sheets: usar scope limitado al spreadsheet cuando el flujo lo permita; la API suele autorizar por scope, no por ID, por lo que permisos Drive siguen siendo la barrera del archivo.
- `calendar.events` o equivalente limitado: sólo cuando el administrador habilita Calendar.

No pedir acceso total a Drive por conveniencia. Si el diseño definitivo de descubrimiento exige un scope más amplio, documentar y someter a revisión antes de cambiarlo.

## Descubrimiento y propiedad

El wizard crea carpeta raíz, DB y un descriptor estable `{organizationId, rootFolderId, databaseFileId, schemaVersion}`. Preferir IDs, appProperties/archivo descriptor y archivos creados por la app; no búsquedas repetidas por nombre. Para organizaciones compartidas, la cuenta debe recibir permisos sobre descriptor/carpeta/DB. Probar redescubrimiento en dispositivo limpio: `drive.file` tiene restricciones y **no garantiza descubrir cualquier archivo que otro usuario haya creado sin un flujo de apertura/compartición adecuado**.

## Drive/Sheets

Drive guarda adjuntos y backups; Sheets sólo metadata. Usar batch reads/writes, rangos explícitos y headers versionados. Nunca usar número de fila como identidad. Los límites de tamaño/MIME se validan antes del upload.

## Calendar

Vinculación opcional por organización/sede/área/espacio. Guardar Google event ID y hash; enviar una idempotency key. No asumir webhooks confiables/gratuitos dentro de Pages+Apps Script: polling/trigger periódico es eventual y sujeto a cuotas.

## Apps Script

Deploy como Web App versionado. Módulos: router, auth, public requests, validation/rate limit, sheets/drive/calendar, notifications/resend/push/audit. Propiedades sensibles en Script Properties. Para endpoints internos, validar token Google/audiencia e identidad; para público, token opaco no secreto + controles antiabuso. CORS no sustituye autenticación.

`LockService`, `PropertiesService`, `CacheService` y triggers son útiles pero tienen cuotas, duración y semántica limitada. Registrar errores y degradar, no prometer ejecución exacta.
