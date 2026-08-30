# Flujos operativos

## Solicitud pública

QR opaco → wizard breve → honeypot/rate limit/validación en Apps Script → crear `SUBMITTED` e idempotency key → confirmación. Según reglas pasa a aprobaciones de área/general. Anticipación devuelve `allowed`, `isLate`, días, mínimo y motivo; tardías permitidas exigen justificación.

## Aprobación y reserva

Cada área mantiene aprobación independiente. Sólo tras completar requisitos se intenta reserva definitiva bajo lock/version. Conflictos de horario, cantidad, mantenimiento o estado bloquean aprobación y se muestran; nunca se resuelven silenciosamente.

## Recurso

Reserva aprobada → preparación/checklist → entrega con condición y responsables → devolución → reconciliación de faltantes/daños. Daño crea mantenimiento correctivo y movimiento; toda transición audita actor/fecha/comentario.

## Evento

Evento interno reúne espacio, áreas, recursos, personas, requests, tareas, archivos y timeline. Calendar es una publicación idempotente. Divergencia externa ofrece “Mantener Mayordomía” o “Importar cambio” y registra decisión.

## Mantenimiento/necesidad

Reporte → asignación → diagnóstico/solución → cierre. Una necesidad aprobada puede convertirse en compra manteniendo links y evidencia.

## Estados

Las transiciones son funciones de dominio y rechazan saltos inválidos. Cancelación/cierre no eliminan historial. Las operaciones críticas no se aceptan offline.
