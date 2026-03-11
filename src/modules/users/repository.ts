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
            rolePermissions: {
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
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { username: "asc" }],
    ...userSelect,
  });
}

export async function findUserById(id: bigint): Promise<UserRecord | null> {
  return prisma.user.findUnique({
    where: { id },
    ...userSelect,
  });
}

export async function findUserByUsername(
  username: string,
): Promise<(UserRecord & { id: bigint }) | null> {
  return prisma.user.findUnique({
    where: { username },
    ...userSelect,
  });
}

export async function findRolesByIds(roleIds: bigint[]): Promise<RoleLookupRecord[]> {
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
    });

    const hydratedUser = await tx.user.findUnique({
      where: { id: createdUser.id },
      ...userSelect,
    });

    if (!hydratedUser) {
      throw new Error("No se pudo recargar el usuario recién creado.");
    }

    return hydratedUser;
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

    const hydratedUser = await tx.user.findUnique({
      where: { id },
      ...userSelect,
    });

    if (!hydratedUser) {
      throw new Error("No se pudo recargar el usuario actualizado.");
    }

    return hydratedUser;
  });
}

export async function replaceUserRoles(
  userId: bigint,
  roleIds: bigint[],
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
    });

    const hydratedUser = await tx.user.findUnique({
      where: { id: userId },
      ...userSelect,
    });

    if (!hydratedUser) {
      throw new Error("No se pudo recargar el usuario actualizado.");
    }

    return hydratedUser;
  });
}

export async function updateUserStatus(
  userId: bigint,
  isActive: boolean,
): Promise<UserRecord> {
  return updateUser(userId, { isActive });
}