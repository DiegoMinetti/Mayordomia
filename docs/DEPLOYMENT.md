# Despliegue

## Frontend / GitHub Pages

1. Configurar variables públicas (`VITE_GOOGLE_CLIENT_ID`, URL `/exec`, base pública y flags no sensibles).
2. Configurar Pages mediante GitHub Actions.
3. Pipeline: `npm ci`, lint, typecheck, test, build y deploy del artefacto.
4. Ajustar `base` a `/repositorio/` (o `/` en dominio raíz) y resolver refresh SPA con `404.html`/estrategia elegida.
5. Registrar el origen final en OAuth y probar login desde incógnito.

## Google Apps Script

1. Crear proyecto ligado a la cuenta operadora/administradora; habilitar servicios necesarios.
2. Configurar Script Properties: IDs/config no públicos y opcionalmente `RESEND_API_KEY`, remitente y futuras claves privadas.
3. Desplegar nueva versión como Web App con el nivel de acceso mínimo compatible con solicitudes públicas.
4. Copiar URL `/exec` pública al frontend. Nunca usar la URL de desarrollo en producción.
5. Probar endpoint health, request pública, autorización interna, lock/idempotencia y logging.

El acceso anónimo del Web App amplía superficie: el handler público sólo debe exponer acciones allowlisted; las operaciones internas autentican separadamente.

## Resend

Crear API key restringida, verificar dominio/remitente según Resend, guardar en Script Properties, enviar un mensaje de prueba y revisar `EmailLog`. Rotar la clave si se expone. Mantener feature desactivada hasta que health confirme.

## Push

No habilitar flag de UI hasta disponer de proveedor probado, service worker, VAPID almacenado server-side, alta/baja de subscriptions y prueba real en navegadores objetivo.

## Migraciones/backups

Cada release declara versión de app/esquema. Antes de migración destructiva: backup, lock, migración idempotente, verificación y audit log. Restaurar siempre a copia o con confirmación explícita; nunca sobrescribir DB silenciosamente.

## Rollback

Frontend: redeploy del artefacto/commit anterior compatible. Apps Script: volver a deployment versionado anterior. Si hubo migración, no asumir downgrade: usar backup y procedimiento documentado.
