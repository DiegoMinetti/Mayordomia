# Producto

Mayordomía es el centro operativo de una congregación: responde “¿qué requiere atención ahora?” y conecta solicitudes, agenda, espacios, inventario, entregas, mantenimiento y compras con trazabilidad.

## Principios

- Mobile first; una solicitud pública por QR debe tomar idealmente menos de un minuto.
- Cada congregación es dueña de sus archivos en Google; la infraestructura central es mínima.
- Multi-organización y multi-sede desde el modelo, sin mezclar permisos ni datos.
- Reglas y evidencia antes que automatizaciones opacas; el MVP no depende de IA.
- Integraciones opcionales degradan con gracia.

## Personas

- Solicitante público: sin login, formulario breve y confirmación.
- Solicitante interno: crea y sigue sus solicitudes.
- Responsable de área: revisa, aprueba y asigna recursos de su ámbito.
- Operador: prepara, entrega, recibe, completa tareas/checklists.
- Administrador: configura organización, sedes, usuarios, agenda y operación.

`Person` representa a cualquier persona relacionada; `User` representa acceso autenticado. La relación es opcional.

## Alcance funcional

El producto completo contempla organización, sedes, áreas, personas/RBAC; recursos y espacios; eventos y Calendar; solicitudes y aprobaciones; entregas/devoluciones; mantenimiento/necesidades; compras; tareas/checklists; adjuntos/comentarios; notificaciones; offline; auditoría y reportes. La entrega incremental y los cortes están en [ROADMAP.md](ROADMAP.md).

## Criterios de éxito MVP

- Organización nueva inicializable y redescubrible desde otro dispositivo.
- Solicitud pública segura, visible por administradores y aprobable por área/general.
- Conflictos detectados antes de reservar.
- Recursos entregables y retornables con historial.
- Dashboard de atención, auditoría y health básico.
- Funciona sin Calendar, Resend ni Push configurados.

## Fuera del MVP

Compras avanzadas, recurrencias complejas, mantenimiento por número de usos, sync bidireccional sofisticado de Calendar, push garantizado, analytics extensos, restauración automática y soporte de volúmenes empresariales. Se preparan contratos, no implementaciones ficticias.
