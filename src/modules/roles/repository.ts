import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";

const permissionSelect =
  {
    select: {
      id: true,
      code: true,
      description: true,
    },
  } satisfies Prisma.PermissionDefaultArgs;

const roleSelect =
  {
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          userRoles: true,
        },
      },
    },
  } satisfies Prisma.RoleDefaultArgs;

export type PermissionRecord =
  Prisma.PermissionGetPayload<
    typeof permissionSelect
  >;

export type RoleRecord =
  Prisma.RoleGetPayload<typeof roleSelect>;

export interface ListRolesFilters {
  search?: string;
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
