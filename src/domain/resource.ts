/**
 * PR 1B — Resource / Location domain helpers.
 *
 * The heavy lifting (overlap math, blocked statuses, etc.) lives in
 * `reservations.ts` and `models.ts` from PR 0. This module is the
 * "view layer" helpers that the UI and the resources data client
 * share: label mappers in Spanish and a thin wrapper around
 * `findReservationConflicts` so callers don't need to know which
 * fields of the resource DTO map onto the domain entity.
 */
import type { Reservation, Resource } from './models';
import { findReservationConflicts } from './reservations';
import type {
  ReservationDto,
  ResourceDto,
  ResourceInventoryType,
  ResourceStatusDto,
} from '../integrations/data/types';

export const RESOURCE_STATUS_LABELS: Record<ResourceStatusDto, string> = {
  AVAILABLE: 'Disponible',
  RESERVED: 'Reservado',
  DELIVERED: 'Entregado',
  IN_USE: 'En uso',
  RETURN_PENDING: 'Devolución pendiente',
  MAINTENANCE: 'Mantenimiento',
  BROKEN: 'Roto',
  MISSING: 'Faltante',
  RETIRED: 'Dado de baja',
};

export const INVENTORY_TYPE_LABELS: Record<ResourceInventoryType, string> = {
  SERIALIZED: 'Serializado',
  QUANTITY: 'Por cantidad',
};

export const RESERVATION_STATUS_LABELS: Record<ReservationDto['status'], string> = {
  PENDING_RESERVATION: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  CREATE: 'Alta',
  MOVE: 'Movimiento',
  RESERVE: 'Reserva',
  DELIVER: 'Entrega',
  RETURN: 'Devolución',
  MAINTAIN: 'Mantenimiento',
  RETIRE: 'Baja',
  ADJUST: 'Ajuste',
};

export function resourceStatusLabel(status: ResourceStatusDto): string {
  return RESOURCE_STATUS_LABELS[status] ?? status;
}

export function inventoryTypeLabel(type: ResourceInventoryType): string {
  return INVENTORY_TYPE_LABELS[type] ?? type;
}

export function reservationStatusLabel(status: ReservationDto['status']): string {
  return RESERVATION_STATUS_LABELS[status] ?? status;
}

export function movementTypeLabel(type: string): string {
  return MOVEMENT_TYPE_LABELS[type] ?? type;
}

/**
 * Color hint for status chips. Returned as the MUI palette key
 * (e.g. `success`, `warning`) so the UI can map it locally.
 */
export function resourceStatusColor(
  status: ResourceStatusDto,
): 'success' | 'warning' | 'info' | 'error' | 'default' {
  switch (status) {
    case 'AVAILABLE':
      return 'success';
    case 'RESERVED':
    case 'DELIVERED':
    case 'IN_USE':
    case 'RETURN_PENDING':
      return 'info';
    case 'MAINTENANCE':
      return 'warning';
    case 'BROKEN':
    case 'MISSING':
    case 'RETIRED':
      return 'error';
    default:
      return 'default';
  }
}

/**
 * Map the gateway DTO onto the domain `Resource` shape so we can
 * reuse `findReservationConflicts` (which expects the domain entity).
 */
export function resourceFromDto(dto: ResourceDto): Resource {
  return {
    id: dto.id,
    organizationId: dto.organizationId,
    siteId: dto.siteId,
    createdAt: dto.createdAt ?? new Date().toISOString(),
    createdBy: 'system',
    updatedAt: dto.updatedAt ?? new Date().toISOString(),
    updatedBy: 'system',
    version: dto.version,
    name: dto.name,
    inventoryType: dto.inventoryType,
    status: dto.status,
    areaId: dto.areaId,
    locationId: dto.locationId,
    quantity: dto.quantity,
    unit: dto.unit,
  };
}

export function reservationFromDto(dto: ReservationDto): Reservation {
  return {
    id: dto.id,
    organizationId: dto.organizationId,
    siteId: undefined,
    createdAt: dto.createdAt ?? new Date().toISOString(),
    createdBy: 'system',
    updatedAt: dto.updatedAt ?? new Date().toISOString(),
    updatedBy: 'system',
    version: dto.version,
    kind: dto.kind,
    targetId: dto.targetId,
    requestId: dto.requestId,
    startAt: dto.startAt,
    endAt: dto.endAt,
    quantity: dto.quantity,
    status: dto.status,
  };
}

/**
 * Pure availability check that mirrors the gateway's
 * `checkAvailability` semantics. Useful for pre-flight validation
 * in the UI before submitting a reservation.
 */
export function computeAvailability(
  resource: ResourceDto | undefined,
  target: {
    kind: 'RESOURCE' | 'LOCATION';
    targetId: string;
    startAt: string;
    endAt: string;
    quantity: number;
  },
  existing: ReservationDto[],
): { available: boolean; conflicts: ReturnType<typeof findReservationConflicts> } {
  const domain = resource ? resourceFromDto(resource) : undefined;
  return computeAvailabilityForEntity(domain, target, existing.map(reservationFromDto));
}

export function computeAvailabilityForEntity(
  resource: Resource | undefined,
  target: {
    kind: 'RESOURCE' | 'LOCATION';
    targetId: string;
    startAt: string;
    endAt: string;
    quantity: number;
  },
  existing: Reservation[],
): { available: boolean; conflicts: ReturnType<typeof findReservationConflicts> } {
  const conflicts = findReservationConflicts(resource, target, existing);
  return { available: conflicts.length === 0, conflicts };
}

/**
 * Group resources by inventory type. Convenience for the list page
 * which surfaces the two kinds in separate sections.
 */
export function groupResourcesByType(
  resources: ResourceDto[],
): Record<ResourceInventoryType, ResourceDto[]> {
  const groups: Record<ResourceInventoryType, ResourceDto[]> = {
    SERIALIZED: [],
    QUANTITY: [],
  };
  for (const r of resources) groups[r.inventoryType].push(r);
  return groups;
}
