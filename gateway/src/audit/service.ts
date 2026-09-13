/**
 * AuditService — writes to the AuditLog sheet. Mirrors apps-script/Audit.gs.
 * Failures are logged but never throw (audit must not break user requests).
 */
import type { Logger } from '../logging.js';
import type { SheetsClient } from '../sheets/client.js';
import { randomUUID } from 'node:crypto';

export interface AuditEntry {
  organizationId?: string;
  actorId?: string;
  actorType?: 'USER' | 'SYSTEM' | 'PUBLIC';
  action: string;
  entityType?: string;
  entityId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export function makeAuditService(sheets: SheetsClient, logger: Logger) {
  return {
    async record(entry: AuditEntry): Promise<void> {
      try {
        await sheets.append('AuditLog', {
          id: randomUUID(),
          organizationId: entry.organizationId ?? '',
          actorId: entry.actorId ?? '',
          actorType: entry.actorType ?? 'SYSTEM',
          action: entry.action,
          entityType: entry.entityType ?? '',
          entityId: entry.entityId ?? '',
          requestId: entry.requestId ?? '',
          occurredAt: new Date().toISOString(),
          metadataJson: JSON.stringify(entry.metadata ?? {}),
        });
      } catch (error) {
        logger.error({ err: error, action: entry.action }, 'AUDIT_WRITE_FAILED');
      }
    },
  };
}

export type AuditService = ReturnType<typeof makeAuditService>;
