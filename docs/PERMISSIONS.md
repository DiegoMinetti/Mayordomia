# Permisos

RBAC es configurable y contextual. Roles iniciales: `SUPER_ADMIN`, `ADMIN`, `SITE_ADMIN`, `AREA_MANAGER`, `OPERATOR`, `REQUESTER`, `VIEWER`, pero la autorización evalúa permisos, no nombres.

## Alcance

Una asignación contiene organización y, opcionalmente, sedes/áreas. Ser administrador en A no concede acceso en B. Una acción requiere permiso + alcance + estado válido de usuario (`ACTIVE`). `PENDING` y `DISABLED` no operan.

## Catálogo base

Incluye `organization.manage`, `site.view/manage`, `user.view/manage`, `role.manage`, `area.view/manage`, operaciones de resource/request/event/reservation/delivery/return/maintenance/need/purchase/quote/supplier/calendar/notification/audit/config según la especificación.

## Reglas obligatorias

- Invitadores no pueden otorgar permisos superiores a los propios.
- Aprobación de área exige `request.approve.area` y asignación al área; general exige `request.approve.general`.
- UI oculta acciones no autorizadas, pero esto no es seguridad.
- Apps Script resuelve membresía server-side; jamás acepta permisos declarados por cliente.
- Cambios de rol/permiso y login quedan auditados.

## Pruebas mínimas

Denegación por organización/sede/área incorrecta; usuario pending/disabled; escalamiento por payload; invitación superior; separación entre permisos de aprobación; revocación efectiva.
