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
const USERS_MANAGE_PERMISSION = "ADMIN_USERS_MANAGE";
const ORDERS_MANAGE_PERMISSION = "ADMIN_ORDERS_MANAGE";
const SHIFTS_STATIONS_MANAGE_PERMISSION =
  "ADMIN_SHIFTS_&_STATIONS_MANAGE";
const USER_READ_PERMISSIONS = [
  USERS_MANAGE_PERMISSION,
  ORDERS_MANAGE_PERMISSION,
  SHIFTS_STATIONS_MANAGE_PERMISSION,
];
const OPERATIONAL_ROLES = new Set([
  "MESERO",
  "COCINA",
  "CAJA",
]);

export interface UserManagementActor {
  roles: string[];
  permissions: string[];
}

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

function normalizeRoleName(roleName: string): string {
  return roleName.trim().toUpperCase();
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
  const normalizedRoleName = normalizeRoleName(roleName);

  return user.userRoles.some(
    (userRole) =>
      normalizeRoleName(userRole.role.name) === normalizedRoleName,
  );
}

function actorHasRole(
  actor: UserManagementActor,
  roleName: string,
): boolean {
  const normalizedRoleName = normalizeRoleName(roleName);

  return actor.roles.some(
    (actorRole) =>
      normalizeRoleName(actorRole) === normalizedRoleName,
  );
}

function actorHasPermission(
  actor: UserManagementActor,
  permissionCode: string,
): boolean {
  const normalizedPermissionCode =
    normalizeRoleName(permissionCode);

  return actor.permissions.some(
    (actorPermission) =>
      normalizeRoleName(actorPermission) === normalizedPermissionCode,
  );
}

function ensureActorIsAdminOrManager(
  actor: UserManagementActor,
): void {
  if (
    actorHasRole(actor, ADMIN_ROLE) ||
    actorHasRole(actor, MANAGER_ROLE)
  ) {
    return;
  }

  throw new UsersServiceError(
    403,
    "USER_MANAGEMENT_FORBIDDEN",
    "No tienes autorización para gestionar usuarios.",
  );
}

function ensureActorCanReadUsers(
  actor: UserManagementActor,
): void {
  if (actorHasRole(actor, ADMIN_ROLE)) {
    return;
  }

  ensureActorIsAdminOrManager(actor);

  if (
    USER_READ_PERMISSIONS.some((permission) =>
      actorHasPermission(actor, permission),
    )
  ) {
    return;
  }

  throw new UsersServiceError(
    403,
    "USER_LIST_FORBIDDEN",
    "No tienes autorización para consultar usuarios.",
  );
}

function ensureActorCanManageTargetUser(
  actor: UserManagementActor,
  targetUser: usersRepository.UserRecord,
): void {
  if (actorHasRole(actor, ADMIN_ROLE)) {
    return;
  }

  ensureActorIsAdminOrManager(actor);

  if (
    userHasRole(targetUser, ADMIN_ROLE) ||
    userHasRole(targetUser, MANAGER_ROLE)
  ) {
    throw new UsersServiceError(
      403,
      "MANAGER_CANNOT_MANAGE_ADMINISTRATIVE_USER",
      "Un MANAGER no puede modificar usuarios con rol ADMIN o MANAGER.",
    );
  }
}

function ensureActorCanAssignRoles(
  actor: UserManagementActor,
  roles: usersRepository.RoleLookupRecord[],
): void {
  if (actorHasRole(actor, ADMIN_ROLE)) {
    return;
  }

  ensureActorIsAdminOrManager(actor);

  const forbiddenRoles = roles
    .map((role) => normalizeRoleName(role.name))
    .filter((roleName) => !OPERATIONAL_ROLES.has(roleName));

  if (forbiddenRoles.length > 0) {
    throw new UsersServiceError(
      403,
      "MANAGER_CANNOT_ASSIGN_ADMINISTRATIVE_ROLE",
      "Un MANAGER solo puede asignar los roles MESERO, COCINA y CAJA.",
    );
  }
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
  actor: UserManagementActor,
): Promise<UserResponseDto[]> {
  ensureActorCanReadUsers(actor);

  const users = await usersRepository.listUsers(filters);
  const canViewAdministrativeUsers =
    actorHasRole(actor, ADMIN_ROLE) ||
    actorHasPermission(actor, USERS_MANAGE_PERMISSION);

  const visibleUsers = canViewAdministrativeUsers
    ? users
    : users.filter(
        (user) =>
          !userHasRole(user, ADMIN_ROLE) &&
          !userHasRole(user, MANAGER_ROLE),
      );

  return visibleUsers.map(toUserResponse);
}

export async function getUserById(
  userId: bigint,
): Promise<UserResponseDto> {
  const user = await ensureUserExists(userId);
  return toUserResponse(user);
}

export async function createUser(
  input: CreateUserBodyInput,
  actor: UserManagementActor,
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

  const { roleIds, roles } = await resolveRoles(input.roleIds);
  ensureActorCanAssignRoles(actor, roles);

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
  actor: UserManagementActor,
): Promise<UserResponseDto> {
  const currentUser = await ensureUserExists(userId);
  ensureActorCanManageTargetUser(actor, currentUser);

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
  actor: UserManagementActor,
): Promise<UserResponseDto> {
  const currentUser = await ensureUserExists(userId);
  ensureActorCanManageTargetUser(actor, currentUser);

  const { roleIds, roles } = await resolveRoles(
    input.roleIds,
  );
  ensureActorCanAssignRoles(actor, roles);

  const hasManagerRole = roles.some(
    (role) => normalizeRoleName(role.name) === MANAGER_ROLE,
  );
  const hasAdminRole = roles.some(
    (role) => normalizeRoleName(role.name) === ADMIN_ROLE,
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
  actor: UserManagementActor,
): Promise<UserResponseDto> {
  const targetUser = await ensureUserExists(userId);
  ensureActorCanManageTargetUser(actor, targetUser);

  const updatedUser =
    await usersRepository.updateUserStatus(
      userId,
      input.isActive,
    );

  return toUserResponse(updatedUser);
}
