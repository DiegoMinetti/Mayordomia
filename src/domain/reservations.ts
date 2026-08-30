import type { Reservation, Resource, UUID } from './models';

export interface ReservationConflict {
  code:
    | 'INVALID_INTERVAL'
    | 'UNAVAILABLE_RESOURCE'
    | 'SERIALIZED_OVERLAP'
    | 'INSUFFICIENT_QUANTITY'
    | 'LOCATION_OVERLAP';
  reservationIds?: UUID[];
  available?: number;
}
const blocks = (status: Reservation['status']) => status !== 'CANCELLED';
const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);

export function findReservationConflicts(
  resource: Resource | undefined,
  candidate: Pick<Reservation, 'kind' | 'targetId' | 'startAt' | 'endAt' | 'quantity'>,
  existing: Reservation[],
): ReservationConflict[] {
  if (new Date(candidate.startAt) >= new Date(candidate.endAt))
    return [{ code: 'INVALID_INTERVAL' }];
  const concurrent = existing.filter(
    (r) =>
      blocks(r.status) &&
      r.targetId === candidate.targetId &&
      overlaps(r.startAt, r.endAt, candidate.startAt, candidate.endAt),
  );
  if (candidate.kind === 'LOCATION')
    return concurrent.length
      ? [{ code: 'LOCATION_OVERLAP', reservationIds: concurrent.map((r) => r.id) }]
      : [];
  if (!resource || ['MAINTENANCE', 'BROKEN', 'MISSING', 'RETIRED'].includes(resource.status))
    return [{ code: 'UNAVAILABLE_RESOURCE' }];
  if (resource.inventoryType === 'SERIALIZED')
    return concurrent.length
      ? [{ code: 'SERIALIZED_OVERLAP', reservationIds: concurrent.map((r) => r.id) }]
      : [];
  const available = resource.quantity - concurrent.reduce((sum, r) => sum + r.quantity, 0);
  return candidate.quantity > available
    ? [{ code: 'INSUFFICIENT_QUANTITY', reservationIds: concurrent.map((r) => r.id), available }]
    : [];
}
