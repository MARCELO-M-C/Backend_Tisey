import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";

const stationSelect = {
  select: {
    id: true,
    code: true,
    name: true,
    isActive: true,
    _count: {
      select: {
        menuItems: true,
        orderItems: true,
      },
    },
  },
} satisfies Prisma.StationDefaultArgs;

export type StationRecord = Prisma.StationGetPayload<typeof stationSelect>;

export interface ListStationsFilters {
  search?: string;
  isActive?: boolean;
}

export interface CreateStationRepositoryInput {
  code: string;
  name: string;
  isActive: boolean;
}

export interface UpdateStationRepositoryInput {
  code?: string;
  name?: string;
  isActive?: boolean;
}

export async function listStations(
  filters: ListStationsFilters,
): Promise<StationRecord[]> {
  return prisma.station.findMany({
    where: {
      ...(typeof filters.isActive === "boolean"
        ? { isActive: filters.isActive }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { code: { contains: filters.search } },
              { name: { contains: filters.search } },
            ],
          }
        : {}),
    },
    orderBy: [{ name: "asc" }, { code: "asc" }],
    ...stationSelect,
  });
}

export async function findStationById(
  stationId: bigint,
): Promise<StationRecord | null> {
  return prisma.station.findUnique({
    where: { id: stationId },
    ...stationSelect,
  });
}

export async function findStationByCode(
  code: string,
): Promise<StationRecord | null> {
  return prisma.station.findUnique({
    where: { code },
    ...stationSelect,
  });
}

export async function countActiveMenuItemsByStation(
  stationId: bigint,
): Promise<number> {
  return prisma.menuItem.count({
    where: {
      stationId,
      isActive: true,
    },
  });
}

export async function createStation(
  data: CreateStationRepositoryInput,
): Promise<StationRecord> {
  return prisma.station.create({
    data,
    ...stationSelect,
  });
}

export async function updateStation(
  stationId: bigint,
  data: UpdateStationRepositoryInput,
): Promise<StationRecord> {
  return prisma.station.update({
    where: { id: stationId },
    data,
    ...stationSelect,
  });
}