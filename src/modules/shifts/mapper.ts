import type { ShiftRecord, UserSummaryRecord } from "./repository";

export interface UserSummaryDto {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  isActive: boolean;
}

export interface ShiftResponseDto {
  id: string;
  startedAt: string;
  endedAt: string | null;
  isOpen: boolean;
  notes: string | null;
  user: UserSummaryDto;
  ordersCount: number;
}

export function toUserSummaryResponse(record: UserSummaryRecord): UserSummaryDto {
  return {
    id: record.id.toString(),
    username: record.username,
    firstName: record.firstName,
    lastName: record.lastName,
    fullName: `${record.firstName} ${record.lastName}`,
    isActive: record.isActive,
  };
}

export function toShiftResponse(record: ShiftRecord): ShiftResponseDto {
  return {
    id: record.id.toString(),
    startedAt: record.startedAt.toISOString(),
    endedAt: record.endedAt ? record.endedAt.toISOString() : null,
    isOpen: record.endedAt === null,
    notes: record.notes,
    user: toUserSummaryResponse(record.user),
    ordersCount: record._count.orders,
  };
}