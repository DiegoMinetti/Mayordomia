/**
 * DTOs for the catalog endpoints.
 *
 * These mirror the JSON shape returned by the Apps Script gateway so the
 * frontend can stay loosely coupled to the schema. Future write paths can
 * extend these with the optimistic-concurrency fields required by
 * `VersionedRepository` in `src/repositories/contracts.ts`.
 */

export interface OrgDto {
  id: string;
  name: string;
  timezone: string;
  active: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SiteDto {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  active: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserDto {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  picture?: string;
  status: 'PENDING' | 'ACTIVE' | 'DISABLED';
  version: number;
}

export interface RoleDto {
  id: string;
  organizationId: string;
  name: string;
  permissionIds: string[];
  version: number;
}

export interface GatewayEnvelope<T> {
  ok: true;
  data: T;
  error?: null;
}

export interface GatewayError {
  ok: false;
  error: { code: string; message: string };
  data?: null;
}

export type GatewayResponse<T> = GatewayEnvelope<T> | GatewayError;
