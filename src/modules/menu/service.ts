import { Prisma } from "@prisma/client";
import {
  toMenuCategoryResponse,
  toMenuItemResponse,
  toStationResponse,
  type MenuCategoryResponseDto,
  type MenuItemResponseDto,
  type StationResponseDto,
} from "./mapper";
import * as menuRepository from "./repository";
import type {
  CreateCategoryBodyInput,
  CreateMenuItemBodyInput,
  ListCategoriesQueryInput,
  ListMenuItemsQueryInput,
  ListStationsQueryInput,
  UpdateCategoryBodyInput,
  UpdateCategoryStatusBodyInput,
  UpdateMenuItemBodyInput,
  UpdateMenuItemStatusBodyInput,
} from "./schemas";

export class MenuServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MenuServiceError";
  }
}

async function ensureStationExists(stationId: bigint) {
  const station = await menuRepository.findStationById(stationId);

  if (!station) {
    throw new MenuServiceError(
      404,
      "STATION_NOT_FOUND",
      "Estación no encontrada.",
    );
  }

  return station;
}

async function ensureCategoryExists(categoryId: bigint) {
  const category = await menuRepository.findCategoryById(categoryId);

  if (!category) {
    throw new MenuServiceError(
      404,
      "CATEGORY_NOT_FOUND",
      "Categoría no encontrada.",
    );
  }

  return category;
}

async function ensureMenuItemExists(itemId: bigint) {
  const item = await menuRepository.findMenuItemById(itemId);

  if (!item) {
    throw new MenuServiceError(
      404,
      "MENU_ITEM_NOT_FOUND",
      "Ítem de menú no encontrado.",
    );
  }

  return item;
}

async function ensureCategoryIsAvailable(categoryId: bigint) {
  const category = await ensureCategoryExists(categoryId);

  if (!category.isActive) {
    throw new MenuServiceError(
      400,
      "CATEGORY_INACTIVE",
      "La categoría indicada está inactiva.",
    );
  }

  return category;
}

async function ensureStationIsAvailable(stationId: bigint) {
  const station = await ensureStationExists(stationId);

  if (!station.isActive) {
    throw new MenuServiceError(
      400,
      "STATION_INACTIVE",
      "La estación indicada está inactiva.",
    );
  }

  return station;
}

export async function listStations(
  filters: ListStationsQueryInput,
): Promise<StationResponseDto[]> {
  const stations = await menuRepository.listStations(filters);
  return stations.map(toStationResponse);
}

export async function listCategories(
  filters: ListCategoriesQueryInput,
): Promise<MenuCategoryResponseDto[]> {
  const categories = await menuRepository.listCategories(filters);
  return categories.map(toMenuCategoryResponse);
}

export async function getCategoryById(
  categoryId: bigint,
): Promise<MenuCategoryResponseDto> {
  const category = await ensureCategoryExists(categoryId);
  return toMenuCategoryResponse(category);
}

export async function createCategory(
  input: CreateCategoryBodyInput,
): Promise<MenuCategoryResponseDto> {
  const normalizedName = input.name.trim();
  const existingCategory = await menuRepository.findCategoryByName(normalizedName);

  if (existingCategory) {
    throw new MenuServiceError(
      409,
      "CATEGORY_NAME_ALREADY_EXISTS",
      "Ya existe una categoría con ese nombre.",
    );
  }

  const createdCategory = await menuRepository.createCategory({
    name: normalizedName,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  });

  return toMenuCategoryResponse(createdCategory);
}

export async function updateCategory(
  categoryId: bigint,
  input: UpdateCategoryBodyInput,
): Promise<MenuCategoryResponseDto> {
  const currentCategory = await ensureCategoryExists(categoryId);
  const nextName = input.name?.trim();

  if (nextName && nextName !== currentCategory.name) {
    const duplicatedCategory = await menuRepository.findCategoryByName(nextName);

    if (duplicatedCategory && duplicatedCategory.id !== categoryId) {
      throw new MenuServiceError(
        409,
        "CATEGORY_NAME_ALREADY_EXISTS",
        "Ya existe una categoría con ese nombre.",
      );
    }
  }

  const updatedCategory = await menuRepository.updateCategory(categoryId, {
    ...(nextName ? { name: nextName } : {}),
    ...(typeof input.sortOrder === "number"
      ? { sortOrder: input.sortOrder }
      : {}),
  });

  return toMenuCategoryResponse(updatedCategory);
}

