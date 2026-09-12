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
| Analytics | "requiere atención" y métricas útiles básicas | insights/reportes extensos |
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

## Estado al cierre de Ola 4 (Sep 2026)

PRs mergeados en `integration-ola-4` (`c79b5ec`):

- **Foundation**: prettier, editorconfig, clasp scaffold, GitHub Pages workflow, deploy:script — ✅
- **PR 0C**: wizard público `/solicitar` con RHF+Zod, honeypot, Dexie drafts, idempotency helper — ✅
- **PR 2**: Google Identity Services (`GoogleIdentityAuthProvider`), `AuthContext`, `MockAuthProvider` — ✅
- **PR 3**: backend Bootstrap (`Bootstrap.gs`), `Auth.verifyIdentity`, Router identity-only mode, `SetupPage` — ✅
- **PR 0B**: `GatewayClient`, `DataContext`, `CurrentOrgContext`, 5 hooks de catálogo — ✅
- **PR 1A**: Solicitudes (Solicitudes.gs + UI + timeline + version-mismatch banner) — ✅
- **PR 1B**: Recursos/Espacios (Resources.gs + UI + availability) — ✅
- **PR 1C**: Eventos/Agenda — ✅
- **PR 3a**: Operación + Mantenimiento con auto-creación de mantenimiento al devolver con daños — ✅
- **PR 3b**: Compras (Purchases.gs + scoring + 8 endpoints + UI completa) — ✅
- **PR 3c**: Notificaciones in-app + bell + fan-out desde `Requests.gs`, `Operations.gs`, `Purchases.gs` — ✅
- **Ola 4a**: backfill de mock seeds + 2 notification fan-outs (`MAINTENANCE_OPENED`, `PURCHASE_DECISION`) — ✅
- **Ola 4b**: Dashboard con datos reales (pending requests + open maintenance + submitted purchases + próximo evento + unread count) — ✅
- **Ola 4c**: Playwright e2e (6 specs) + `npm audit` documentado (2 moderate en `@vitest/mocker`, fix requiere vitest@5) — ✅

Pendiente para producción (no código, sólo config/secretos):

- Crear Apps Script project + `clasp login` + `npm run deploy:script` (PR 1, pasos 1–5).
- Configurar `RESEND_API_KEY` + `RESEND_FROM` en Script Properties para email saliente.
- Resolver branch alignment: `master` → `main` (en curso en este merge).
- `npm audit`: pendiente bumpear vitest para cerrar las 2 moderate vulnerabilities.

