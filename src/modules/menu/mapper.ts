import type {
  MenuCategoryRecord,
  MenuItemRecord,
  StationRecord,
} from "./repository";

export interface StationResponseDto {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface MenuCategoryResponseDto {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  itemsCount: number;
}

export interface MenuItemResponseDto {
  id: string;
  name: string;
  basePrice: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  category: {
    id: string;
    name: string;
    sortOrder: number;
    isActive: boolean;
  };
  station: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  };
}

export function toStationResponse(record: StationRecord): StationResponseDto {
  return {
    id: record.id.toString(),
    code: record.code,
    name: record.name,
    isActive: record.isActive,
  };
}

export function toMenuCategoryResponse(
  record: MenuCategoryRecord,
): MenuCategoryResponseDto {
  return {
    id: record.id.toString(),
    name: record.name,
    sortOrder: record.sortOrder,
    isActive: record.isActive,
    itemsCount: record._count.menuItems,
  };
}

export function toMenuItemResponse(record: MenuItemRecord): MenuItemResponseDto {
  return {
    id: record.id.toString(),
    name: record.name,
    basePrice: record.basePrice.toFixed(2),
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt ? record.updatedAt.toISOString() : null,
    category: {
      id: record.category.id.toString(),
      name: record.category.name,
      sortOrder: record.category.sortOrder,
      isActive: record.category.isActive,
    },
    station: {
      id: record.station.id.toString(),
      code: record.station.code,
      name: record.station.name,
      isActive: record.station.isActive,
    },
  };
}