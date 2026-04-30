import type { GuestRecord } from "./repository";

export interface GuestResponseDto {
  id: string;
  fullName: string;
  idNumber: string | null;
  originPlace: string | null;
  createdAt: string;
  staysCount: number;
  primaryStaysCount: number;
}

export function toGuestResponse(record: GuestRecord): GuestResponseDto {
  return {
    id: record.id.toString(),
    fullName: record.fullName,
    idNumber: record.idNumber,
    originPlace: record.originPlace,
    createdAt: record.createdAt.toISOString(),
    staysCount: record._count.stayGuests,
    primaryStaysCount: record._count.primaryStays,
  };
}