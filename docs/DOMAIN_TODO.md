# Núcleo de dominio — bitácora y TODO

## Implementado

- Modelos base multi-organización, usuarios/RBAC, recursos, reservas, aprobaciones y vínculos Calendar.
- Autorización por permisos y alcance, sin conceder autoridad por nombre del rol.
- Política de anticipación con solicitudes tardías, motivo obligatorio y override autorizado.
- Plan y resolución de aprobaciones por área y general.
- Conflictos por intervalo semiabierto: espacios, unidades serializadas, cantidad y recursos no disponibles.
- Scoring de compras ponderado, desglose auditable y justificación al ignorar el mejor score.
- Contratos de repositorio versionado, error de concurrencia, contador atómico y códigos humanos.
- Plan de sincronización Calendar que detecta cambios externos antes de sobrescribir.
- Cola offline ordenada, reintentable y con operaciones versionadas.
- Tests unitarios Vitest de reglas críticas.

## Próximos pasos

- Implementar adaptadores Google Sheets/Drive/Calendar y almacenamiento Dexie para `QueueStore`.
- Aplicar validación server-side equivalente en Apps Script para acciones sensibles.
- Expandir modelos de eventos, entregas/devoluciones, mantenimiento, compras y auditoría.
- Agregar repositorio en memoria y contract tests para optimistic concurrency y contador atómico.
- Definir resolución UI de conflictos offline (`expectedVersion`) sin aplicar last-write-wins silencioso.
- Implementar hashing criptográfico estable en adaptador (el núcleo usa representación determinista simple).
- Ejecutar `npm test`, `npm run typecheck` y lint cuando la raíz instale/configure dependencias.

## Decisiones

- Los intervalos son `[inicio, fin)`: eventos contiguos no chocan.
- Reservas pendientes también advierten/bloquean en el chequeo; canceladas no cuentan.
- El dominio no depende de React, Google APIs, Dexie ni almacenamiento concreto.
- La cola continúa después de un fallo para evitar que una operación bloquee todas las demás.
