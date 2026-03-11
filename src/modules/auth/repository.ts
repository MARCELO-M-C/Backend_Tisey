import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

const authUserSelect = Prisma.validator<Prisma.UserDefaultArgs>()({
  select: {
    id: true,
    username: true,
    passwordHash: true,
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

export type AuthUserRecord = Prisma.UserGetPayload<typeof authUserSelect>;

export async function findUserByUsername(
  username: string,
): Promise<AuthUserRecord | null> {
  return prisma.user.findUnique({
    where: { username },
    ...authUserSelect,
  });
}

export async function findUserById(
  id: bigint,
): Promise<AuthUserRecord | null> {
  return prisma.user.findUnique({
    where: { id },
    ...authUserSelect,
  });
}