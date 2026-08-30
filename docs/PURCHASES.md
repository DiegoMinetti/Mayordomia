# Compras

Flujo: necesidad → solicitud → cotizaciones → análisis → decisión → aprobación → orden → recepción → inventario.

## Evidencia

Cada quote conserva proveedor, vigencia, moneda, precio/impuestos/envío/descuento, entrega, pago, garantía, cumplimiento técnico y adjunto Drive. Comparar monedas sólo con una tasa y fecha explícitas; de otro modo mostrar columnas sin score conjunto.

## Scoring

Criterios configurables (precio, calidad, entrega, garantía, historial, fit técnico) suman 100%. Cada dimensión se normaliza con fórmula documentada, se muestra contribución y se guarda `scoreSnapshot`. Datos faltantes no deben recibir ventaja implícita.

El score asiste, no decide. Se puede elegir una alternativa no ganadora con justificación obligatoria. `PurchaseDecision` congela quote, actor, fecha, razón, alternativas y aprobación.

## Recepción

Registrar cantidades, diferencias, daño, comprobante y receptor. Recepción parcial mantiene saldo. Sólo items aceptados crean resources/stock y movimiento, de forma idempotente.

## Controles

Separación de solicitud/aprobación cuando sea configurable; permisos y presupuesto; montos decimales; adjuntos en Drive; auditoría de transiciones; bloqueo de edición de snapshots históricos.
