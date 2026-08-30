# Offline

La PWA cachea shell y datos operativos no sensibles en IndexedDB/Dexie. El cache no es fuente de autoridad.

## Permitido

Consulta de configuración/áreas/recursos/agenda recientes y creación en borrador de solicitud, reporte, comentario o checklist cuando sea seguro. Cada mutación obtiene UUID local e idempotency key.

## SyncQueue

Estados: `PENDING → SYNCING → SYNCED`, con `FAILED` reintentable o `CONFLICT` humano. Backoff con jitter, máximo de reintentos y deduplicación. Se preserva payload validado, base version y timestamps.

## No permitido offline

Cambios de permisos, aprobaciones, reservas definitivas, decisiones de compra y configuración sensible. Mostrar motivo y conservar borrador cuando corresponda.

## Conflictos y seguridad

Comparar `version`; no last-write-wins silencioso. Cierre de sesión limpia tokens y datos de otras organizaciones. No cachear secretos; datos operativos offline siguen siendo accesibles a quien controle el perfil/dispositivo, por lo que debe existir “borrar datos locales” y una política clara.

El service worker se actualiza de manera controlada para no mezclar app y schema incompatibles.
