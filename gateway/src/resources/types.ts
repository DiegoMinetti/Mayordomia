/**
 * Domain types for the Resources module. Mirrors apps-script/Resources.gs.
 */
export const RESOURCE_KINDS = [
  'PHYSICAL',
  'PERSON',
  'LOCATION',
  'SERVICE',
  'MAINTENANCE',
  'PURCHASE',
] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const RESOURCE_STATUSES = ['ACTIVE', 'MAINTENANCE', 'RETIRED'] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

export const LOCATION_KINDS = ['ROOM', 'AREA', 'BUILDING', 'VEHICLE', 'OTHER'] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export interface ResourceRow {
  id: string;
  organizationId: string;
  siteId?: string;
  kind: string;
  name: string;
  description?: string;
  status: string;
  areaId?: string;
  createdAt: string;
  updatedAt?: string;
  version: number;
}

export interface LocationRow {
  id: string;
  organizationId: string;
  siteId: string;
  kind: string;
  name: string;
  address?: string;
  parentId?: string;
  createdAt: string;
  updatedAt?: string;
  version: number;
}
