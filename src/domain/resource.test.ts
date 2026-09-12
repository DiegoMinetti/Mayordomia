import { describe, expect, it } from 'vitest';
import {
  computeAvailability,
  groupResourcesByType,
  inventoryTypeLabel,
  movementTypeLabel,
  reservationStatusLabel,
  resourceFromDto,
  resourceStatusColor,
  resourceStatusLabel,
} from './resource';
import type { ReservationDto, ResourceDto } from '../integrations/data/types';

const baseEntity = {
  organizationId: 'org-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  version: 1,
};

const baseResourceDto: ResourceDto = {
  id: 'res-1',
  ...baseEntity,
  name: 'Sillas plegables',
  inventoryType: 'QUANTITY',
  status: 'AVAILABLE',
  quantity: 20,
  unit: 'unidad',
};

function reservation(overrides: Partial<ReservationDto>): ReservationDto {
  return {
    id: overrides.id ?? 'resv-1',
    organizationId: 'org-1',
    kind: 'RESOURCE',
    targetId: 'res-1',
    requestId: 'req-1',
    startAt: '2026-01-02T10:00:00Z',
    endAt: '2026-01-02T12:00:00Z',
    quantity: 5,
    status: 'CONFIRMED',
    version: 1,
    ...overrides,
  };
}

describe('resource label helpers', () => {
  it('maps every resource status to a Spanish label', () => {
    expect(resourceStatusLabel('AVAILABLE')).toBe('Disponible');
    expect(resourceStatusLabel('BROKEN')).toBe('Roto');
    expect(resourceStatusLabel('RETURN_PENDING')).toBe('Devolución pendiente');
    expect(resourceStatusLabel('RETIRED')).toBe('Dado de baja');
    // unknown -> identity
    expect(resourceStatusLabel('NOPE' as never)).toBe('NOPE');
  });

  it('maps inventory types and reservation statuses', () => {
    expect(inventoryTypeLabel('SERIALIZED')).toBe('Serializado');
    expect(inventoryTypeLabel('QUANTITY')).toBe('Por cantidad');
    expect(reservationStatusLabel('PENDING_RESERVATION')).toBe('Pendiente');
    expect(reservationStatusLabel('CONFIRMED')).toBe('Confirmada');
    expect(reservationStatusLabel('CANCELLED')).toBe('Cancelada');
  });

  it('maps movement types and defaults to identity for unknown', () => {
    expect(movementTypeLabel('DELIVER')).toBe('Entrega');
    expect(movementTypeLabel('RETURN')).toBe('Devolución');
    expect(movementTypeLabel('CUSTOM_TYPE')).toBe('CUSTOM_TYPE');
  });

  it('picks a sensible MUI palette for each status', () => {
    expect(resourceStatusColor('AVAILABLE')).toBe('success');
    expect(resourceStatusColor('MAINTENANCE')).toBe('warning');
    expect(resourceStatusColor('BROKEN')).toBe('error');
    expect(resourceStatusColor('IN_USE')).toBe('info');
  });
});

describe('resourceFromDto', () => {
  it('preserves the fields needed by findReservationConflicts', () => {
    const domain = resourceFromDto(baseResourceDto);
    expect(domain).toMatchObject({
      id: 'res-1',
      name: 'Sillas plegables',
      inventoryType: 'QUANTITY',
      status: 'AVAILABLE',
      quantity: 20,
      unit: 'unidad',
    });
  });
});

describe('groupResourcesByType', () => {
  it('partitions resources into SERIALIZED and QUANTITY buckets', () => {
    const result = groupResourcesByType([
      baseResourceDto,
      { ...baseResourceDto, id: 'r2', inventoryType: 'SERIALIZED' },
      { ...baseResourceDto, id: 'r3', inventoryType: 'QUANTITY' },
    ]);
    expect(result.SERIALIZED.map((r) => r.id)).toEqual(['r2']);
    expect(result.QUANTITY.map((r) => r.id).sort()).toEqual(['r3', 'res-1']);
  });
});

describe('computeAvailability wrapper', () => {
  it('returns available when no existing reservations conflict', () => {
    const result = computeAvailability(
      baseResourceDto,
      {
        kind: 'RESOURCE',
        targetId: 'res-1',
        startAt: '2026-02-01T10:00:00Z',
        endAt: '2026-02-01T11:00:00Z',
        quantity: 5,
      },
      [],
    );
    expect(result.available).toBe(true);
    expect(result.conflicts).toEqual([]);
  });

  it('flags insufficient quantity for overlapping quantity-type reservations', () => {
    const existing = [
      reservation({
        id: 'r1',
        startAt: '2026-01-02T09:00:00Z',
        endAt: '2026-01-02T13:00:00Z',
        quantity: 15,
      }),
    ];
    const result = computeAvailability(
      baseResourceDto,
      {
        kind: 'RESOURCE',
        targetId: 'res-1',
        startAt: '2026-01-02T11:00:00Z',
        endAt: '2026-01-02T12:00:00Z',
        quantity: 10,
      },
      existing,
    );
    expect(result.available).toBe(false);
    expect(result.conflicts[0]).toMatchObject({ code: 'INSUFFICIENT_QUANTITY', available: 5 });
  });

  it('ignores CANCELLED reservations when computing availability', () => {
    const existing = [
      reservation({
        id: 'r1',
        status: 'CANCELLED',
        startAt: '2026-01-02T09:00:00Z',
        endAt: '2026-01-02T13:00:00Z',
        quantity: 20,
      }),
    ];
    const result = computeAvailability(
      baseResourceDto,
      {
        kind: 'RESOURCE',
        targetId: 'res-1',
        startAt: '2026-01-02T11:00:00Z',
        endAt: '2026-01-02T12:00:00Z',
        quantity: 20,
      },
      existing,
    );
    expect(result.available).toBe(true);
  });

  it('flags serialized overlap', () => {
    const serialized = { ...baseResourceDto, inventoryType: 'SERIALIZED' as const, quantity: 1 };
    const existing = [
      reservation({ startAt: '2026-01-02T10:30:00Z', endAt: '2026-01-02T11:30:00Z' }),
    ];
    const result = computeAvailability(
      serialized,
      {
        kind: 'RESOURCE',
        targetId: 'res-1',
        startAt: '2026-01-02T11:00:00Z',
        endAt: '2026-01-02T12:00:00Z',
        quantity: 1,
      },
      existing,
    );
    expect(result.available).toBe(false);
    expect(result.conflicts[0]).toMatchObject({ code: 'SERIALIZED_OVERLAP' });
  });

  it('flags invalid interval (end <= start)', () => {
    const result = computeAvailability(
      baseResourceDto,
      {
        kind: 'RESOURCE',
        targetId: 'res-1',
        startAt: '2026-01-02T12:00:00Z',
        endAt: '2026-01-02T10:00:00Z',
        quantity: 1,
      },
      [],
    );
    expect(result.available).toBe(false);
    expect(result.conflicts[0]).toMatchObject({ code: 'INVALID_INTERVAL' });
  });
});
