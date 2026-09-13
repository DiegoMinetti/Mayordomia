/**
 * Domain types for the Events module. Mirrors apps-script/Events.gs.
 */
export const EVENT_KINDS = ['SERVICE', 'ACTIVITY', 'MEETING', 'OTHER'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_STATUSES = [
  'DRAFT',
  'PLANNED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export interface EventRow {
  id: string;
  organizationId: string;
  siteId?: string;
  kind: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  status: string;
  templateId?: string;
  leadByUserId?: string;
  createdAt: string;
  updatedAt?: string;
  version: number;
}

export interface EventAreaRow {
  id: string;
  organizationId: string;
  eventId: string;
  areaId: string;
  responsibleUserId?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  version: number;
}

export interface EventResourceRow {
  id: string;
  organizationId: string;
  eventId: string;
  resourceId: string;
  quantity: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  version: number;
}
