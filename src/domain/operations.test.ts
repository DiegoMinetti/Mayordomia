import { describe, expect, it } from 'vitest';
import {
  applyReturnCondition,
  applyReturnConditionSpecs,
  deliveryProgress,
  deliveryStatusColor,
  deliveryStatusLabel,
  deriveDeliveryStatus,
  maintenanceKindLabel,
  maintenanceSeverityColor,
  maintenanceSeverityLabel,
  maintenanceStatusColor,
  maintenanceStatusLabel,
  returnConditionLabel,
  type DeliveryItemDto,
} from './operations';

function item(overrides: Partial<DeliveryItemDto> = {}): DeliveryItemDto {
  return {
    id: overrides.id ?? 'di-1',
    organizationId: 'org-1',
    deliveryId: 'd-1',
    resourceId: 'r-1',
    quantity: 1,
    version: 1,
    ...overrides,
  };
}

describe('deliveryProgress', () => {
  it('returns zeros for an empty list', () => {
    expect(deliveryProgress([])).toEqual({
      totalItems: 0,
      returnedItems: 0,
      openItems: 0,
      damageCount: 0,
    });
  });

  it('counts returned vs open items and tracks damage', () => {
    const progress = deliveryProgress([
      item({ id: 'a', returnedAt: '2026-08-30T10:00:00Z', condition: 'OK' }),
      item({ id: 'b', returnedAt: '2026-08-30T10:05:00Z', condition: 'DAMAGED' }),
      item({ id: 'c' }),
      item({ id: 'd' }),
    ]);
    expect(progress).toEqual({
      totalItems: 4,
      returnedItems: 2,
      openItems: 2,
      damageCount: 1,
    });
  });

  it('ignores returned items with condition LOST for damage count', () => {
    const progress = deliveryProgress([
      item({ id: 'a', returnedAt: '2026-08-30T10:00:00Z', condition: 'LOST' }),
      item({ id: 'b', returnedAt: '2026-08-30T10:05:00Z', condition: 'OK' }),
    ]);
    expect(progress.damageCount).toBe(0);
    expect(progress.returnedItems).toBe(2);
  });
});

describe('deriveDeliveryStatus', () => {
  it('returns DRAFT for no items', () => {
    expect(deriveDeliveryStatus([])).toBe('DRAFT');
  });

  it('returns IN_PROGRESS while any item is still open', () => {
    const status = deriveDeliveryStatus([
      item({ id: 'a', returnedAt: '2026-08-30T10:00:00Z', condition: 'OK' }),
      item({ id: 'b' }),
    ]);
    expect(status).toBe('IN_PROGRESS');
  });

  it('returns COMPLETED when every item has been returned', () => {
    const status = deriveDeliveryStatus([
      item({ id: 'a', returnedAt: '2026-08-30T10:00:00Z', condition: 'OK' }),
      item({ id: 'b', returnedAt: '2026-08-30T10:05:00Z', condition: 'DAMAGED' }),
    ]);
    expect(status).toBe('COMPLETED');
  });
});

