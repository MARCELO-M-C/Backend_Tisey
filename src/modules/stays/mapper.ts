import { Prisma } from "@prisma/client";
import type {
  CabinSummaryRecord,
  GuestSummaryRecord,
  StayRecord,
} from "./repository";

export interface GuestSummaryDto {
  id: string;
  fullName: string;
  idNumber: string | null;
  originPlace: string | null;
  birthDate: string | null;
}

export interface StayGuestDto extends GuestSummaryDto {
  ageAtCheckIn: number | null;
  isChargeable: boolean;
}

export interface CabinSummaryDto {
  id: string;
  cabinNumber: number;
  name: string | null;
  capacity: number;
  status: string;
  isActive: boolean;
}

export interface LodgingRateSummaryDto {
  id: string;
  amountPerPersonPerNight: string;
  minimumChargeableAge: number;
  effectiveFrom: string;
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
  lodgingRateId: string;
  checkInDate: string;
  checkOutDate: string;
  ratePerPersonPerNight: string;
  minimumChargeableAge: number;
  status: string;
  createdAt: string;
  cabin: CabinSummaryDto;
  lodgingRate: LodgingRateSummaryDto;
  primaryGuest: GuestSummaryDto;
  guests: StayGuestDto[];
  createdByUser: UserSummaryDto | null;
  nightsCount: number;
  guestsCount: number;
  chargeableGuestsCount: number;
  personNightsCount: number;
  estimatedRoomTotal: string;
  ordersCount: number;
  invoicesCount: number;
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function calculateNights(checkInDate: Date, checkOutDate: Date): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(
    1,
    Math.round(
      (checkOutDate.getTime() - checkInDate.getTime()) / millisecondsPerDay,
    ),
  );
}

export function toGuestSummaryResponse(
  record: GuestSummaryRecord,
): GuestSummaryDto {
  return {
    id: record.id.toString(),
    fullName: record.fullName,
    idNumber: record.idNumber,
    originPlace: record.originPlace,
    birthDate: record.birthDate ? toDateOnly(record.birthDate) : null,
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
    status: record.status,
    isActive: record.isActive,
  };
}

export function toStayResponse(record: StayRecord): StayResponseDto {
  const nightsCount = calculateNights(record.checkInDate, record.checkOutDate);
  const chargeableGuestsCount = record.stayGuests.filter(
    (stayGuest) => stayGuest.isChargeable,
  ).length;
  const personNightsCount = chargeableGuestsCount * nightsCount;
  const estimatedRoomTotal = record.ratePerPersonPerNight.mul(
    new Prisma.Decimal(personNightsCount),
  );

  return {
    id: record.id.toString(),
    lodgingRateId: record.lodgingRateId.toString(),
    checkInDate: toDateOnly(record.checkInDate),
    checkOutDate: toDateOnly(record.checkOutDate),
    ratePerPersonPerNight: record.ratePerPersonPerNight.toFixed(2),
    minimumChargeableAge: record.minimumChargeableAge,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    cabin: toCabinSummaryResponse(record.cabin),
    lodgingRate: {
      id: record.lodgingRate.id.toString(),
      amountPerPersonPerNight:
        record.lodgingRate.amountPerPersonPerNight.toFixed(2),
      minimumChargeableAge: record.lodgingRate.minimumChargeableAge,
      effectiveFrom: toDateOnly(record.lodgingRate.effectiveFrom),
    },
    primaryGuest: toGuestSummaryResponse(record.primaryGuest),
    guests: record.stayGuests.map((stayGuest) => ({
      ...toGuestSummaryResponse(stayGuest.guest),
      ageAtCheckIn: stayGuest.ageAtCheckIn,
      isChargeable: stayGuest.isChargeable,
    })),
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
    nightsCount,
    guestsCount: record._count.stayGuests,
    chargeableGuestsCount,
    personNightsCount,
    estimatedRoomTotal: estimatedRoomTotal.toFixed(2),
    ordersCount: record._count.orders,
    invoicesCount: record._count.invoices,
  };
}
