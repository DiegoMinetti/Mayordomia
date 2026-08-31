import type { GatewayClient } from './GatewayClient';
import type {
  AvailabilityItem,
  AvailabilityResult,
  LocationDto,
  LocationFilters,
  MovementDto,
  ReservationDto,
  ReservationFilters,
  ResourceDto,
  ResourceFilters,
  OrgDto,
  RoleDto,
  SiteDto,
  UserDto,
} from './types';

export interface DataClientOptions {
  organizationId: string;
}

export class DataClient {
  constructor(
    private readonly gateway: GatewayClient,
    private readonly opts: DataClientOptions,
  ) {}

  async getOrganization(): Promise<OrgDto | undefined> {
    const res = await this.gateway.call<{ organization: OrgDto }>(
      'catalog.organization',
      this.opts.organizationId,
    );
    if (!res.ok) return undefined;
    return res.data.organization;
  }

  async listOrganizations(): Promise<OrgDto[]> {
    const res = await this.gateway.call<{ organizations: OrgDto[] }>(
      'catalog.listOrganizations',
      this.opts.organizationId,
    );
    if (!res.ok) return [];
    return res.data.organizations;
  }

  async listSites(): Promise<SiteDto[]> {
    const res = await this.gateway.call<{ sites: SiteDto[] }>(
      'catalog.listSites',
      this.opts.organizationId,
    );
    if (!res.ok) return [];
    return res.data.sites;
  }

  async listUsers(): Promise<UserDto[]> {
    const res = await this.gateway.call<{ users: UserDto[] }>(
      'catalog.listUsers',
      this.opts.organizationId,
    );
    if (!res.ok) return [];
    return res.data.users;
  }

  async listRoles(): Promise<RoleDto[]> {
    const res = await this.gateway.call<{ roles: RoleDto[] }>(
      'catalog.listRoles',
      this.opts.organizationId,
    );
    if (!res.ok) return [];
    return res.data.roles;
  }

  /* ----------------------------------------------------------------------- */
  /*  PR 1B — Recursos / Espacios / Reservas / Movimientos                   */
  /* ----------------------------------------------------------------------- */

  async listResources(filters: ResourceFilters = {}): Promise<ResourceDto[]> {
    const res = await this.gateway.call<{ resources: ResourceDto[] }>(
      'resources.list',
      this.opts.organizationId,
      { ...filters },
    );
    if (!res.ok) return [];
    return res.data.resources;
  }

  async getResource(id: string): Promise<ResourceDto | undefined> {
    const res = await this.gateway.call<{ resource: ResourceDto; movements: MovementDto[] }>(
      'resources.get',
      this.opts.organizationId,
      { id },
    );
    if (!res.ok) return undefined;
    return res.data.resource;
  }

  async getResourceWithMovements(
    id: string,
  ): Promise<{ resource: ResourceDto; movements: MovementDto[] } | undefined> {
    const res = await this.gateway.call<{ resource: ResourceDto; movements: MovementDto[] }>(
      'resources.get',
      this.opts.organizationId,
      { id },
    );
    if (!res.ok) return undefined;
    return { resource: res.data.resource, movements: res.data.movements };
  }

  async listLocations(filters: LocationFilters = {}): Promise<LocationDto[]> {
    const res = await this.gateway.call<{ locations: LocationDto[] }>(
      'resources.listLocations',
      this.opts.organizationId,
      { ...filters },
    );
    if (!res.ok) return [];
    return res.data.locations;
  }

  async getLocation(id: string): Promise<LocationDto | undefined> {
    const res = await this.gateway.call<{ location: LocationDto }>(
      'resources.getLocation',
      this.opts.organizationId,
      { id },
    );
    if (!res.ok) return undefined;
    return res.data.location;
  }

  async listReservations(filters: ReservationFilters = {}): Promise<ReservationDto[]> {
    const res = await this.gateway.call<{ reservations: ReservationDto[] }>(
      'resources.listReservations',
      this.opts.organizationId,
      { ...filters },
    );
    if (!res.ok) return [];
    return res.data.reservations;
  }

  async listMovements(resourceId?: string, limit?: number): Promise<MovementDto[]> {
    const payload: Record<string, unknown> = {};
    if (resourceId) payload.resourceId = resourceId;
    if (typeof limit === 'number') payload.limit = limit;
    const res = await this.gateway.call<{ movements: MovementDto[] }>(
      'resources.listMovements',
      this.opts.organizationId,
      payload,
    );
    if (!res.ok) return [];
    return res.data.movements;
  }

  async checkAvailability(items: AvailabilityItem[]): Promise<AvailabilityResult> {
    const res = await this.gateway.call<AvailabilityResult>(
      'resources.checkAvailability',
      this.opts.organizationId,
      { items },
    );
    if (!res.ok) {
      return { available: { resource: {}, location: {} }, conflicts: [] };
    }
    return res.data;
  }
}
