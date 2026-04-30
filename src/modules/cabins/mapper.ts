import type { CabinRecord } from "./repository";

export interface CabinResponseDto {
  id: string;
  cabinNumber: number;
  name: string | null;
  capacity: number;
  basePricePerNight: string | null;
  status: string;
  isActive: boolean;
  staysCount: number;
}

export function toCabinResponse(record: CabinRecord): CabinResponseDto {
  return {
    id: record.id.toString(),
    cabinNumber: record.cabinNumber,
    name: record.name,
    capacity: record.capacity,
    basePricePerNight: record.basePricePerNight
      ? record.basePricePerNight.toFixed(2)
      : null,
    status: record.status,
    isActive: record.isActive,
    staysCount: record._count.stays,
  };
}