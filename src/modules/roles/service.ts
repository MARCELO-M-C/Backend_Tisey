import {
  toPermissionResponse,
  toRoleResponse,
  type PermissionResponseDto,
  type RoleResponseDto,
} from "./mapper";
import * as rolesRepository from "./repository";
import type {
  ListRolesQueryInput,
} from "./schemas";

export class RolesServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RolesServiceError";
  }
}

async function ensureRoleExists(roleId: bigint) {
  const role = await rolesRepository.findRoleById(roleId);

  if (!role) {
    throw new RolesServiceError(
      404,
      "ROLE_NOT_FOUND",
      "Rol no encontrado.",
    );
  }

  return role;
}

export async function listRoles(
  filters: ListRolesQueryInput,
): Promise<RoleResponseDto[]> {
  const roles = await rolesRepository.listRoles(filters);
  return roles.map(toRoleResponse);
}

export async function listPermissions(): Promise<PermissionResponseDto[]> {
  const permissions =
    await rolesRepository.listPermissions();

  return permissions.map(toPermissionResponse);
}

export async function getRoleById(
  roleId: bigint,
): Promise<RoleResponseDto> {
  const role = await ensureRoleExists(roleId);
  return toRoleResponse(role);
}
