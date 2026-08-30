# Modelo de datos

## Convenciones

UUID es PK; códigos como `SOL-2026-00142` son sólo referencias humanas. Entidades históricas usan `active=false` o soft delete. Campos base: `id`, `organizationId`, `siteId?`, `createdAt/by`, `updatedAt/by`, `deletedAt?`, `version`.

Timestamps se guardan en ISO-8601 UTC y se muestran en el timezone configurable de organización (default `America/Argentina/Buenos_Aires`). Montos guardan valor decimal y moneda ISO; no usar floats para cálculos finales.

## Agregados

- Organización: `Organizations`, `Sites`, `Locations`, `Areas`, miembros/responsables.
- Identidad: `People`, `Users`, `Roles`, `Permissions`, `UserRoles`.
- Inventario: categorías, `Resources`, stock y movimientos.
- Agenda: eventos, instancias, templates, recurrencias, relaciones de áreas/recursos/personas.
- Solicitudes: request, items, approvals, reservations, delivery/return.
- Mantenimiento: mantenimiento, reparaciones, necesidades.
- Compras: purchase requests/items, suppliers, quotes/items, decisions, purchases/items.
- Colaboración: tasks, checklists/items, comments, attachments.
- Integraciones: links Calendar/eventos, notifications/subscriptions, email log, audit, counters, sync state.

## Relaciones e integridad

Todas las referencias deben pertenecer a la misma organización. `siteId` debe pertenecer a `organizationId`. No se elimina físicamente un área, recurso, persona, proveedor o espacio con historial. `User.personId` es opcional. Attachments almacenan sólo metadata/Drive ID, nunca blob.

## Tablas iniciales

El catálogo de hojas completo de la especificación es el objetivo del esquema, pero cada fase crea sólo las necesarias mediante migraciones idempotentes. `Config` registra `schemaVersion`; cada migración hace backup cuando corresponde y deja auditoría.

## Contadores y concurrencia

`Counters` se incrementa bajo `LockService`; el código humano nunca identifica relaciones. `version` implementa optimistic concurrency. Ante diferencia se devuelve conflicto con versión actual, no overwrite.

## Calendar

`CalendarLinks` define destinos; `CalendarEventLinks` conserva `(internalEventId, calendarId, googleEventId, lastSyncedHash/updatedAt)` para idempotencia y detección de divergencia.
