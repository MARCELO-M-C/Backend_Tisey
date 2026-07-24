import type { UserRecord } from "./repository";

export interface UserPermissionDto {
  id: string;
  code: string;
  description: string | null;
}

export interface UserRoleDto {
  id: string;
  name: string;

  /**
   * Se conserva vacío para mantener compatibilidad temporal con el frontend.
   * Los permisos pertenecen directamente al usuario.
   */
  permissions: UserPermissionDto[];
}

export interface UserResponseDto {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  roles: UserRoleDto[];
  permissions: UserPermissionDto[];
}

export function toUserResponse(record: UserRecord): UserResponseDto {
  const roles: UserRoleDto[] = record.userRoles
    .map((userRole) => ({
      id: userRole.role.id.toString(),
      name: userRole.role.name,
      permissions: [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const permissions: UserPermissionDto[] = record.userPermissions
    .map((userPermission) => ({
      id: userPermission.permission.id.toString(),
      code: userPermission.permission.code,
      description: userPermission.permission.description ?? null,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

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
