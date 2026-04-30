import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

const permissionSelect = Prisma.validator<Prisma.PermissionDefaultArgs>()({
  select: {
    id: true,
    code: true,
    description: true,
  },
});

const roleSelect = Prisma.validator<Prisma.RoleDefaultArgs>()({
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
      orderBy: {
        permission: {
          code: "asc",
        },
      },
    },
    _count: {
      select: {
        userRoles: true,
        rolePermissions: true,
      },
    },
  },
});

export type PermissionRecord = Prisma.PermissionGetPayload<
  typeof permissionSelect
>;

export type RoleRecord = Prisma.RoleGetPayload<typeof roleSelect>;

export interface ListRolesFilters {
  search?: string;
}

export interface CreateRoleRepositoryInput {
  name: string;
  permissionIds: bigint[];
}

export interface UpdateRoleRepositoryInput {
  name: string;
}

export async function listRoles(
  filters: ListRolesFilters,
): Promise<RoleRecord[]> {
  return prisma.role.findMany({
    where: {
      ...(filters.search
        ? {
            name: {
              contains: filters.search,
            },
          }
        : {}),
    },
    orderBy: [{ name: "asc" }],
    ...roleSelect,
  });
}

export async function listPermissions(): Promise<PermissionRecord[]> {
  return prisma.permission.findMany({
    orderBy: [{ code: "asc" }],
    ...permissionSelect,
  });
}

export async function findRoleById(
  roleId: bigint,
): Promise<RoleRecord | null> {
  return prisma.role.findUnique({
    where: { id: roleId },
    ...roleSelect,
  });
}

export async function findRoleByName(
  name: string,
): Promise<RoleRecord | null> {
  return prisma.role.findUnique({
    where: { name },
    ...roleSelect,
  });
}

export async function countPermissionsByIds(
  permissionIds: bigint[],
): Promise<number> {
  if (permissionIds.length === 0) return 0;

  return prisma.permission.count({
    where: {
      id: {
        in: permissionIds,
      },
    },
  });
}

export async function createRole(
  data: CreateRoleRepositoryInput,
): Promise<RoleRecord> {
  const role = await prisma.$transaction(async (tx) => {
    const createdRole = await tx.role.create({
      data: {
        name: data.name,
      },
      select: {
        id: true,
      },
    });

    if (data.permissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: data.permissionIds.map((permissionId) => ({
          roleId: createdRole.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }

    return tx.role.findUniqueOrThrow({
      where: { id: createdRole.id },
      ...roleSelect,
    });
  });

  return role;
}

export async function updateRole(
  roleId: bigint,
  data: UpdateRoleRepositoryInput,
): Promise<RoleRecord> {
  return prisma.role.update({
    where: { id: roleId },
    data,
    ...roleSelect,
  });
}

export async function replaceRolePermissions(
  roleId: bigint,
  permissionIds: bigint[],
): Promise<RoleRecord> {
  const role = await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({
      where: {
        roleId,
      },
    });

    if (permissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }

    return tx.role.findUniqueOrThrow({
      where: { id: roleId },
      ...roleSelect,
    });
  });

  return role;
}