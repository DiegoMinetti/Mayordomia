# Arquitectura

```text
React PWA (GitHub Pages)
  ├─ Google Identity / OAuth ── Drive · Sheets · Calendar
  ├─ IndexedDB + SyncQueue
  └─ Apps Script Web App
       ├─ solicitud pública / validación privilegiada
       ├─ Sheets + LockService / Drive / Calendar
       └─ Resend y proveedor push opcional
```

## Capas

`UI → Application Services → Domain → Repository interfaces → Adapters`. Los componentes nunca conocen rangos de Sheets ni invocan APIs Google directamente. El dominio contiene anticipación, permisos, transiciones, conflictos, stock y scoring.

Los adapters iniciales son `GoogleWorkspaceDataProvider`, `GoogleSheetsRepository`, `GoogleDriveRepository` y `GoogleCalendarRepository`. Esta frontera permite migrar almacenamiento sin reescribir UI/dominio.

## Fronteras de confianza

El browser es no confiable. OAuth prueba identidad ante Google, pero `organizationId`, `siteId`, permisos y versiones recibidos del cliente se vuelven a resolver. Apps Script es gateway seguro, no backend monolítico. Operaciones Google del usuario pueden realizarse con su token sólo si no requieren secretos ni privilegios adicionales.

## Identidad y tenancy

Una cuenta puede pertenecer a varias organizaciones. La organización se descubre mediante metadata estable en Drive y se selecciona explícitamente. Toda entidad operativa lleva `organizationId`; las de sede llevan `siteId` cuando aplica. Repositories requieren contexto de tenant y aplican filtro obligatorio.

## Consistencia

Sheets no brinda transacciones relacionales. Para escrituras críticas: validar referencias y permisos, tomar `LockService` donde haya contador/stock/reserva, comparar `version`, escribir por batch y auditar. Operaciones reintentables llevan idempotency key.

## ADR-001: datos en Google Workspace

**Decisión:** Sheets como store tabular inicial y Drive para blobs/config; Calendar como proyección. **Razón:** propiedad de datos y costo base. **Consecuencia:** cuotas, latencia y consistencia limitada; se exige repositories y límites operativos.

## ADR-002: Apps Script mínimo

**Decisión:** usarlo sólo para secretos, endpoint público, locks, jobs y validación privilegiada. **Consecuencia:** módulos pequeños y API versionada; evitar concentrar toda lectura UI allí.

## ADR-003: Mayordomía fuente de verdad

Eventos creados en Mayordomía se publican a Calendar. Cambios externos se detectan y requieren decisión humana; nunca se importan cambios destructivos automáticamente.

## Observabilidad

Logs estructurados sin tokens/secretos; `AuditLog` para negocio y health para Drive, Sheets, Calendar, email, push, cache, última sync, versión de app/esquema y errores recientes.
