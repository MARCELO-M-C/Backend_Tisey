import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

const restaurantTableSelect =
  Prisma.validator<Prisma.RestaurantTableDefaultArgs>()({
    select: {
      id: true,
      code: true,
      name: true,
      capacity: true,
      isActive: true,
      _count: {
        select: {
          orders: true,
        },
      },
    },
  });

export type RestaurantTableRecord = Prisma.RestaurantTableGetPayload<
  typeof restaurantTableSelect
>;

export interface ListRestaurantTablesFilters {
  search?: string;
  isActive?: boolean;
}

export interface CreateRestaurantTableRepositoryInput {
  code: string;
  name?: string | null;
  capacity?: number | null;
  isActive: boolean;
}

export interface UpdateRestaurantTableRepositoryInput {
  code?: string;
  name?: string | null;
  capacity?: number | null;
  isActive?: boolean;
}

export async function listRestaurantTables(
  filters: ListRestaurantTablesFilters,
): Promise<RestaurantTableRecord[]> {
  return prisma.restaurantTable.findMany({
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
    orderBy: [{ code: "asc" }],
    ...restaurantTableSelect,
  });
}

export async function findRestaurantTableById(
  tableId: bigint,
): Promise<RestaurantTableRecord | null> {
  return prisma.restaurantTable.findUnique({
    where: { id: tableId },
    ...restaurantTableSelect,
  });
}

export async function findRestaurantTableByCode(
  code: string,
): Promise<RestaurantTableRecord | null> {
  return prisma.restaurantTable.findUnique({
    where: { code },
    ...restaurantTableSelect,
  });
}

export async function countOpenOrdersByTable(tableId: bigint): Promise<number> {
  return prisma.order.count({
    where: {
      tableId,
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

export async function createRestaurantTable(
  data: CreateRestaurantTableRepositoryInput,
): Promise<RestaurantTableRecord> {
  return prisma.restaurantTable.create({
    data: {
      code: data.code,
      name: data.name ?? null,
      capacity: data.capacity ?? null,
      isActive: data.isActive,
    },
    ...restaurantTableSelect,
  });
}

export async function updateRestaurantTable(
  tableId: bigint,
  data: UpdateRestaurantTableRepositoryInput,
): Promise<RestaurantTableRecord> {
  return prisma.restaurantTable.update({
    where: { id: tableId },
    data: {
      ...data,
    },
    ...restaurantTableSelect,
  });
}