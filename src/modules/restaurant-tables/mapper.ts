import type { RestaurantTableRecord } from "./repository";

export interface RestaurantTableResponseDto {
  id: string;
  code: string;
  name: string | null;
  capacity: number | null;
  isActive: boolean;
  ordersCount: number;
}

export function toRestaurantTableResponse(
  record: RestaurantTableRecord,
): RestaurantTableResponseDto {
  return {
    id: record.id.toString(),
    code: record.code,
    name: record.name,
    capacity: record.capacity,
    isActive: record.isActive,
    ordersCount: record._count.orders,
  };
}