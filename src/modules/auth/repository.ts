import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";

const authUserSelect = {
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
} satisfies Prisma.UserDefaultArgs;

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
