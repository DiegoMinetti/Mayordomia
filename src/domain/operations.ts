/**
 * PR 3a — Operations & Maintenance domain helpers.
 *
 * Pure helpers that both the Apps Script gateway (`Operations.gs`,
 * `Maintenance.gs`) and the frontend agree on. The Apps Script port
 * of `applyReturnCondition` lives next to this file in
 * `apps-script/Operations.gs`; both implementations MUST stay in sync
 * (see `applyReturnCondition.specs.ts` for the shared truth).
 */
import type { ResourceStatusDto } from '../integrations/data/types';

/* -------------------------------------------------------------------------- */
/*  DTOs                                                                      */
/* -------------------------------------------------------------------------- */

export type DeliveryStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type ReturnCondition = 'OK' | 'DAMAGED' | 'LOST';

export interface DeliveryDto {
  id: string;
  organizationId: string;
  requestId: string;
  deliveredBy: string;
  deliveredAt: string;
  siteId?: string;
  recipientName: string;
  notes?: string;
  status: DeliveryStatus;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
  updatedBy: string;
  version: number;
}

export interface DeliveryItemDto {
  id: string;
  organizationId: string;
  deliveryId: string;
  resourceId: string;
  quantity: number;
  returnedAt?: string;
  returnedBy?: string;
  returnNotes?: string;
  returnedQuantity?: number;
  condition?: ReturnCondition;
  version: number;
}

export interface DeliveryDetailDto extends DeliveryDto {
  items: DeliveryItemDto[];
  progress: DeliveryProgress;
  /** Joined request info for the header. */
  request?: {
    id: string;
    type: string;
    requesterName: string;
    description: string;
    eventStart?: string;
    eventEnd?: string;
    siteId?: string;
  };
  /** Resolved resource metadata for each item. */
  resources?: Record<string, { id: string; name: string; status: ResourceStatusDto }>;
}

export type MaintenanceKind = 'CORRECTIVE' | 'PREVENTIVE' | 'INSPECTION';
export type MaintenanceSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MaintenanceStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';
export type MaintenanceUpdateKind = 'NOTE' | 'STATUS' | 'COST' | 'RESOLUTION';

export interface MaintenanceUpdateDto {
  id: string;
  organizationId: string;
  maintenanceId: string;
  authorId: string;
  at: string;
  kind: MaintenanceUpdateKind;
  text: string;
  createdAt: string;
  version: number;
}

export interface MaintenanceDto {
  id: string;
  organizationId: string;
  siteId?: string;
  resourceId?: string;
  reportedBy: string;
  reportedAt: string;
  kind: MaintenanceKind;
  severity: MaintenanceSeverity;
  status: MaintenanceStatus;
  description: string;
  resolution?: string;
  cost?: number;
  supplierId?: string;
  startedAt?: string;
  resolvedAt?: string;
  sourceDeliveryItemId?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
  updatedBy: string;
  version: number;
}

export interface MaintenanceDetailDto extends MaintenanceDto {
  updates: MaintenanceUpdateDto[];
  resource?: { id: string; name: string; status: ResourceStatusDto };
}

/* -------------------------------------------------------------------------- */
/*  Write payloads                                                            */
/* -------------------------------------------------------------------------- */

export interface DeliverPayload {
  /** Idempotency key — re-running the same call returns the existing delivery. */
  idempotencyKey: string;
  requestId: string;
  expectedVersion: number;
  deliveredBy: string;
  deliveredAt?: string;
  siteId?: string;
  recipientName: string;
  notes?: string;
  items: Array<{ resourceId: string; quantity: number }>;
}

export interface ReturnDeliveryItemPayload {
  deliveryItemId: string;
  expectedVersion: number;
  condition: ReturnCondition;
  returnedBy: string;
  returnedAt?: string;
  returnedQuantity?: number;
  notes?: string;
}

export interface CreateMaintenancePayload {
  resourceId?: string;
  siteId?: string;
  kind: MaintenanceKind;
  severity: MaintenanceSeverity;
  description: string;
  reportedBy: string;
  sourceDeliveryItemId?: string;
}

