# Mayordomía — bitácora maestra de continuidad

Actualizado: 2026-08-30. Este archivo es la fuente rápida para retomar el proyecto con otro modelo. La especificación original está en `/Users/diegominetti/Downloads/MAYORDOMIA_PROMPT_MAESTRO.md`; la documentación normativa está en `docs/`.

## Estado comprobado

- [x] Proyecto React 19 + TypeScript + Vite + Material UI.
- [x] PWA instalable, manifest, service worker, ícono y fallback para GitHub Pages.
- [x] Layout responsive: sidebar en escritorio, navegación inferior/drawer en móvil.
- [x] Dashboard orientado a “qué requiere atención ahora”.
- [x] Wizard público `/solicitar`, adaptable mediante query string, con honeypot y confirmación UX.
- [x] Wizard inicial `/setup` y degradación visible de integraciones aún no conectadas.
- [x] Dominio desacoplado: permisos, anticipación, aprobaciones, reservas/conflictos, scoring de compras, concurrencia, Calendar y cola offline.
- [x] Gateway Apps Script modular: auth/RBAC, Sheets/Drive/Calendar, solicitud pública, rate limit, auditoría, migraciones, health y cola Resend.
- [x] CI de GitHub Pages con lint, typecheck, test y build.
- [x] Documentación técnica/producto/seguridad/operaciones en `docs/`.
- [x] No se incluyeron secretos ni servicios pagos obligatorios.

## Realidad del corte actual

El repositorio es una **foundation funcional**, no las 12 fases completas. Dashboard, navegación, setup y wizard público renderizan; las pantallas internas de módulos son shells honestos. El dominio y gateway contienen reglas/contratos reales, pero todavía falta conectarlos extremo a extremo con una cuenta Google de staging.

## Siguiente iteración priorizada

- [ ] Crear `GoogleIdentityAuthProvider`: GIS, scopes mínimos, expiración de access token y selector de organizaciones.
- [ ] Conectar setup con bootstrap Apps Script de un solo uso y descubrimiento estable vía Drive `appDataFolder`/archivo conocido.
- [ ] Implementar `GoogleWorkspaceDataProvider` frontend y repositorios de Organization, Site, Area, User y Role.
- [ ] Reemplazar datos de demostración del dashboard por TanStack Query + providers.
- [ ] Conectar `/solicitar` a `requests.createPublic`, añadir Zod/RHF, idempotency key, borrador Dexie y manejo offline.
- [ ] Implementar UI completa de Solicitudes: lista, detalle/timeline, aprobación por área/general y conflicto explícito.
- [ ] Implementar Recursos/Espacios: CRUD, movimientos, QR imprimible y reserva.
- [ ] Implementar Eventos/Agenda y publicación Calendar no destructiva.
- [ ] Implementar entrega/devolución y creación automática de mantenimiento por daño.
- [ ] Implementar mantenimiento/necesidades y después procurement end-to-end.
- [ ] Agregar centro de notificaciones internas; habilitar Resend solo tras configurar dominio/API key en Script Properties.
- [ ] Mantener Push como `NOT_AVAILABLE` hasta elegir/probar un proveedor seguro; no simular soporte.
- [ ] Agregar Playwright para los cuatro recorridos críticos cuando los adapters staging estén conectados.
- [ ] Ejecutar prueba de integración/cuotas/concurrencia en proyecto Google de staging.

## Criterio para marcar una función completa

Solo marcarla `[x]` cuando tenga UI, regla de dominio, persistencia real o adapter explícito, control de permisos server-side, estados de error, auditoría pertinente y tests. Una pantalla placeholder o una interfaz sin adapter no cuenta como funcionalidad terminada.

## Archivos de continuidad especializados

- `docs/DOMAIN_TODO.md`: reglas de negocio y contratos pendientes.
- `apps-script/TODO.md`: hardening y puesta en producción del gateway.
- `docs/ROADMAP.md`: orden de fases y matriz MVP/posterior.
- `docs/DEPLOYMENT.md`: configuración y despliegue.
- `docs/SECURITY.md`: amenazas y controles que no deben degradarse.
