import {
  InvoiceStatus,
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
  birthDate: true,
} satisfies Prisma.GuestSelect;

const cabinSummarySelect = {
  id: true,
  cabinNumber: true,
  name: true,
  capacity: true,
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

const lodgingRateSummarySelect = {
  id: true,
  amountPerPersonPerNight: true,
  minimumChargeableAge: true,
  effectiveFrom: true,
} satisfies Prisma.LodgingRateSelect;

const staySelect = Prisma.validator<Prisma.StayDefaultArgs>()({
  select: {
    id: true,
    cabinId: true,
    primaryGuestId: true,
    lodgingRateId: true,
    checkInDate: true,
    checkOutDate: true,
    ratePerPersonPerNight: true,
    minimumChargeableAge: true,
    status: true,
    createdBy: true,
    createdAt: true,
    cabin: { select: cabinSummarySelect },
    lodgingRate: { select: lodgingRateSummarySelect },
    primaryGuest: { select: guestSummarySelect },
    createdByUser: { select: userSummarySelect },
    stayGuests: {
      select: {
        ageAtCheckIn: true,
        isChargeable: true,
        guest: { select: guestSummarySelect },
      },
      orderBy: { guest: { fullName: "asc" } },
    },
    invoices: {
      select: {
        id: true,
        status: true,
        orderId: true,
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
export type LodgingRateSummaryRecord = Prisma.LodgingRateGetPayload<{
  select: typeof lodgingRateSummarySelect;
}>;

export interface ListStaysFilters {
  cabinId?: bigint;
  primaryGuestId?: bigint;
  status?: StayStatus;
  from?: Date;
  to?: Date;
}

export interface StayGuestSnapshotRepositoryInput {
  guestId: bigint;
  ageAtCheckIn: number | null;
  isChargeable: boolean;
}

export interface CreateStayRepositoryInput {
  cabinId: bigint;
  primaryGuestId: bigint;
  lodgingRateId: bigint;
  checkInDate: Date;
  checkOutDate: Date;
  ratePerPersonPerNight: Prisma.Decimal;
  minimumChargeableAge: number;
  status: StayStatus;
  createdBy?: bigint;
  guests: StayGuestSnapshotRepositoryInput[];
}

export interface UpdateStayRepositoryInput {
  cabinId?: bigint;
  primaryGuestId?: bigint;
  lodgingRateId?: bigint;
  checkInDate?: Date;
  checkOutDate?: Date;
  ratePerPersonPerNight?: Prisma.Decimal;
  minimumChargeableAge?: number;
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

export async function findGuestsByIds(
  guestIds: bigint[],
): Promise<GuestSummaryRecord[]> {
  if (guestIds.length === 0) return [];
  return prisma.guest.findMany({
    where: { id: { in: guestIds } },
    select: guestSummarySelect,
  });
}

export async function findApplicableLodgingRate(
  date: Date,
): Promise<LodgingRateSummaryRecord | null> {
  return prisma.lodgingRate.findFirst({
    where: { effectiveFrom: { lte: date } },
    orderBy: [{ effectiveFrom: "desc" }, { id: "desc" }],
    select: lodgingRateSummarySelect,
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
      status: { in: [StayStatus.BOOKED, StayStatus.CHECKED_IN] },
      checkInDate: { lt: checkOutDate },
      checkOutDate: { gt: checkInDate },
      ...(excludeStayId ? { id: { not: excludeStayId } } : {}),
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

export async function countCheckedInStaysByCabin(
  cabinId: bigint,
  excludeStayId?: bigint,
): Promise<number> {
  return prisma.stay.count({
    where: {
      cabinId,
      status: StayStatus.CHECKED_IN,
      ...(excludeStayId ? { id: { not: excludeStayId } } : {}),
    },
  });
}

export function hasIssuedLodgingInvoice(stay: StayRecord): boolean {
  return stay.invoices.some(
    (invoice) =>
      invoice.status === InvoiceStatus.ISSUED && invoice.orderId === null,
  );
}

export async function createStay(
  data: CreateStayRepositoryInput,
): Promise<StayRecord> {
  return prisma.$transaction(async (tx) => {
    const createdStay = await tx.stay.create({
      data: {
        cabinId: data.cabinId,
        primaryGuestId: data.primaryGuestId,
        lodgingRateId: data.lodgingRateId,
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
        ratePerPersonPerNight: data.ratePerPersonPerNight,
        minimumChargeableAge: data.minimumChargeableAge,
        status: data.status,
        createdBy: data.createdBy ?? null,
        stayGuests: {
          create: data.guests.map((guest) => ({
            guestId: guest.guestId,
            ageAtCheckIn: guest.ageAtCheckIn,
            isChargeable: guest.isChargeable,
          })),
        },
      },
      select: { id: true },
    });

    if (data.status === StayStatus.CHECKED_IN) {
      await tx.cabin.update({
        where: { id: data.cabinId },
        data: { status: cabins_status.OCCUPIED },
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

export async function updateStayAndGuests(
  stayId: bigint,
  data: UpdateStayRepositoryInput,
  guests: StayGuestSnapshotRepositoryInput[],
): Promise<StayRecord> {
  return prisma.$transaction(async (tx) => {
    await tx.stay.update({ where: { id: stayId }, data });
    await tx.stayGuest.deleteMany({ where: { stayId } });
    if (guests.length > 0) {
      await tx.stayGuest.createMany({
        data: guests.map((guest) => ({
          stayId,
          guestId: guest.guestId,
          ageAtCheckIn: guest.ageAtCheckIn,
          isChargeable: guest.isChargeable,
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

export async function replaceStayGuests(
  stayId: bigint,
  guests: StayGuestSnapshotRepositoryInput[],
): Promise<StayRecord> {
  return prisma.$transaction(async (tx) => {
    await tx.stayGuest.deleteMany({ where: { stayId } });
    if (guests.length > 0) {
      await tx.stayGuest.createMany({
        data: guests.map((guest) => ({
          stayId,
          guestId: guest.guestId,
          ageAtCheckIn: guest.ageAtCheckIn,
          isChargeable: guest.isChargeable,
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
    data: { status },
  });
}