export interface UpdateMaintenancePayload {
  id: string;
  expectedVersion: number;
  /** Optional status change (e.g. OPEN -> IN_PROGRESS). */
  status?: MaintenanceStatus;
  /** Optional resolution (sets status=RESOLVED + resolvedAt). */
  resolution?: string;
  /** Optional cost update. */
  cost?: number;
  /** Optional note / update. */
  note?: string;
  /** Caller id for the new update entry. */
  actorId: string;
}

/* -------------------------------------------------------------------------- */
/*  Pure helpers — shared with Apps Script                                    */
/* -------------------------------------------------------------------------- */

export interface DeliveryProgress {
  totalItems: number;
  returnedItems: number;
  openItems: number;
  damageCount: number;
}

/** Roll up the item-level status into a single delivery-level progress object. */
export function deliveryProgress(items: DeliveryItemDto[]): DeliveryProgress {
  let total = 0;
  let returned = 0;
  let damage = 0;
  for (const item of items) {
    total += 1;
    if (item.returnedAt) {
      returned += 1;
      if (item.condition === 'DAMAGED') damage += 1;
    }
  }
  return {
    totalItems: total,
    returnedItems: returned,
    openItems: total - returned,
    damageCount: damage,
  };
}

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  OPEN: 'Abierta',
  IN_PROGRESS: 'En curso',
  RESOLVED: 'Resuelta',
  CANCELLED: 'Cancelada',
};

export const MAINTENANCE_KIND_LABELS: Record<MaintenanceKind, string> = {
  CORRECTIVE: 'Correctiva',
  PREVENTIVE: 'Preventiva',
  INSPECTION: 'Inspección',
};

export const MAINTENANCE_SEVERITY_LABELS: Record<MaintenanceSeverity, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = {
  OK: 'OK',
  DAMAGED: 'Dañado',
  LOST: 'Faltante',
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  DRAFT: 'Borrador',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
};

export function deliveryStatusLabel(status: DeliveryStatus): string {
  return DELIVERY_STATUS_LABELS[status] ?? status;
}

export function maintenanceStatusLabel(status: MaintenanceStatus): string {
  return MAINTENANCE_STATUS_LABELS[status] ?? status;
}

export function maintenanceKindLabel(kind: MaintenanceKind): string {
  return MAINTENANCE_KIND_LABELS[kind] ?? kind;
}

export function maintenanceSeverityLabel(severity: MaintenanceSeverity): string {
  return MAINTENANCE_SEVERITY_LABELS[severity] ?? severity;
}

export function returnConditionLabel(condition: ReturnCondition): string {
  return RETURN_CONDITION_LABELS[condition] ?? condition;
}

/**
 * Map severity to a chip color hint, matching the rest of the app's palette.
 */
export function maintenanceSeverityColor(
  severity: MaintenanceSeverity,
): 'success' | 'warning' | 'info' | 'error' | 'default' {
  switch (severity) {
    case 'LOW':
      return 'info';
    case 'MEDIUM':
      return 'warning';
    case 'HIGH':
      return 'error';
    case 'CRITICAL':
      return 'error';
    default:
      return 'default';
  }
}

export function maintenanceStatusColor(
  status: MaintenanceStatus,
): 'success' | 'warning' | 'info' | 'error' | 'default' {
  switch (status) {
    case 'OPEN':
      return 'warning';
    case 'IN_PROGRESS':
      return 'info';
    case 'RESOLVED':
      return 'success';
    case 'CANCELLED':
      return 'default';
    default:
      return 'default';
  }
}

export function deliveryStatusColor(
  status: DeliveryStatus,
): 'success' | 'warning' | 'info' | 'error' | 'default' {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'IN_PROGRESS':
      return 'info';
    case 'CANCELLED':
      return 'default';
    case 'DRAFT':
    default:
      return 'warning';
  }
}

/* -------------------------------------------------------------------------- */
/*  applyReturnCondition — the shared business rule                           */
/* -------------------------------------------------------------------------- */

export interface ApplyReturnInput {
  /** Current resource status, before the return. */
  currentStatus: ResourceStatusDto;
  /** Resource inventory type, used to decide between DELIVERED vs IN_USE. */
  inventoryType: 'SERIALIZED' | 'QUANTITY';
  condition: ReturnCondition;
  /** Whether the event window has started; influences DELIVERED vs IN_USE. */
  eventInProgress?: boolean;
}

