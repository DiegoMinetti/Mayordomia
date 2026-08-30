# Límites reales

- **Costo USD 0:** objetivo, no SLA. Planes/cuotas de Google, GitHub y Resend cambian; la app debe observar errores y degradar sin activar facturación.
- **Sheets:** no es base transaccional ni adecuada para millones de registros/alta concurrencia. Locks y versions reducen carreras, no ofrecen ACID completo.
- **Drive ownership/discovery:** `drive.file` es deseable pero restringe visibilidad. Compartir y redescubrir organizaciones creadas por otros usuarios requiere un flujo explícito y pruebas de scopes.
- **Apps Script:** límites de runtime, triggers, almacenamiento, concurrencia y URLFetch. No garantiza cron exacto, rate limiting fuerte ni alta disponibilidad.
- **Web Push:** requiere VAPID y cifrado; Apps Script puede no ser proveedor viable. No prometer hasta probar.
- **GitHub Pages:** hosting estático, sin secretos, API ni rewrites nativos de SPA.
- **Offline:** el dispositivo no puede autorizar decisiones sensibles; IndexedDB no es bóveda segura.
- **Google editors:** quien tenga acceso directo de edición a Sheets puede modificar datos fuera de reglas de aplicación.
- **Calendar:** sincronización externa es eventual; cambios concurrentes requieren reconciliación humana.

## Señales para migrar

Latencia sostenida, locks frecuentes, cuotas agotadas, decenas de miles de filas calientes, necesidades regulatorias/auditoría inmutable, rate limiting fuerte o automatizaciones confiables indican migrar adapters a API + base transaccional.
