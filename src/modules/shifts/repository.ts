import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

const userSummarySelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  isActive: true,
} satisfies Prisma.UserSelect;

const shiftSelect = Prisma.validator<Prisma.ShiftDefaultArgs>()({
  select: {
    id: true,
    userId: true,
    startedAt: true,
    endedAt: true,
    notes: true,
    user: {
      select: userSummarySelect,
    },
    _count: {
      select: {
        orders: true,
      },
    },
  },
});

export type ShiftRecord = Prisma.ShiftGetPayload<typeof shiftSelect>;

export type UserSummaryRecord = Prisma.UserGetPayload<{
  select: typeof userSummarySelect;
}>;

export interface ListShiftsFilters {
  userId?: bigint;
  isOpen?: boolean;
  from?: Date;
  to?: Date;
}

export interface CreateShiftRepositoryInput {
  userId: bigint;
  startedAt?: Date;
  notes?: string | null;
}

export interface UpdateShiftRepositoryInput {
  startedAt?: Date;
  endedAt?: Date | null;
  notes?: string | null;
}

export async function listShifts(
  filters: ListShiftsFilters,
): Promise<ShiftRecord[]> {
  return prisma.shift.findMany({
    where: {
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(typeof filters.isOpen === "boolean"
        ? filters.isOpen
          ? { endedAt: null }
          : { endedAt: { not: null } }
        : {}),
      ...(filters.from || filters.to
        ? {
            startedAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ startedAt: "desc" }],
    ...shiftSelect,
  });
}

export async function findShiftById(
  shiftId: bigint,
): Promise<ShiftRecord | null> {
  return prisma.shift.findUnique({
    where: { id: shiftId },
    ...shiftSelect,
  });
}

export async function findUserById(
  userId: bigint,
): Promise<UserSummaryRecord | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: userSummarySelect,
  });
}

export async function findOpenShiftByUserId(
  userId: bigint,
): Promise<ShiftRecord | null> {
  return prisma.shift.findFirst({
    where: {
      userId,
      endedAt: null,
    },
    orderBy: {
      startedAt: "desc",
    },
    ...shiftSelect,
  });
}

export async function countOpenOrdersByShift(
  shiftId: bigint,
): Promise<number> {
  return prisma.order.count({
    where: {
      shiftId,
      status: {
        in: [
          OrderStatus.DRAFT,
          OrderStatus.SENT,
          OrderStatus.IN_PROGRESS,
          OrderStatus.READY,
          OrderStatus.DELIVERED,
        ],
      },
    },
  });
}

export async function createShift(
  data: CreateShiftRepositoryInput,
): Promise<ShiftRecord> {
  return prisma.shift.create({
    data: {
      userId: data.userId,
      ...(data.startedAt ? { startedAt: data.startedAt } : {}),
      notes: data.notes ?? null,
    },
    ...shiftSelect,
  });
}

export async function updateShift(
  shiftId: bigint,
  data: UpdateShiftRepositoryInput,
): Promise<ShiftRecord> {
  return prisma.shift.update({
    where: { id: shiftId },
    data,
    ...shiftSelect,
  });
}