export interface ApplyReturnResult {
  /** The new resource status after the return. */
  newStatus: ResourceStatusDto;
  /** The movement type that should be recorded. */
  movementType: 'RETURN' | 'ADJUST';
  /** When true, the caller should also create a Maintenance record. */
  autoCreateMaintenance: boolean;
  /** Default severity for the auto-created maintenance record. */
  autoMaintenanceSeverity?: MaintenanceSeverity;
  /** Default kind for the auto-created maintenance record. */
  autoMaintenanceKind?: MaintenanceKind;
  /** True if the resource left the org's inventory permanently. */
  permanentlyLost: boolean;
}

/**
 * Decide what happens to a resource when it is returned in a given
 * condition. Used by the gateway to set `Resources.status` and to know
 * whether to spawn a maintenance record automatically (DAMAGED path).
 *
 * Rules:
 *   - OK     -> AVAILABLE
 *   - DAMAGED -> BROKEN  (auto-create maintenance, kind=CORRECTIVE, severity=MEDIUM)
 *   - LOST   -> MISSING (movement type = ADJUST, no maintenance)
 *
 * The Apps Script port of this function must stay in lock-step — see the
 * `applyReturnCondition.specs` constant in this file for the canonical
 * truth table.
 */
export function applyReturnCondition(input: ApplyReturnInput): ApplyReturnResult {
  switch (input.condition) {
    case 'OK':
      return {
        newStatus: 'AVAILABLE',
        movementType: 'RETURN',
        autoCreateMaintenance: false,
        permanentlyLost: false,
      };
    case 'DAMAGED':
      return {
        newStatus: 'BROKEN',
        movementType: 'RETURN',
        autoCreateMaintenance: true,
        autoMaintenanceKind: 'CORRECTIVE',
        autoMaintenanceSeverity: 'MEDIUM',
        permanentlyLost: false,
      };
    case 'LOST':
      return {
        newStatus: 'MISSING',
        movementType: 'ADJUST',
        autoCreateMaintenance: false,
        permanentlyLost: true,
      };
    default: {
      // exhaustive fallback: treat as OK to keep inventory flowing.
      return {
        newStatus: 'AVAILABLE',
        movementType: 'RETURN',
        autoCreateMaintenance: false,
        permanentlyLost: false,
      };
    }
  }
}

/**
 * Canonical truth table for `applyReturnCondition`. Kept as a data
 * structure so the Apps Script tests can import it and assert that the
 * .gs port produces the same outputs.
 */
export const applyReturnConditionSpecs: ReadonlyArray<{
  condition: ReturnCondition;
  expected: Pick<
    ApplyReturnResult,
    'newStatus' | 'movementType' | 'autoCreateMaintenance' | 'permanentlyLost'
  >;
}> = [
  {
    condition: 'OK',
    expected: {
      newStatus: 'AVAILABLE',
      movementType: 'RETURN',
      autoCreateMaintenance: false,
      permanentlyLost: false,
    },
  },
  {
    condition: 'DAMAGED',
    expected: {
      newStatus: 'BROKEN',
      movementType: 'RETURN',
      autoCreateMaintenance: true,
      permanentlyLost: false,
    },
  },
  {
    condition: 'LOST',
    expected: {
      newStatus: 'MISSING',
      movementType: 'ADJUST',
      autoCreateMaintenance: false,
      permanentlyLost: true,
    },
  },
];

/* -------------------------------------------------------------------------- */
/*  Derived: delivery -> request status                                       */
/* -------------------------------------------------------------------------- */

/**
 * Compute the derived delivery status. A delivery is:
 *   - DRAFT       if no items have been delivered yet (not used in this PR)
 *   - IN_PROGRESS once items are out and any are still open
 *   - COMPLETED   when every item has been returned
 *   - CANCELLED   if explicitly cancelled (not used in this PR)
 */
export function deriveDeliveryStatus(items: DeliveryItemDto[]): DeliveryStatus {
  if (!items.length) return 'DRAFT';
  const progress = deliveryProgress(items);
  if (progress.openItems === 0 && progress.returnedItems > 0) return 'COMPLETED';
  return 'IN_PROGRESS';
}
