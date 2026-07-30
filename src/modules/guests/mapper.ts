import type { GuestRecord } from "./repository";

export interface GuestResponseDto {
  id: string;
  fullName: string;
  idNumber: string | null;
  originPlace: string | null;
  birthDate: string | null;
  createdAt: string;
  staysCount: number;
  primaryStaysCount: number;
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function toGuestResponse(record: GuestRecord): GuestResponseDto {
  return {
    id: record.id.toString(),
    fullName: record.fullName,
    idNumber: record.idNumber,
    originPlace: record.originPlace,
    birthDate: record.birthDate ? toDateOnly(record.birthDate) : null,
    createdAt: record.createdAt.toISOString(),
    staysCount: record._count.stayGuests,
    primaryStaysCount: record._count.primaryStays,
  };
}
