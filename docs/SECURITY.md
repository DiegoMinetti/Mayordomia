# Seguridad

## Modelo de amenazas

Activos: datos de congregación, permisos, archivos, tokens y secretos. Adversarios: visitante público abusivo, usuario autenticado fuera de alcance, cuenta comprometida y payload/archivo malicioso.

## Controles

- XSS: React escaping, sanitización de contenido enriquecido, CSP viable en Pages, no `dangerouslySetInnerHTML` con contenido usuario.
- IDOR/tenancy: resolver organización/sede desde membresía server-side y validar todas las referencias.
- Privilegios: autorización en gateway, transiciones y límites de invitación; UI sólo mejora UX.
- CSRF: tokens bearer no enviados automáticamente; validar método/content-type/origen cuando aplique. Apps Script tiene particularidades, por eso nunca confiar sólo en Origin.
- Público: esquema estricto, honeypot, rate limit best-effort, payload/tamaño limitados, normalización y deduplicación. Token del QR identifica contexto, no autoriza privilegios.
- Archivos: allowlist MIME/extensión/tamaño, nombre generado, metadata separada y acceso Drive mínimo. No ejecutar ni renderizar HTML/SVG no confiable.
- Secrets: Script Properties; nunca bundle, repo, logs, localStorage o IndexedDB.
- Auditoría: before/after minimizado, sin tokens ni datos sensibles innecesarios.

## OAuth

Scopes incrementales y mínimos, access tokens en memoria y logout/revocación. No implementar refresh token privilegiado en SPA. Revisar configuración de audiencia y dominios autorizados.

## Límites de protección

Apps Script no es un WAF. El rate limiting con Cache/Properties es best-effort y CAPTCHA puede ser necesario ante abuso. Datos en Sheets heredan seguridad de compartición Google: un editor directo del archivo puede eludir reglas de la app; para organizaciones con requisitos estrictos se requerirá backend/store diferente.

## Checklist de release

Revisión de secrets, dependencias, headers, scopes, tenancy/IDOR, permisos negativos, spam público, uploads, logs, backups/restore y procedimiento de revocación.
