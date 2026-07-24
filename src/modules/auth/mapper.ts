import type { AuthUserRecord } from "./repository";

export interface AuthPermissionDto {
  id: string;
  code: string;
  description: string | null;
}

export interface AuthRoleDto {
  id: string;
  name: string;  
  permissions: AuthPermissionDto[];
}

export interface AuthUserDto {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  roles: AuthRoleDto[];
  permissions: AuthPermissionDto[];
}

export interface AuthTokenPayload {
  sub: string;
  username: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
}

function mapUserPermissions(record: AuthUserRecord): AuthPermissionDto[] {
  const permissionsByCode = new Map<string, AuthPermissionDto>();

  for (const userPermission of record.userPermissions) {
    const permission: AuthPermissionDto = {
      id: userPermission.permission.id.toString(),
      code: userPermission.permission.code,
      description: userPermission.permission.description ?? null,
    };

    permissionsByCode.set(permission.code, permission);
  }

  return Array.from(permissionsByCode.values()).sort((a, b) =>
    a.code.localeCompare(b.code),
  );
}

export function toAuthUserDto(record: AuthUserRecord): AuthUserDto {
  const permissions = mapUserPermissions(record);

  const roles: AuthRoleDto[] = record.userRoles
    .map((userRole) => ({
      id: userRole.role.id.toString(),
      name: userRole.role.name,
      permissions: [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    id: record.id.toString(),
    username: record.username,
    firstName: record.firstName,
    lastName: record.lastName,
    fullName: `${record.firstName} ${record.lastName}`.trim(),
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    roles,
    permissions,
  };
}

export function toAuthTokenPayload(record: AuthUserRecord): AuthTokenPayload {
  const dto = toAuthUserDto(record);

  return {
    sub: dto.id,
    username: dto.username,
    firstName: dto.firstName,
    lastName: dto.lastName,
    roles: dto.roles.map((role) => role.name),
    permissions: dto.permissions.map((permission) => permission.code),
  };
}
