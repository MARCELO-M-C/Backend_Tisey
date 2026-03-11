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

function mapPermissions(
  record: AuthUserRecord,
): { flat: AuthPermissionDto[]; grouped: Map<string, AuthPermissionDto[]> } {
  const flatMap = new Map<string, AuthPermissionDto>();
  const grouped = new Map<string, AuthPermissionDto[]>();

  for (const userRole of record.userRoles) {
    const rolePermissions: AuthPermissionDto[] = [];

    for (const rolePermission of userRole.role.rolePermissions) {
      const permission: AuthPermissionDto = {
        id: rolePermission.permission.id.toString(),
        code: rolePermission.permission.code,
        description: rolePermission.permission.description ?? null,
      };

      flatMap.set(permission.code, permission);
      rolePermissions.push(permission);
    }

    grouped.set(userRole.role.id.toString(), rolePermissions);
  }

  return {
    flat: Array.from(flatMap.values()).sort((a, b) =>
      a.code.localeCompare(b.code),
    ),
    grouped,
  };
}

export function toAuthUserDto(record: AuthUserRecord): AuthUserDto {
  const { flat, grouped } = mapPermissions(record);

  const roles: AuthRoleDto[] = record.userRoles
    .map((userRole) => ({
      id: userRole.role.id.toString(),
      name: userRole.role.name,
      permissions: grouped.get(userRole.role.id.toString()) ?? [],
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
    permissions: flat,
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