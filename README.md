# Mayordomía

**Organización para servir.** PWA multi-organización para coordinar sedes, solicitudes, eventos, recursos y operación congregacional, con los datos de cada organización alojados en su propia cuenta de Google.

> Estado: construcción inicial. El alcance implementado y pendiente se controla en `TODO.md`; la matriz de fases está en [docs/ROADMAP.md](docs/ROADMAP.md).

## Arquitectura en una frase

React/TypeScript se publica como sitio estático en GitHub Pages; Google OAuth habilita acceso a Drive, Sheets y Calendar; un Web App de Google Apps Script ejecuta únicamente operaciones públicas o privilegiadas y guarda secretos como la clave de Resend.

## Requisitos

- Node.js LTS y npm.
- Cuenta/proyecto de Google Cloud con OAuth configurado.
- Cuenta Google autorizada para crear Drive/Sheets y, opcionalmente, calendarios.
- Google Apps Script + `clasp` para gateway público, automatizaciones y correo.
- Opcional: cuenta Resend y dominio/remitente verificado.

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Controles esperados antes de publicar:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e   # Playwright: arranca `npm run dev` y ejercita flujos públicos
```

Nunca agregar secretos a `.env.local`: toda variable `VITE_*` termina visible en el navegador. Allí sólo van identificadores y URLs públicos.

## Configuración rápida

1. Seguir [Google Integration](docs/GOOGLE_INTEGRATION.md) para OAuth, scopes, Drive, Sheets y Calendar.
2. Desplegar Apps Script siguiendo [Deployment](docs/DEPLOYMENT.md#google-apps-script).
3. Copiar sólo el Client ID y la URL pública del Web App a `.env.local`.
4. Configurar Resend como Script Property si se desea email; sin Resend, el core y las notificaciones internas continúan funcionando.
5. Ejecutar el wizard de primera organización. Debe poder retomarse si se interrumpe.

## GitHub Pages

El build debe recibir el `base` correcto del repositorio. Como Pages no reescribe rutas, el proyecto debe usar una estrategia de fallback SPA (copia `404.html`) o routing compatible con hash. El workflow debe correr install, lint, typecheck, tests y build antes de desplegar. Ver [Deployment](docs/DEPLOYMENT.md).

## Push

La PWA puede registrar un service worker y suscripciones, pero **Apps Script no se declara proveedor Web Push estándar hasta verificar soporte criptográfico VAPID y envío HTTP compatible**. El contrato `PushProvider` permite reemplazarlo. Mientras tanto, internal/email son degradaciones válidas. No se debe mostrar push como disponible si el health check no lo confirma.

## Seguridad y costos

- No hay secretos, refresh tokens ni claves privadas en frontend, localStorage o IndexedDB.
- Todas las operaciones sensibles vuelven a validar identidad, organización, rol y versión en server-side.
- USD 0 es un objetivo de infraestructura base, no una garantía de capacidad ilimitada: Google, GitHub y Resend aplican cuotas y pueden cambiar sus planes.
- Calendar, email, push y offline avanzado son mejoras progresivas: su falla no inutiliza la operación interna.

## Documentación

- [Producto](docs/PRODUCT.md) · [Arquitectura](docs/ARCHITECTURE.md) · [Modelo de datos](docs/DATA_MODEL.md)
- [Permisos](docs/PERMISSIONS.md) · [Flujos](docs/WORKFLOWS.md) · [Compras](docs/PURCHASES.md)
- [Google](docs/GOOGLE_INTEGRATION.md) · [Offline](docs/OFFLINE.md) · [Notificaciones](docs/NOTIFICATIONS.md)
- [Seguridad](docs/SECURITY.md) · [Despliegue](docs/DEPLOYMENT.md) · [Roadmap](docs/ROADMAP.md) · [Límites](docs/LIMITS.md)

## Troubleshooting

- `redirect_uri_mismatch`: registrar exactamente el origen local y la URL de Pages en Google Cloud.
- Login funciona pero no aparecen organizaciones: comprobar scopes, permisos de Drive y el archivo estable de descubrimiento; no depender del cache local.
- Error CORS/Apps Script: verificar URL `/exec`, versión desplegada y quién puede invocar el Web App.
- Calendar duplica eventos: no crear sin consultar `CalendarEventLinks`; usar idempotency key.
- Email no sale: revisar `RESEND_API_KEY`, remitente verificado y `EmailLog`; no reintentar manualmente en loop.
- Datos en conflicto: conservar la edición local como `CONFLICT` y resolver; nunca forzar overwrite silencioso.
