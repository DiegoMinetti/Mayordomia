# Continuidad — gateway Apps Script

Este archivo registra lo implementado y el trabajo pendiente para que otro modelo pueda retomar sin reconstruir contexto.

## Hecho

- [x] Envelope uniforme, router modular y `requestId`.
- [x] Validación y límite global de payload; honeypot y sanitización del formulario público.
- [x] Token público opaco con hash + pepper, revocación y rate limit por entry point.
- [x] Verificación de access token Google y RBAC consultado server-side por organización.
- [x] Repositorio Sheets y adaptadores Drive/Calendar.
- [x] Auditoría best-effort sin secretos.
- [x] Cola Resend con deduplicación, lote acotado, rate pacing, backoff y 5 intentos.
- [x] Health honesto y degradación de Calendar/Resend/Push.
- [x] Schema v1, backup previo y migración con lock.
- [x] Bootstrap local y helper para token público.
- [x] Pruebas unitarias de validación sin cambiar `package.json`.

## Próximo, antes de producción

- [ ] Integrar el wizard del frontend para aprovisionar Organization, usuario inicial y roles base mediante una ceremonia de bootstrap explícita y de un solo uso.
- [ ] Fijar y validar `aud` contra el OAuth Client ID esperado si se adopta ID token en lugar de access token.
- [ ] Añadir permisos por `siteId`/área a la evaluación RBAC; hoy el permiso es organizacional.
- [ ] Agregar idempotency key a `requests.createPublic` para tolerar reenvíos offline.
- [ ] Decidir CAPTCHA solo con evidencia de abuso; Apps Script no expone IP.
- [ ] Añadir migraciones incrementales reales (v2+) con pruebas sobre una copia de spreadsheet.
- [ ] Crear retención/archivo de AuditLog y EmailQueue para controlar tamaño y cuotas.
- [ ] Añadir plantillas de email permitidas server-side; no permitir HTML arbitrario desde UI general.
- [ ] Implementar trigger instalable y alerta de cola atascada/errores recientes.
- [ ] Pruebas de integración en un proyecto Apps Script staging y prueba de cuota/concurrencia.
- [ ] Evaluar caché de permisos con invalidación versionada si la latencia de Sheets lo exige.

## Decisiones que no deben revertirse sin revisión de seguridad

- Ningún secreto en GitHub Pages, `VITE_*`, localStorage o IndexedDB.
- Nunca aceptar roles/permisos declarados por el cliente.
- Nunca registrar access tokens o API keys.
- No convertir el gateway en un backend monolítico ni sumar infraestructura paga automáticamente.
- Push permanece `NOT_AVAILABLE` hasta existir un proveedor real y seguro.
