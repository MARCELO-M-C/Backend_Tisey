import type { PermissionRecord, RoleRecord } from "./repository";

export interface PermissionResponseDto {
  id: string;
  code: string;
  description: string | null;
}

export interface RoleResponseDto {
  id: string;
  name: string;
  usersCount: number;
  permissionsCount: number;
  permissions: PermissionResponseDto[];
}

export function toPermissionResponse(
  record: PermissionRecord,
): PermissionResponseDto {
  return {
    id: record.id.toString(),
    code: record.code,
    description: record.description,
  };
}

export function toRoleResponse(record: RoleRecord): RoleResponseDto {
  return {
    id: record.id.toString(),
    name: record.name,
    usersCount: record._count.userRoles,
    permissionsCount: record._count.rolePermissions,
    permissions: record.rolePermissions.map((rolePermission) => ({
      id: rolePermission.permission.id.toString(),
      code: rolePermission.permission.code,
      description: rolePermission.permission.description,
    })),
  };
}