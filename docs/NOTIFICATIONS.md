# Notificaciones

## Modelo

Eventos de dominio alimentan una cola idempotente. Preferencias se evalúan por usuario, canal (`internal`, `email`, `push`) y categoría. `Notifications`, `EmailLog` y suscripciones conservan estado y dedupe key.

## Internas

Canal base obligatorio: campana, contador, centro y link accionable. Sigue disponible aunque fallen proveedores externos.

## Resend

`EmailProvider` desacopla `ResendEmailProvider`. Configurar `RESEND_API_KEY` y remitente verificado como Script Properties, nunca `VITE_*`. La cola aplica rate limit, dedupe, retry con backoff y estados `PENDING/SENT/FAILED`. Los límites exactos del plan se consultan al configurar; no se hardcodean como garantía. Sin configuración, health=`NOT_CONFIGURED` y no falla el flujo.

## Push

Solicitar permiso sólo después de explicar beneficio y por acción del usuario. Guardar subscription por user/device y categorías. Envío Web Push estándar exige VAPID/criptografía y requests server-side; Apps Script debe probarse antes de declararlo soportado. Si no es viable, `PushProvider` queda `NOT_AVAILABLE`, sin simulación, y se usan internal/email.

## Prevención de tormentas

Una notificación lógica tiene clave estable por evento-destinatario-canal. Jobs reclaman lotes pequeños, registran intento y respetan topes por organización. No se hacen loops masivos ni reintentos ilimitados.
