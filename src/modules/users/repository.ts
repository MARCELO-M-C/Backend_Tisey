import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

const userSelect = Prisma.validator<Prisma.UserDefaultArgs>()({
  select: {
    id: true,
    username: true,
    firstName: true,
    lastName: true,
    isActive: true,
    createdAt: true,
    userRoles: {
      select: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    },
    userPermissions: {
      select: {
        permission: {
          select: {
            id: true,
            code: true,
            description: true,
          },
        },
      },
    },
  },
});

export type UserRecord = Prisma.UserGetPayload<typeof userSelect>;

export interface ListUsersFilters {
  search?: string;
  isActive?: boolean;
  roleId?: bigint;
}

export interface CreateUserRepositoryInput {
  username: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roleIds: bigint[];
}

export interface UpdateUserRepositoryInput {
  username?: string;
  passwordHash?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

export interface RoleLookupRecord {
  id: bigint;
  name: string;
}

export interface PermissionLookupRecord {
  id: bigint;
  code: string;
}

async function findHydratedUserOrThrow(
  tx: Prisma.TransactionClient,
  userId: bigint,
): Promise<UserRecord> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    ...userSelect,
  });

  if (!user) {
    throw new Error("No se pudo recargar el usuario actualizado.");
  }

  return user;
}

export async function listUsers(
  filters: ListUsersFilters,
): Promise<UserRecord[]> {
  return prisma.user.findMany({
    where: {
      ...(typeof filters.isActive === "boolean"
        ? { isActive: filters.isActive }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { username: { contains: filters.search } },
              { firstName: { contains: filters.search } },
              { lastName: { contains: filters.search } },
            ],
          }
        : {}),
      ...(filters.roleId
        ? {
            userRoles: {
              some: {
                roleId: filters.roleId,
              },
            },
          }
        : {}),
    },
    orderBy: [
      { firstName: "asc" },
      { lastName: "asc" },
      { username: "asc" },
    ],
    ...userSelect,
  });
}

export async function findUserById(
  id: bigint,
): Promise<UserRecord | null> {
  return prisma.user.findUnique({
    where: { id },
    ...userSelect,
  });
}

export async function findUserByUsername(
  username: string,
): Promise<UserRecord | null> {
  return prisma.user.findUnique({
    where: { username },
    ...userSelect,
  });
}

export async function findRolesByIds(
  roleIds: bigint[],
): Promise<RoleLookupRecord[]> {
  return prisma.role.findMany({
    where: {
      id: {
        in: roleIds,
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function findPermissionsByIds(
  permissionIds: bigint[],
): Promise<PermissionLookupRecord[]> {
  if (permissionIds.length === 0) {
    return [];
  }

  return prisma.permission.findMany({
    where: {
      id: {
        in: permissionIds,
      },
    },
    select: {
      id: true,
      code: true,
    },
    orderBy: {
      code: "asc",
    },
  });
}

export async function createUser(
  data: CreateUserRepositoryInput,
): Promise<UserRecord> {
  return prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        username: data.username,
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        isActive: data.isActive,
      },
      select: {
        id: true,
      },
    });

    await tx.userRole.createMany({
      data: data.roleIds.map((roleId) => ({
        userId: createdUser.id,
        roleId,
      })),
      skipDuplicates: true,
    });

    return findHydratedUserOrThrow(tx, createdUser.id);
  });
}

export async function updateUser(
  id: bigint,
  data: UpdateUserRepositoryInput,
): Promise<UserRecord> {
  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data,
    });

    return findHydratedUserOrThrow(tx, id);
  });
}

export async function replaceUserRoles(
  userId: bigint,
  roleIds: bigint[],
  clearPermissions: boolean,
): Promise<UserRecord> {
  return prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({
      where: { userId },
    });

    await tx.userRole.createMany({
      data: roleIds.map((roleId) => ({
        userId,
        roleId,
      })),
      skipDuplicates: true,
    });

    if (clearPermissions) {
      await tx.userPermission.deleteMany({
        where: { userId },
      });
    }

    return findHydratedUserOrThrow(tx, userId);
  });
}

export async function replaceUserPermissions(
  userId: bigint,
  permissionIds: bigint[],
  grantedBy: bigint,
): Promise<UserRecord> {
  return prisma.$transaction(async (tx) => {
    await tx.userPermission.deleteMany({
      where: { userId },
    });

    if (permissionIds.length > 0) {
      await tx.userPermission.createMany({
        data: permissionIds.map((permissionId) => ({
          userId,
          permissionId,
          grantedBy,
        })),
        skipDuplicates: true,
      });
    }

    return findHydratedUserOrThrow(tx, userId);
  });
}

export async function updateUserStatus(
  userId: bigint,
  isActive: boolean,
): Promise<UserRecord> {
  return updateUser(userId, { isActive });
}
