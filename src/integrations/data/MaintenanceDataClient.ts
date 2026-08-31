/**
 * MaintenanceDataClient — typed wrapper for the `maintenance.*` gateway actions.
 *
 * Same pattern as `RequestsDataClient` / `OperationsDataClient`.
 */
import type { GatewayClient } from './GatewayClient';
import type {
  CreateMaintenancePayload,
  MaintenanceDto,
  MaintenanceListFilters,
  MaintenanceUpdateDto,
  UpdateMaintenancePayload,
} from './types';

export interface MaintenanceDataClientOptions {
  organizationId: string;
}

export interface MaintenanceWithUpdates {
  maintenance: MaintenanceDto;
  updates: MaintenanceUpdateDto[];
  resource?: { id: string; name: string; status: string };
}

export class MaintenanceDataClient {
  constructor(
    private readonly gateway: GatewayClient,
    private readonly opts: MaintenanceDataClientOptions,
  ) {}

  async listMaintenance(filters: MaintenanceListFilters = {}): Promise<MaintenanceDto[]> {
    const payload: Record<string, unknown> = {};
    if (filters.status) payload['status'] = filters.status;
    if (filters.kind) payload['kind'] = filters.kind;
    if (filters.severity) payload['severity'] = filters.severity;
    if (filters.resourceId) payload['resourceId'] = filters.resourceId;
    if (filters.siteId) payload['siteId'] = filters.siteId;
    const res = await this.gateway.call<{ maintenance: MaintenanceDto[] }>(
      'maintenance.list',
      this.opts.organizationId,
      payload,
    );
    if (!res.ok) return [];
    return res.data.maintenance;
  }

  async getMaintenance(id: string): Promise<MaintenanceWithUpdates | null> {
    const res = await this.gateway.call<MaintenanceWithUpdates>(
      'maintenance.get',
      this.opts.organizationId,
      { id },
    );
    if (!res.ok) return null;
    return res.data;
  }

  async createMaintenance(payload: CreateMaintenancePayload): Promise<MaintenanceDto | null> {
    const res = await this.gateway.call<{ maintenance: MaintenanceDto }>(
      'maintenance.create',
      this.opts.organizationId,
      { ...payload },
    );
    if (!res.ok) return null;
    return res.data.maintenance;
  }

  async updateMaintenance(payload: UpdateMaintenancePayload): Promise<MaintenanceDto | null> {
    const res = await this.gateway.call<{ maintenance: MaintenanceDto }>(
      'maintenance.update',
      this.opts.organizationId,
      { ...payload },
    );
    if (!res.ok) return null;
    return res.data.maintenance;
  }
}
