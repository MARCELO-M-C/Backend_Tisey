import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

const stationSelect = Prisma.validator<Prisma.StationDefaultArgs>()({
  select: {
    id: true,
    code: true,
    name: true,
    isActive: true,
  },
});

const categorySelect = Prisma.validator<Prisma.MenuCategoryDefaultArgs>()({
  select: {
    id: true,
    name: true,
    sortOrder: true,
    isActive: true,
    _count: {
      select: {
        menuItems: true,
      },
    },
  },
});

const menuItemSelect = Prisma.validator<Prisma.MenuItemDefaultArgs>()({
  select: {
    id: true,
    categoryId: true,
    stationId: true,
    name: true,
    basePrice: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    category: {
      select: {
        id: true,
        name: true,
        sortOrder: true,
        isActive: true,
      },
    },
    station: {
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
      },
    },
  },
});

export type StationRecord = Prisma.StationGetPayload<typeof stationSelect>;
export type MenuCategoryRecord = Prisma.MenuCategoryGetPayload<
  typeof categorySelect
>;
export type MenuItemRecord = Prisma.MenuItemGetPayload<typeof menuItemSelect>;

export interface ListStationsFilters {
  search?: string;
  isActive?: boolean;
}

export interface ListCategoriesFilters {
  search?: string;
  isActive?: boolean;
}

export interface ListMenuItemsFilters {
  search?: string;
  categoryId?: bigint;
  stationId?: bigint;
  isActive?: boolean;
}

export interface CreateCategoryRepositoryInput {
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface UpdateCategoryRepositoryInput {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateMenuItemRepositoryInput {
  categoryId: bigint;
  stationId: bigint;
  name: string;
  basePrice: Prisma.Decimal;
  isActive: boolean;
}

export interface UpdateMenuItemRepositoryInput {
  categoryId?: bigint;
  stationId?: bigint;
  name?: string;
  basePrice?: Prisma.Decimal;
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

export async function listCategories(
  filters: ListCategoriesFilters,
): Promise<MenuCategoryRecord[]> {
  return prisma.menuCategory.findMany({
    where: {
      ...(typeof filters.isActive === "boolean"
        ? { isActive: filters.isActive }
        : {}),
      ...(filters.search
        ? {
            name: {
              contains: filters.search,
            },
          }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    ...categorySelect,
  });
}

export async function findCategoryById(
  categoryId: bigint,
): Promise<MenuCategoryRecord | null> {
  return prisma.menuCategory.findUnique({
    where: { id: categoryId },
    ...categorySelect,
  });
}

export async function findCategoryByName(
  name: string,
): Promise<MenuCategoryRecord | null> {
  return prisma.menuCategory.findUnique({
    where: { name },
    ...categorySelect,
  });
}

export async function countActiveItemsByCategory(
  categoryId: bigint,
): Promise<number> {
  return prisma.menuItem.count({
    where: {
      categoryId,
      isActive: true,
    },
  });
}

export async function createCategory(
  data: CreateCategoryRepositoryInput,
): Promise<MenuCategoryRecord> {
  return prisma.menuCategory.create({
    data,
    ...categorySelect,
  });
}

export async function updateCategory(
  categoryId: bigint,
  data: UpdateCategoryRepositoryInput,
): Promise<MenuCategoryRecord> {
  return prisma.menuCategory.update({
    where: { id: categoryId },
    data,
    ...categorySelect,
  });
}

export async function listMenuItems(
  filters: ListMenuItemsFilters,
): Promise<MenuItemRecord[]> {
  return prisma.menuItem.findMany({
    where: {
      ...(typeof filters.isActive === "boolean"
        ? { isActive: filters.isActive }
        : {}),
      ...(filters.search
        ? {
            name: {
              contains: filters.search,
            },
          }
        : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.stationId ? { stationId: filters.stationId } : {}),
    },
    orderBy: [
      { category: { sortOrder: "asc" } },
      { category: { name: "asc" } },
      { name: "asc" },
    ],
    ...menuItemSelect,
  });
}

export async function findMenuItemById(
  itemId: bigint,
): Promise<MenuItemRecord | null> {
  return prisma.menuItem.findUnique({
    where: { id: itemId },
    ...menuItemSelect,
  });
}

export async function findMenuItemByName(
  name: string,
): Promise<MenuItemRecord | null> {
  return prisma.menuItem.findUnique({
    where: { name },
    ...menuItemSelect,
  });
}

export async function createMenuItem(
  data: CreateMenuItemRepositoryInput,
): Promise<MenuItemRecord> {
  return prisma.menuItem.create({
    data,
    ...menuItemSelect,
  });
}

export async function updateMenuItem(
  itemId: bigint,
  data: UpdateMenuItemRepositoryInput,
): Promise<MenuItemRecord> {
  return prisma.menuItem.update({
    where: { id: itemId },
    data: {
      ...data,
      updatedAt: new Date(),
    },
    ...menuItemSelect,
  });
}