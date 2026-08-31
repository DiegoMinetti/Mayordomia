import type { GatewayClient } from './GatewayClient';
import type { OrgDto, RoleDto, SiteDto, UserDto } from './types';

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
}
