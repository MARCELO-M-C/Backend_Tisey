import {
  OrderStatus,
  Prisma,
  StayStatus,
  cabins_status,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";

const guestSummarySelect = {
  id: true,
  fullName: true,
  idNumber: true,
  originPlace: true,
} satisfies Prisma.GuestSelect;

const cabinSummarySelect = {
  id: true,
  cabinNumber: true,
  name: true,
  capacity: true,
  basePricePerNight: true,
  status: true,
  isActive: true,
} satisfies Prisma.CabinSelect;

const userSummarySelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  isActive: true,
} satisfies Prisma.UserSelect;

const staySelect = Prisma.validator<Prisma.StayDefaultArgs>()({
  select: {
    id: true,
    cabinId: true,
    primaryGuestId: true,
    checkInDate: true,
    checkOutDate: true,
    status: true,
    createdBy: true,
    createdAt: true,
    cabin: {
      select: cabinSummarySelect,
    },
    primaryGuest: {
      select: guestSummarySelect,
    },
    createdByUser: {
      select: userSummarySelect,
    },
    stayGuests: {
      select: {
        guest: {
          select: guestSummarySelect,
        },
      },
      orderBy: {
        guest: {
          fullName: "asc",
        },
      },
    },
    _count: {
      select: {
        stayGuests: true,
        orders: true,
        invoices: true,
      },
    },
  },
});

export type StayRecord = Prisma.StayGetPayload<typeof staySelect>;

export type GuestSummaryRecord = Prisma.GuestGetPayload<{
  select: typeof guestSummarySelect;
}>;

export type CabinSummaryRecord = Prisma.CabinGetPayload<{
  select: typeof cabinSummarySelect;
}>;

export interface ListStaysFilters {
  cabinId?: bigint;
  primaryGuestId?: bigint;
  status?: StayStatus;
  from?: Date;
  to?: Date;
}

export interface CreateStayRepositoryInput {
  cabinId: bigint;
  primaryGuestId: bigint;
  checkInDate: Date;
  checkOutDate: Date;
  status: StayStatus;
  createdBy?: bigint;
  guestIds: bigint[];
}

export interface UpdateStayRepositoryInput {
  cabinId?: bigint;
  primaryGuestId?: bigint;
  checkInDate?: Date;
  checkOutDate?: Date;
  status?: StayStatus;
}

export async function listStays(
  filters: ListStaysFilters,
): Promise<StayRecord[]> {
  return prisma.stay.findMany({
    where: {
      ...(filters.cabinId ? { cabinId: filters.cabinId } : {}),
      ...(filters.primaryGuestId
        ? { primaryGuestId: filters.primaryGuestId }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.from || filters.to
        ? {
            checkInDate: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ checkInDate: "desc" }, { createdAt: "desc" }],
    ...staySelect,
  });
}

export async function findStayById(
  stayId: bigint,
): Promise<StayRecord | null> {
  return prisma.stay.findUnique({
    where: { id: stayId },
    ...staySelect,
  });
}

export async function findCabinById(
  cabinId: bigint,
): Promise<CabinSummaryRecord | null> {
  return prisma.cabin.findUnique({
    where: { id: cabinId },
    select: cabinSummarySelect,
  });
}

export async function findGuestById(
  guestId: bigint,
): Promise<GuestSummaryRecord | null> {
  return prisma.guest.findUnique({
    where: { id: guestId },
    select: guestSummarySelect,
  });
}

export async function countGuestsByIds(guestIds: bigint[]): Promise<number> {
  if (guestIds.length === 0) return 0;

  return prisma.guest.count({
    where: {
      id: {
        in: guestIds,
      },
    },
  });
}

export async function countOverlappingActiveStaysByCabin(
  cabinId: bigint,
  checkInDate: Date,
  checkOutDate: Date,
  excludeStayId?: bigint,
): Promise<number> {
  return prisma.stay.count({
    where: {
      cabinId,
      status: {
        in: [StayStatus.BOOKED, StayStatus.CHECKED_IN],
      },
      checkInDate: {
        lt: checkOutDate,
      },
      checkOutDate: {
        gt: checkInDate,
      },
      ...(excludeStayId
        ? {
            id: {
              not: excludeStayId,
            },
          }
        : {}),
    },
  });
}

export async function countOpenOrdersByStay(stayId: bigint): Promise<number> {
  return prisma.order.count({
    where: {
      stayId,
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

export async function countActiveStaysByCabin(
  cabinId: bigint,
  excludeStayId?: bigint,
): Promise<number> {
  return prisma.stay.count({
    where: {
      cabinId,
      status: {
        in: [StayStatus.BOOKED, StayStatus.CHECKED_IN],
      },
      ...(excludeStayId
        ? {
            id: {
              not: excludeStayId,
            },
          }
        : {}),
    },
  });
}

export async function createStay(
  data: CreateStayRepositoryInput,
): Promise<StayRecord> {
  return prisma.$transaction(async (tx) => {
    const createdStay = await tx.stay.create({
      data: {
        cabinId: data.cabinId,
        primaryGuestId: data.primaryGuestId,
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
        status: data.status,
        createdBy: data.createdBy ?? null,
        stayGuests: {
          create: data.guestIds.map((guestId) => ({
            guestId,
          })),
        },
      },
      select: {
        id: true,
      },
    });

    if (data.status === StayStatus.CHECKED_IN) {
      await tx.cabin.update({
        where: { id: data.cabinId },
        data: {
          status: cabins_status.OCCUPIED,
        },
      });
    }

    return tx.stay.findUniqueOrThrow({
      where: { id: createdStay.id },
      ...staySelect,
    });
  });
}

export async function updateStay(
  stayId: bigint,
  data: UpdateStayRepositoryInput,
): Promise<StayRecord> {
  return prisma.stay.update({
    where: { id: stayId },
    data,
    ...staySelect,
  });
}

export async function replaceStayGuests(
  stayId: bigint,
  guestIds: bigint[],
): Promise<StayRecord> {
  return prisma.$transaction(async (tx) => {
    await tx.stayGuest.deleteMany({
      where: { stayId },
    });

    if (guestIds.length > 0) {
      await tx.stayGuest.createMany({
        data: guestIds.map((guestId) => ({
          stayId,
          guestId,
        })),
        skipDuplicates: true,
      });
    }

    return tx.stay.findUniqueOrThrow({
      where: { id: stayId },
      ...staySelect,
    });
  });
}

export async function updateCabinStatus(
  cabinId: bigint,
  status: cabins_status,
): Promise<void> {
  await prisma.cabin.update({
    where: { id: cabinId },
    data: {
      status,
    },
  });
}