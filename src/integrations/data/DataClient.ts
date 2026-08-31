import type { GatewayClient } from './GatewayClient';
import type {
  AvailabilityItem,
  AvailabilityResult,
  EventDetailDto,
  EventDto,
  EventFilters,
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

  /* ----------------------------------------------------------------------- */
  /*  PR 1C — Eventos / Agenda                                               */
  /* ----------------------------------------------------------------------- */

  async listEvents(filters: EventFilters = {}): Promise<EventDto[]> {
    const res = await this.gateway.call<{ events: EventDto[] }>(
      'events.list',
      this.opts.organizationId,
      filters as Record<string, unknown>,
    );
    if (!res.ok) return [];
    return res.data.events;
  }

  async getEvent(id: string): Promise<EventDetailDto | undefined> {
    const res = await this.gateway.call<{ event: EventDetailDto }>(
      'events.get',
      this.opts.organizationId,
      { id },
    );
    if (!res.ok) return undefined;
    return res.data.event;
  }

  async upcomingEvents(daysAhead = 14): Promise<EventDto[]> {
    const res = await this.gateway.call<{ events: EventDto[] }>(
      'events.upcoming',
      this.opts.organizationId,
      { days: daysAhead },
    );
    if (!res.ok) return [];
    return res.data.events;
  }
}
