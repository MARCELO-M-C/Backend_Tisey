import type { UserRecord } from "./repository";

export interface UserPermissionDto {
  id: string;
  code: string;
  description: string | null;
}

export interface UserRoleDto {
  id: string;
  name: string;
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
  const permissionMap = new Map<string, UserPermissionDto>();

  const roles: UserRoleDto[] = record.userRoles
    .map((userRole) => {
      const rolePermissions = userRole.role.rolePermissions.map(
        (rolePermission) => {
          const permission: UserPermissionDto = {
            id: rolePermission.permission.id.toString(),
            code: rolePermission.permission.code,
            description: rolePermission.permission.description ?? null,
          };

          permissionMap.set(permission.code, permission);
          return permission;
        },
      );

      return {
        id: userRole.role.id.toString(),
        name: userRole.role.name,
        permissions: rolePermissions,
      };
    })
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
    permissions: Array.from(permissionMap.values()).sort((a, b) =>
      a.code.localeCompare(b.code),
    ),
  };
}