export async function updateCategoryStatus(
  categoryId: bigint,
  input: UpdateCategoryStatusBodyInput,
): Promise<MenuCategoryResponseDto> {
  await ensureCategoryExists(categoryId);

  if (!input.isActive) {
    const activeItemsCount = await menuRepository.countActiveItemsByCategory(
      categoryId,
    );

    if (activeItemsCount > 0) {
      throw new MenuServiceError(
        409,
        "CATEGORY_HAS_ACTIVE_ITEMS",
        "No puedes desactivar una categoría que todavía tiene ítems activos.",
      );
    }
  }

  const updatedCategory = await menuRepository.updateCategory(categoryId, {
    isActive: input.isActive,
  });

  return toMenuCategoryResponse(updatedCategory);
}

export async function listMenuItems(
  filters: ListMenuItemsQueryInput,
): Promise<MenuItemResponseDto[]> {
  const items = await menuRepository.listMenuItems(filters);
  return items.map(toMenuItemResponse);
}

export async function getMenuItemById(
  itemId: bigint,
): Promise<MenuItemResponseDto> {
  const item = await ensureMenuItemExists(itemId);
  return toMenuItemResponse(item);
}

export async function createMenuItem(
  input: CreateMenuItemBodyInput,
): Promise<MenuItemResponseDto> {
  const normalizedName = input.name.trim();
  const existingItem = await menuRepository.findMenuItemByName(normalizedName);

  if (existingItem) {
    throw new MenuServiceError(
      409,
      "MENU_ITEM_NAME_ALREADY_EXISTS",
      "Ya existe un ítem de menú con ese nombre.",
    );
  }

  await ensureCategoryIsAvailable(input.categoryId);
  await ensureStationIsAvailable(input.stationId);

  const createdItem = await menuRepository.createMenuItem({
    categoryId: input.categoryId,
    stationId: input.stationId,
    name: normalizedName,
    basePrice: new Prisma.Decimal(input.basePrice),
    isActive: input.isActive,
  });

  return toMenuItemResponse(createdItem);
}

export async function updateMenuItem(
  itemId: bigint,
  input: UpdateMenuItemBodyInput,
): Promise<MenuItemResponseDto> {
  const currentItem = await ensureMenuItemExists(itemId);
  const nextName = input.name?.trim();

  if (nextName && nextName !== currentItem.name) {
    const duplicatedItem = await menuRepository.findMenuItemByName(nextName);

    if (duplicatedItem && duplicatedItem.id !== itemId) {
      throw new MenuServiceError(
        409,
        "MENU_ITEM_NAME_ALREADY_EXISTS",
        "Ya existe un ítem de menú con ese nombre.",
      );
    }
  }

  if (input.categoryId) {
    await ensureCategoryIsAvailable(input.categoryId);
  }

  if (input.stationId) {
    await ensureStationIsAvailable(input.stationId);
  }

  const updatedItem = await menuRepository.updateMenuItem(itemId, {
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.stationId ? { stationId: input.stationId } : {}),
    ...(nextName ? { name: nextName } : {}),
    ...(input.basePrice
      ? { basePrice: new Prisma.Decimal(input.basePrice) }
      : {}),
  });

  return toMenuItemResponse(updatedItem);
}

export async function updateMenuItemStatus(
  itemId: bigint,
  input: UpdateMenuItemStatusBodyInput,
): Promise<MenuItemResponseDto> {
  await ensureMenuItemExists(itemId);

  const updatedItem = await menuRepository.updateMenuItem(itemId, {
    isActive: input.isActive,
  });

  return toMenuItemResponse(updatedItem);
}