describe('applyReturnCondition', () => {
  it.each(applyReturnConditionSpecs)(
    'maps condition $condition to the expected new state',
    ({ condition, expected }) => {
      const result = applyReturnCondition({
        currentStatus: 'IN_USE',
        inventoryType: 'SERIALIZED',
        condition,
      });
      expect(result.newStatus).toBe(expected.newStatus);
      expect(result.movementType).toBe(expected.movementType);
      expect(result.autoCreateMaintenance).toBe(expected.autoCreateMaintenance);
      expect(result.permanentlyLost).toBe(expected.permanentlyLost);
    },
  );

  it('OK path returns the resource to AVAILABLE with no maintenance', () => {
    const result = applyReturnCondition({
      currentStatus: 'IN_USE',
      inventoryType: 'SERIALIZED',
      condition: 'OK',
    });
    expect(result.newStatus).toBe('AVAILABLE');
    expect(result.movementType).toBe('RETURN');
    expect(result.autoCreateMaintenance).toBe(false);
    expect(result.permanentlyLost).toBe(false);
  });

  it('DAMAGED path marks BROKEN and asks for an auto maintenance record', () => {
    const result = applyReturnCondition({
      currentStatus: 'IN_USE',
      inventoryType: 'SERIALIZED',
      condition: 'DAMAGED',
    });
    expect(result.newStatus).toBe('BROKEN');
    expect(result.movementType).toBe('RETURN');
    expect(result.autoCreateMaintenance).toBe(true);
    expect(result.autoMaintenanceKind).toBe('CORRECTIVE');
    expect(result.autoMaintenanceSeverity).toBe('MEDIUM');
    expect(result.permanentlyLost).toBe(false);
  });

  it('LOST path marks MISSING and uses an ADJUST movement', () => {
    const result = applyReturnCondition({
      currentStatus: 'IN_USE',
      inventoryType: 'SERIALIZED',
      condition: 'LOST',
    });
    expect(result.newStatus).toBe('MISSING');
    expect(result.movementType).toBe('ADJUST');
    expect(result.autoCreateMaintenance).toBe(false);
    expect(result.permanentlyLost).toBe(true);
  });
});

describe('label helpers', () => {
  it('exposes a Spanish label for every delivery status', () => {
    expect(deliveryStatusLabel('DRAFT')).toBe('Borrador');
    expect(deliveryStatusLabel('IN_PROGRESS')).toBe('En curso');
    expect(deliveryStatusLabel('COMPLETED')).toBe('Completada');
    expect(deliveryStatusLabel('CANCELLED')).toBe('Cancelada');
  });

  it('maps delivery status to a chip color', () => {
    expect(deliveryStatusColor('COMPLETED')).toBe('success');
    expect(deliveryStatusColor('IN_PROGRESS')).toBe('info');
    expect(deliveryStatusColor('CANCELLED')).toBe('default');
    expect(deliveryStatusColor('DRAFT')).toBe('warning');
  });

  it('exposes a Spanish label for every maintenance status', () => {
    expect(maintenanceStatusLabel('OPEN')).toBe('Abierta');
    expect(maintenanceStatusLabel('IN_PROGRESS')).toBe('En curso');
    expect(maintenanceStatusLabel('RESOLVED')).toBe('Resuelta');
    expect(maintenanceStatusLabel('CANCELLED')).toBe('Cancelada');
  });

  it('exposes a Spanish label for every maintenance kind', () => {
    expect(maintenanceKindLabel('CORRECTIVE')).toBe('Correctiva');
    expect(maintenanceKindLabel('PREVENTIVE')).toBe('Preventiva');
    expect(maintenanceKindLabel('INSPECTION')).toBe('Inspección');
  });

  it('exposes a Spanish label for every maintenance severity', () => {
    expect(maintenanceSeverityLabel('LOW')).toBe('Baja');
    expect(maintenanceSeverityLabel('MEDIUM')).toBe('Media');
    expect(maintenanceSeverityLabel('HIGH')).toBe('Alta');
    expect(maintenanceSeverityLabel('CRITICAL')).toBe('Crítica');
  });

  it('exposes a Spanish label for every return condition', () => {
    expect(returnConditionLabel('OK')).toBe('OK');
    expect(returnConditionLabel('DAMAGED')).toBe('Dañado');
    expect(returnConditionLabel('LOST')).toBe('Faltante');
  });
});

describe('color helpers', () => {
  it('maps severity to a chip color', () => {
    expect(maintenanceSeverityColor('LOW')).toBe('info');
    expect(maintenanceSeverityColor('MEDIUM')).toBe('warning');
    expect(maintenanceSeverityColor('HIGH')).toBe('error');
    expect(maintenanceSeverityColor('CRITICAL')).toBe('error');
  });

  it('maps status to a chip color', () => {
    expect(maintenanceStatusColor('OPEN')).toBe('warning');
    expect(maintenanceStatusColor('IN_PROGRESS')).toBe('info');
    expect(maintenanceStatusColor('RESOLVED')).toBe('success');
    expect(maintenanceStatusColor('CANCELLED')).toBe('default');
  });
});
