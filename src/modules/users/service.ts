import bcrypt from "bcryptjs";
import { toUserResponse, type UserResponseDto } from "./mapper";
import * as usersRepository from "./repository";
import type {
  CreateUserBodyInput,
  ListUsersQueryInput,
  ReplaceUserPermissionsBodyInput,
  ReplaceUserRolesBodyInput,
  UpdateUserBodyInput,
  UpdateUserStatusBodyInput,
} from "./schemas";

const ADMIN_ROLE = "ADMIN";
const MANAGER_ROLE = "MANAGER";

export class UsersServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "UsersServiceError";
  }
}

function dedupeBigIntArray(values: bigint[]): bigint[] {
  return Array.from(
    new Map(
      values.map((value) => [value.toString(), value]),
    ).values(),
  );
}

function userHasRole(
  user: usersRepository.UserRecord,
  roleName: string,
): boolean {
  return user.userRoles.some(
    (userRole) => userRole.role.name === roleName,
  );
}

async function ensureUserExists(
  userId: bigint,
): Promise<usersRepository.UserRecord> {
  const user = await usersRepository.findUserById(userId);

  if (!user) {
    throw new UsersServiceError(
      404,
      "USER_NOT_FOUND",
      "Usuario no encontrado.",
    );
  }

  return user;
}

async function resolveRoles(roleIds: bigint[]): Promise<{
  roleIds: bigint[];
  roles: usersRepository.RoleLookupRecord[];
}> {
  const uniqueRoleIds = dedupeBigIntArray(roleIds);
  const roles = await usersRepository.findRolesByIds(uniqueRoleIds);

  if (roles.length !== uniqueRoleIds.length) {
    const foundIds = new Set(
      roles.map((role) => role.id.toString()),
    );

    const missingIds = uniqueRoleIds
      .map((roleId) => roleId.toString())
      .filter((roleId) => !foundIds.has(roleId));

    throw new UsersServiceError(
      400,
      "ROLE_NOT_FOUND",
      `Roles no encontrados: ${missingIds.join(", ")}.`,
    );
  }

  return {
    roleIds: uniqueRoleIds,
    roles,
  };
}

async function resolvePermissionIds(
  permissionIds: bigint[],
): Promise<bigint[]> {
  const uniquePermissionIds = dedupeBigIntArray(permissionIds);
  const permissions =
    await usersRepository.findPermissionsByIds(
      uniquePermissionIds,
    );

  if (permissions.length !== uniquePermissionIds.length) {
    const foundIds = new Set(
      permissions.map((permission) =>
        permission.id.toString(),
      ),
    );

    const missingIds = uniquePermissionIds
      .map((permissionId) => permissionId.toString())
      .filter((permissionId) => !foundIds.has(permissionId));

    throw new UsersServiceError(
      400,
      "PERMISSION_NOT_FOUND",
      `Permisos no encontrados: ${missingIds.join(", ")}.`,
    );
  }

  return uniquePermissionIds;
}

function ensureManagerCanReceivePermissions(
  user: usersRepository.UserRecord,
): void {
  if (userHasRole(user, ADMIN_ROLE)) {
    throw new UsersServiceError(
      409,
      "ADMIN_PERMISSIONS_ARE_IMPLICIT",
      "ADMIN tiene acceso total y no utiliza permisos individuales.",
    );
  }

  if (!userHasRole(user, MANAGER_ROLE)) {
    throw new UsersServiceError(
      409,
      "USER_IS_NOT_MANAGER",
      "Solo los usuarios con rol MANAGER pueden recibir permisos administrativos.",
    );
  }
}

export async function listUsers(
  filters: ListUsersQueryInput,
): Promise<UserResponseDto[]> {
  const users = await usersRepository.listUsers(filters);
  return users.map(toUserResponse);
}

export async function getUserById(
  userId: bigint,
): Promise<UserResponseDto> {
  const user = await ensureUserExists(userId);
  return toUserResponse(user);
}

export async function createUser(
  input: CreateUserBodyInput,
): Promise<UserResponseDto> {
  const username = input.username.trim();

  const existingUser =
    await usersRepository.findUserByUsername(username);

  if (existingUser) {
    throw new UsersServiceError(
      409,
      "USERNAME_ALREADY_EXISTS",
      "Ya existe un usuario con ese username.",
    );
  }

  const { roleIds } = await resolveRoles(input.roleIds);
  const passwordHash = await bcrypt.hash(input.password, 12);

  const createdUser = await usersRepository.createUser({
    username,
    passwordHash,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    isActive: input.isActive,
    roleIds,
  });

  return toUserResponse(createdUser);
}

export async function updateUser(
  userId: bigint,
  input: UpdateUserBodyInput,
): Promise<UserResponseDto> {
  const currentUser = await ensureUserExists(userId);
  const nextUsername = input.username?.trim();

  if (
    nextUsername &&
    nextUsername !== currentUser.username
  ) {
    const duplicatedUser =
      await usersRepository.findUserByUsername(nextUsername);

    if (
      duplicatedUser &&
      duplicatedUser.id !== userId
    ) {
      throw new UsersServiceError(
        409,
        "USERNAME_ALREADY_EXISTS",
        "Ya existe un usuario con ese username.",
      );
    }
  }

  const data: usersRepository.UpdateUserRepositoryInput = {
    ...(nextUsername ? { username: nextUsername } : {}),
    ...(input.firstName
      ? { firstName: input.firstName.trim() }
      : {}),
    ...(input.lastName
      ? { lastName: input.lastName.trim() }
      : {}),
    ...(typeof input.isActive === "boolean"
      ? { isActive: input.isActive }
      : {}),
  };

  if (input.password) {
    data.passwordHash = await bcrypt.hash(
      input.password,
      12,
    );
  }

  const updatedUser = await usersRepository.updateUser(
    userId,
    data,
  );

  return toUserResponse(updatedUser);
}

export async function replaceUserRoles(
  userId: bigint,
  input: ReplaceUserRolesBodyInput,
): Promise<UserResponseDto> {
  await ensureUserExists(userId);

  const { roleIds, roles } = await resolveRoles(
    input.roleIds,
  );

  const hasManagerRole = roles.some(
    (role) => role.name === MANAGER_ROLE,
  );

  const hasAdminRole = roles.some(
    (role) => role.name === ADMIN_ROLE,
  );

  const canKeepIndividualPermissions =
    hasManagerRole && !hasAdminRole;

  const updatedUser =
    await usersRepository.replaceUserRoles(
      userId,
      roleIds,
      !canKeepIndividualPermissions,
    );

  return toUserResponse(updatedUser);
}

export async function replaceUserPermissions(
  userId: bigint,
  input: ReplaceUserPermissionsBodyInput,
  grantedBy: bigint,
): Promise<UserResponseDto> {
  const targetUser = await ensureUserExists(userId);

  ensureManagerCanReceivePermissions(targetUser);

  const permissionIds = await resolvePermissionIds(
    input.permissionIds,
  );

  const updatedUser =
    await usersRepository.replaceUserPermissions(
      userId,
      permissionIds,
      grantedBy,
    );

  return toUserResponse(updatedUser);
}

export async function updateUserStatus(
  userId: bigint,
  input: UpdateUserStatusBodyInput,
): Promise<UserResponseDto> {
  await ensureUserExists(userId);

  const updatedUser =
    await usersRepository.updateUserStatus(
      userId,
      input.isActive,
    );

  return toUserResponse(updatedUser);
}
