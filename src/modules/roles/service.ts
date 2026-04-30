import {
  toPermissionResponse,
  toRoleResponse,
  type PermissionResponseDto,
  type RoleResponseDto,
} from "./mapper";
import * as rolesRepository from "./repository";
import type {
  CreateRoleBodyInput,
  ListRolesQueryInput,
  UpdateRoleBodyInput,
  UpdateRolePermissionsBodyInput,
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

function normalizeRoleName(name: string): string {
  return name.trim().toUpperCase();
}

function uniqueBigIntValues(values: bigint[]): bigint[] {
  return [...new Set(values.map((value) => value.toString()))].map((value) =>
    BigInt(value),
  );
}

async function ensureRoleExists(roleId: bigint) {
  const role = await rolesRepository.findRoleById(roleId);

  if (!role) {
    throw new RolesServiceError(404, "ROLE_NOT_FOUND", "Rol no encontrado.");
  }

  return role;
}

async function ensureRoleNameIsAvailable(
  name: string,
  currentRoleId?: bigint,
): Promise<void> {
  const existingRole = await rolesRepository.findRoleByName(name);

  if (existingRole && existingRole.id !== currentRoleId) {
    throw new RolesServiceError(
      409,
      "ROLE_NAME_ALREADY_EXISTS",
      "Ya existe un rol con ese nombre.",
    );
  }
}

async function ensurePermissionsExist(permissionIds: bigint[]): Promise<bigint[]> {
  const uniquePermissionIds = uniqueBigIntValues(permissionIds);

  if (uniquePermissionIds.length === 0) {
    return [];
  }

  const existingPermissionsCount =
    await rolesRepository.countPermissionsByIds(uniquePermissionIds);

  if (existingPermissionsCount !== uniquePermissionIds.length) {
    throw new RolesServiceError(
      400,
      "INVALID_PERMISSION_IDS",
      "Uno o más permisos no existen.",
    );
  }

  return uniquePermissionIds;
}

export async function listRoles(
  filters: ListRolesQueryInput,
): Promise<RoleResponseDto[]> {
  const roles = await rolesRepository.listRoles(filters);
  return roles.map(toRoleResponse);
}

export async function listPermissions(): Promise<PermissionResponseDto[]> {
  const permissions = await rolesRepository.listPermissions();
  return permissions.map(toPermissionResponse);
}

export async function getRoleById(roleId: bigint): Promise<RoleResponseDto> {
  const role = await ensureRoleExists(roleId);
  return toRoleResponse(role);
}

export async function createRole(
  input: CreateRoleBodyInput,
): Promise<RoleResponseDto> {
  const normalizedName = normalizeRoleName(input.name);

  await ensureRoleNameIsAvailable(normalizedName);

  const permissionIds = await ensurePermissionsExist(input.permissionIds);

  const createdRole = await rolesRepository.createRole({
    name: normalizedName,
    permissionIds,
  });

  return toRoleResponse(createdRole);
}

export async function updateRole(
  roleId: bigint,
  input: UpdateRoleBodyInput,
): Promise<RoleResponseDto> {
  const currentRole = await ensureRoleExists(roleId);
  const normalizedName = normalizeRoleName(input.name);

  if (normalizedName !== currentRole.name) {
    await ensureRoleNameIsAvailable(normalizedName, roleId);
  }

  const updatedRole = await rolesRepository.updateRole(roleId, {
    name: normalizedName,
  });

  return toRoleResponse(updatedRole);
}

export async function updateRolePermissions(
  roleId: bigint,
  input: UpdateRolePermissionsBodyInput,
): Promise<RoleResponseDto> {
  await ensureRoleExists(roleId);

  const permissionIds = await ensurePermissionsExist(input.permissionIds);

  const updatedRole = await rolesRepository.replaceRolePermissions(
    roleId,
    permissionIds,
  );

  return toRoleResponse(updatedRole);
}