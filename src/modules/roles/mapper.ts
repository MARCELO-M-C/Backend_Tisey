import type {
  PermissionRecord,
  RoleRecord,
} from "./repository";

export interface PermissionResponseDto {
  id: string;
  code: string;
  description: string | null;
}

export interface RoleResponseDto {
  id: string;
  name: string;
  usersCount: number;
}

export function toPermissionResponse(
  record: PermissionRecord,
): PermissionResponseDto {
  return {
    id: record.id.toString(),
    code: record.code,
    description: record.description ?? null,
  };
}

export function toRoleResponse(
  record: RoleRecord,
): RoleResponseDto {
  return {
    id: record.id.toString(),
    name: record.name,
    usersCount: record._count.userRoles,
  };
}
