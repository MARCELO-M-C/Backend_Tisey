import bcrypt from "bcryptjs";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthTokenPayload, AuthUserDto } from "./mapper";
import { toAuthTokenPayload, toAuthUserDto } from "./mapper";
import * as authRepository from "./repository";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthTokenPayload;
  }
}

const ADMIN_ROLE = "ADMIN";

export class AuthServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: string;
  user: AuthUserDto;
}

export interface AuthorizationRule {
  /** Roles operativos autorizados. Basta con poseer uno. */
  roles?: string[];

  /** Permisos administrativos requeridos. */
  permissions?: string[];

  /**
   * `all`: exige todos los permisos indicados.
   * `any`: basta con uno de ellos.
   */
  permissionMode?: "all" | "any";

  /** ADMIN obtiene acceso total por defecto. */
  adminBypass?: boolean;
}

type TokenSigner = (payload: AuthTokenPayload) => string;

function normalizeAuthorizationValue(value: string): string {
  return value.trim().toUpperCase();
}

function toNormalizedSet(values: string[] | undefined): Set<string> {
  return new Set(
    (values ?? [])
      .map(normalizeAuthorizationValue)
      .filter(Boolean),
  );
}

function parseUserId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new AuthServiceError(
      400,
      "INVALID_USER_ID",
      "Id de usuario inválido.",
    );
  }
}

export function requestUserHasRole(
  user: AuthTokenPayload,
  role: string,
): boolean {
  const roles = toNormalizedSet(user.roles);
  return roles.has(normalizeAuthorizationValue(role));
}

export function requestUserHasPermission(
  user: AuthTokenPayload,
  permission: string,
): boolean {
  const permissions = toNormalizedSet(user.permissions);
  return permissions.has(normalizeAuthorizationValue(permission));
}

export function isAdminRequestUser(user: AuthTokenPayload): boolean {
  return requestUserHasRole(user, ADMIN_ROLE);
}

export async function login(
  input: LoginInput,
  signAccessToken: TokenSigner,
  expiresIn: string,
): Promise<LoginResult> {
  const username = input.username.trim();
  const user = await authRepository.findUserByUsername(username);

  if (!user) {
    throw new AuthServiceError(
      401,
      "INVALID_CREDENTIALS",
      "Credenciales inválidas.",
    );
  }

  if (!user.isActive) {
    throw new AuthServiceError(
      403,
      "USER_INACTIVE",
      "El usuario está inactivo.",
    );
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new AuthServiceError(
      401,
      "INVALID_CREDENTIALS",
      "Credenciales inválidas.",
    );
  }

  const tokenPayload = toAuthTokenPayload(user);
  const accessToken = signAccessToken(tokenPayload);

  return {
    accessToken,
    tokenType: "Bearer",
    expiresIn,
    user: toAuthUserDto(user),
  };
}

export async function getCurrentUser(userId: string): Promise<AuthUserDto> {
  const user = await authRepository.findUserById(parseUserId(userId));

  if (!user) {
    throw new AuthServiceError(
      404,
      "USER_NOT_FOUND",
      "Usuario no encontrado.",
    );
  }

  if (!user.isActive) {
    throw new AuthServiceError(
      403,
      "USER_INACTIVE",
      "El usuario está inactivo.",
    );
  }

  return toAuthUserDto(user);
}

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.unauthorized("Token inválido o expirado.");
  }
}

export function authorizeAccess(rule: AuthorizationRule = {}) {
  const allowedRoles = toNormalizedSet(rule.roles);
  const requiredPermissions = Array.from(
    toNormalizedSet(rule.permissions),
  );
  const permissionMode = rule.permissionMode ?? "all";
  const adminBypass = rule.adminBypass ?? true;

  return async function accessGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      await request.jwtVerify();
    } catch {
      reply.unauthorized("Token inválido o expirado.");
      return;
    }

    const user = request.user;

    if (adminBypass && isAdminRequestUser(user)) {
      return;
    }

    const currentRoles = toNormalizedSet(user.roles);
    const hasAllowedRole = Array.from(allowedRoles).some((role) =>
      currentRoles.has(role),
    );

    const currentPermissions = toNormalizedSet(user.permissions);
    const hasRequiredPermissions =
      requiredPermissions.length === 0
        ? false
        : permissionMode === "any"
          ? requiredPermissions.some((permission) =>
              currentPermissions.has(permission),
            )
          : requiredPermissions.every((permission) =>
              currentPermissions.has(permission),
            );

    const hasNoAuthorizationRequirements =
      allowedRoles.size === 0 && requiredPermissions.length === 0;

    if (
      hasNoAuthorizationRequirements ||
      hasAllowedRole ||
      hasRequiredPermissions
    ) {
      return;
    }

    reply.forbidden("No tienes autorización para realizar esta acción.");
  };
}

export function authorizePermissions(requiredPermissions: string[]) {
  return authorizeAccess({
    permissions: requiredPermissions,
    permissionMode: "all",
    adminBypass: true,
  });
}

export function authorizeAnyPermission(requiredPermissions: string[]) {
  return authorizeAccess({
    permissions: requiredPermissions,
    permissionMode: "any",
    adminBypass: true,
  });
}

export function authorizeRoles(
  allowedRoles: string[],
  options: { adminBypass?: boolean } = {},
) {
  return authorizeAccess({
    roles: allowedRoles,
    adminBypass: options.adminBypass ?? true,
  });
}

export function getRequestUser(request: FastifyRequest): AuthTokenPayload {
  return request.user;
}
