import type { CabinSummaryRecord, GuestSummaryRecord, StayRecord } from "./repository";

export interface GuestSummaryDto {
  id: string;
  fullName: string;
  idNumber: string | null;
  originPlace: string | null;
}

export interface CabinSummaryDto {
  id: string;
  cabinNumber: number;
  name: string | null;
  capacity: number;
  basePricePerNight: string | null;
  status: string;
  isActive: boolean;
}

export interface UserSummaryDto {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  isActive: boolean;
}

export interface StayResponseDto {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  createdAt: string;
  cabin: CabinSummaryDto;
  primaryGuest: GuestSummaryDto;
  guests: GuestSummaryDto[];
  createdByUser: UserSummaryDto | null;
  guestsCount: number;
  ordersCount: number;
  invoicesCount: number;
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function toGuestSummaryResponse(
  record: GuestSummaryRecord,
): GuestSummaryDto {
  return {
    id: record.id.toString(),
    fullName: record.fullName,
    idNumber: record.idNumber,
    originPlace: record.originPlace,
  };
}

export function toCabinSummaryResponse(
  record: CabinSummaryRecord,
): CabinSummaryDto {
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
  };
}

export function toStayResponse(record: StayRecord): StayResponseDto {
  return {
    id: record.id.toString(),
    checkInDate: toDateOnly(record.checkInDate),
    checkOutDate: toDateOnly(record.checkOutDate),
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    cabin: toCabinSummaryResponse(record.cabin),
    primaryGuest: toGuestSummaryResponse(record.primaryGuest),
    guests: record.stayGuests.map((stayGuest) =>
      toGuestSummaryResponse(stayGuest.guest),
    ),
    createdByUser: record.createdByUser
      ? {
          id: record.createdByUser.id.toString(),
          username: record.createdByUser.username,
          firstName: record.createdByUser.firstName,
          lastName: record.createdByUser.lastName,
          fullName: `${record.createdByUser.firstName} ${record.createdByUser.lastName}`,
          isActive: record.createdByUser.isActive,
        }
      : null,
    guestsCount: record._count.stayGuests,
    ordersCount: record._count.orders,
    invoicesCount: record._count.invoices,
  };
}