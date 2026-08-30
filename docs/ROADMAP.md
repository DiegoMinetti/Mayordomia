# Roadmap y matriz de alcance

| Capacidad | MVP operativo | Fase posterior |
|---|---|---|
| Foundation | PWA, capas, auth, Apps Script, health, CI | hardening/telemetría avanzada |
| Organización | org/sede/área/persona, RBAC esencial | branding y roles finos |
| Recursos | inventario, espacios, movimientos, QR | stock/impresión avanzados |
| Eventos | eventos internos y agenda | plantillas, RRULE, Calendar multi-destino |
| Solicitudes | QR público, anticipación, aprobaciones, conflictos | adjuntos/wizards especializados |
| Operación | preparar, entregar, devolver, checklist | escaneo masivo y automatizaciones |
| Mantenimiento | fallas correctivas y necesidades | preventivo por tiempo/usos |
| Compras | contrato/modelo mínimo o flag apagado | flujo completo, scoring y recepción |
| Notificaciones | internas | Resend y push probado |
| Offline | shell/cache y borradores seguros | SyncQueue completo/conflict UI |
| Analytics | “requiere atención” y métricas útiles básicas | insights/reportes extensos |
| Backups | manual + migración segura | política diaria/mensual automatizada |

## Secuencia de entrega

1. Foundation y organización.
2. Recursos/eventos básicos.
3. Solicitudes/aprobaciones/conflictos.
4. Entrega/devolución y dashboard de atención.
5. Mantenimiento y necesidades.
6. Calendar/email opcionales.
7. Compras, offline avanzado, analytics y hardening.

Cada fase exige tests de reglas, lint/typecheck/build y actualización de `TODO.md`. Una interfaz preparada no cuenta como funcionalidad terminada; el health/feature flag debe reflejar el estado real.
