import type { Role, User, UUID } from './models';

export interface AccessContext {
  organizationId: UUID;
  siteId?: UUID;
  areaId?: UUID;
}

/** Authorization is permission-based; role names are labels, never authority. */
export function hasPermission(
  user: User,
  roles: Role[],
  permissionIdByKey: Readonly<Record<string, UUID>>,
  permissionKey: string,
  context: AccessContext,
): boolean {
  if (user.status !== 'ACTIVE' || user.organizationId !== context.organizationId) return false;
  const permissionId = permissionIdByKey[permissionKey];
  if (!permissionId) return false;
  return roles.some(
    (role) =>
      role.organizationId === context.organizationId &&
      role.permissionIds.includes(permissionId) &&
      (!role.siteIds?.length || (!!context.siteId && role.siteIds.includes(context.siteId))) &&
      (!role.areaIds?.length || (!!context.areaId && role.areaIds.includes(context.areaId))),
  );
}
