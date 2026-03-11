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

type TokenSigner = (payload: AuthTokenPayload) => string;

function parseUserId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new AuthServiceError(400, "INVALID_USER_ID", "Id de usuario inválido.");
  }
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

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

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

export function authorizePermissions(requiredPermissions: string[]) {
  return async function permissionGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      await request.jwtVerify();

      const grantedPermissions = new Set(request.user.permissions ?? []);
      const missingPermissions = requiredPermissions.filter(
        (permission) => !grantedPermissions.has(permission),
      );

      if (missingPermissions.length > 0) {
        reply.forbidden("No tienes permisos para realizar esta acción.");
      }
    } catch {
      reply.unauthorized("Token inválido o expirado.");
    }
  };
}

export function getRequestUser(request: FastifyRequest): AuthTokenPayload {
  return request.user;
}