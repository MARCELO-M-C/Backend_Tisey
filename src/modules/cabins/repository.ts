import { Prisma, StayStatus, cabins_status } from "@prisma/client";
import { prisma } from "../../lib/prisma";

const cabinSelect = Prisma.validator<Prisma.CabinDefaultArgs>()({
  select: {
    id: true,
    cabinNumber: true,
    name: true,
    capacity: true,
    basePricePerNight: true,
    status: true,
    isActive: true,
    _count: {
      select: {
        stays: true,
      },
    },
  },
});

export type CabinRecord = Prisma.CabinGetPayload<typeof cabinSelect>;

export interface ListCabinsFilters {
  search?: string;
  status?: cabins_status;
  isActive?: boolean;
  minCapacity?: number;
}

export interface CreateCabinRepositoryInput {
  cabinNumber: number;
  name?: string | null;
  capacity: number;
  basePricePerNight?: Prisma.Decimal | null;
  status: cabins_status;
  isActive: boolean;
}

export interface UpdateCabinRepositoryInput {
  cabinNumber?: number;
  name?: string | null;
  capacity?: number;
  basePricePerNight?: Prisma.Decimal | null;
  status?: cabins_status;
  isActive?: boolean;
}

export async function listCabins(
  filters: ListCabinsFilters,
): Promise<CabinRecord[]> {
  return prisma.cabin.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(typeof filters.isActive === "boolean"
        ? { isActive: filters.isActive }
        : {}),
      ...(typeof filters.minCapacity === "number"
        ? { capacity: { gte: filters.minCapacity } }
        : {}),
      ...(filters.search
        ? {
            OR: [
              {
                name: {
                  contains: filters.search,
                },
              },
              {
                cabinNumber: Number.isNaN(Number(filters.search))
                  ? undefined
                  : Number(filters.search),
              },
            ],
          }
        : {}),
    },
    orderBy: [{ cabinNumber: "asc" }],
    ...cabinSelect,
  });
}

export async function findCabinById(
  cabinId: bigint,
): Promise<CabinRecord | null> {
  return prisma.cabin.findUnique({
    where: { id: cabinId },
    ...cabinSelect,
  });
}

export async function findCabinByNumber(
  cabinNumber: number,
): Promise<CabinRecord | null> {
  return prisma.cabin.findUnique({
    where: { cabinNumber },
    ...cabinSelect,
  });
}

export async function countActiveStaysByCabin(
  cabinId: bigint,
): Promise<number> {
  return prisma.stay.count({
    where: {
      cabinId,
      status: {
        in: [StayStatus.BOOKED, StayStatus.CHECKED_IN],
      },
    },
  });
}

export async function createCabin(
  data: CreateCabinRepositoryInput,
): Promise<CabinRecord> {
  return prisma.cabin.create({
    data: {
      cabinNumber: data.cabinNumber,
      name: data.name ?? null,
      capacity: data.capacity,
      basePricePerNight: data.basePricePerNight ?? null,
      status: data.status,
      isActive: data.isActive,
    },
    ...cabinSelect,
  });
}

export async function updateCabin(
  cabinId: bigint,
  data: UpdateCabinRepositoryInput,
): Promise<CabinRecord> {
  return prisma.cabin.update({
    where: { id: cabinId },
    data,
    ...cabinSelect,
  });
}