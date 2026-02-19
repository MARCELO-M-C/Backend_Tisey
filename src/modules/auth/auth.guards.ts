import { Prisma } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../../lib/prisma";
import type { AuthenticatedUser, AuthTokenPayload } from "./auth.types";

export const ROLE_GROUPS = {
  ADMIN: ["ADMIN", "SUPERADMIN"],
  WAITER: ["MESERO", "WAITER"],
  KITCHEN: ["COCINA", "KITCHEN"],
  CASHIER: ["CAJA", "CASHIER"],
} as const;

type UserWithAuthGraph = Prisma.UserGetPayload<{
  include: {
    userRoles: {
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true;
              };
            };
          };
        };
      };
    };
  };
}>;

function normalizeValue(value: string): string {
  return value.trim().toUpperCase();
}

function uniqueNormalized(values: string[]): string[] {
  return [...new Set(values.map(normalizeValue).filter(Boolean))];
}

function parseBigint(value: string): bigint | null {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

async function loadUserWithAuthGraphById(userId: bigint): Promise<UserWithAuthGraph | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export function extractRolesFromUser(user: UserWithAuthGraph): string[] {
  const roles = user.userRoles.map((userRole) => userRole.role.name);
  return uniqueNormalized(roles);
}

export function extractPermissionsFromUser(user: UserWithAuthGraph): string[] {
  const permissions = user.userRoles.flatMap((userRole) =>
    userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.code),
  );
  return uniqueNormalized(permissions);
}

export function toAuthenticatedUser(user: UserWithAuthGraph): AuthenticatedUser {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: extractRolesFromUser(user),
    permissions: extractPermissionsFromUser(user),
  };
}

export function hasAnyRole(
  user: Pick<AuthenticatedUser, "roles">,
  candidateRoles: readonly string[],
): boolean {
  const roleSet = new Set(uniqueNormalized(user.roles));
  return candidateRoles.some((role) => roleSet.has(normalizeValue(role)));
}

export function isAdminUser(user: Pick<AuthenticatedUser, "roles">): boolean {
  return hasAnyRole(user, ROLE_GROUPS.ADMIN);
}

export function isWaiterUser(user: Pick<AuthenticatedUser, "roles">): boolean {
  return hasAnyRole(user, ROLE_GROUPS.WAITER);
}

export function isKitchenUser(user: Pick<AuthenticatedUser, "roles">): boolean {
  return hasAnyRole(user, ROLE_GROUPS.KITCHEN);
}

export function isCashierUser(user: Pick<AuthenticatedUser, "roles">): boolean {
  return hasAnyRole(user, ROLE_GROUPS.CASHIER);
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  let payload: AuthTokenPayload;

  try {
    payload = await request.jwtVerify<AuthTokenPayload>();
  } catch {
    reply.unauthorized("Token invalido o expirado.");
    return;
  }

  const userId = parseBigint(payload.sub);
  if (!userId) {
    reply.unauthorized("Token invalido.");
    return;
  }

  const user = await loadUserWithAuthGraphById(userId);
  if (!user || !user.isActive) {
    reply.unauthorized("Usuario inactivo o no encontrado.");
    return;
  }

  request.authUser = toAuthenticatedUser(user);
}

export function requireAnyRole(candidateRoles: readonly string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authUser = request.authUser;
    if (!authUser) {
      reply.unauthorized("No autenticado.");
      return;
    }

    if (isAdminUser(authUser)) {
      return;
    }

    if (!hasAnyRole(authUser, candidateRoles)) {
      reply.forbidden("No tienes permisos para este recurso.");
      return;
    }
  };
}

