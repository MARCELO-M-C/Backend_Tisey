import type { StationRecord } from "./repository";

export interface StationResponseDto {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  menuItemsCount: number;
  orderItemsCount: number;
}

export function toStationResponse(record: StationRecord): StationResponseDto {
  return {
    id: record.id.toString(),
    code: record.code,
    name: record.name,
    isActive: record.isActive,
    menuItemsCount: record._count.menuItems,
    orderItemsCount: record._count.orderItems,
  };
}