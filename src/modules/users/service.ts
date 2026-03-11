import bcrypt from "bcryptjs";
import { toUserResponse, type UserResponseDto } from "./mapper";
import * as usersRepository from "./repository";
import type {
  CreateUserBodyInput,
  ListUsersQueryInput,
  ReplaceUserRolesBodyInput,
  UpdateUserBodyInput,
  UpdateUserStatusBodyInput,
} from "./schemas";

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
  return Array.from(new Map(values.map((value) => [value.toString(), value])).values());
}

async function ensureUserExists(userId: bigint) {
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

async function ensureRolesExist(roleIds: bigint[]) {
  const uniqueRoleIds = dedupeBigIntArray(roleIds);
  const roles = await usersRepository.findRolesByIds(uniqueRoleIds);

  if (roles.length !== uniqueRoleIds.length) {
    const foundIds = new Set(roles.map((role) => role.id.toString()));
    const missingIds = uniqueRoleIds
      .map((roleId) => roleId.toString())
      .filter((roleId) => !foundIds.has(roleId));

    throw new UsersServiceError(
      400,
      "ROLE_NOT_FOUND",
      `Roles no encontrados: ${missingIds.join(", ")}.`,
    );
  }

  return uniqueRoleIds;
}

export async function listUsers(
  filters: ListUsersQueryInput,
): Promise<UserResponseDto[]> {
  const users = await usersRepository.listUsers(filters);
  return users.map(toUserResponse);
}

export async function getUserById(userId: bigint): Promise<UserResponseDto> {
  const user = await ensureUserExists(userId);
  return toUserResponse(user);
}

export async function createUser(
  input: CreateUserBodyInput,
): Promise<UserResponseDto> {
  const username = input.username.trim();

  const existingUser = await usersRepository.findUserByUsername(username);
  if (existingUser) {
    throw new UsersServiceError(
      409,
      "USERNAME_ALREADY_EXISTS",
      "Ya existe un usuario con ese username.",
    );
  }

  const roleIds = await ensureRolesExist(input.roleIds);
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

  if (nextUsername && nextUsername !== currentUser.username) {
    const duplicatedUser = await usersRepository.findUserByUsername(nextUsername);

    if (duplicatedUser && duplicatedUser.id !== userId) {
      throw new UsersServiceError(
        409,
        "USERNAME_ALREADY_EXISTS",
        "Ya existe un usuario con ese username.",
      );
    }
  }

  const data: usersRepository.UpdateUserRepositoryInput = {
    ...(nextUsername ? { username: nextUsername } : {}),
    ...(input.firstName ? { firstName: input.firstName.trim() } : {}),
    ...(input.lastName ? { lastName: input.lastName.trim() } : {}),
    ...(typeof input.isActive === "boolean" ? { isActive: input.isActive } : {}),
  };

  if (input.password) {
    data.passwordHash = await bcrypt.hash(input.password, 12);
  }

  const updatedUser = await usersRepository.updateUser(userId, data);
  return toUserResponse(updatedUser);
}

export async function replaceUserRoles(
  userId: bigint,
  input: ReplaceUserRolesBodyInput,
): Promise<UserResponseDto> {
  await ensureUserExists(userId);
  const roleIds = await ensureRolesExist(input.roleIds);

  const updatedUser = await usersRepository.replaceUserRoles(userId, roleIds);
  return toUserResponse(updatedUser);
}

export async function updateUserStatus(
  userId: bigint,
  input: UpdateUserStatusBodyInput,
): Promise<UserResponseDto> {
  await ensureUserExists(userId);

  const updatedUser = await usersRepository.updateUserStatus(
    userId,
    input.isActive,
  );

  return toUserResponse(updatedUser);
}