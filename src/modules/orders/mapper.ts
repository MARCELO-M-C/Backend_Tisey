import { OrderItemStatus, Prisma } from "@prisma/client";
import type { OrderRecord } from "./repository";

export interface OrderUserSummaryDto {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

export interface OrderTableDto {
  id: string;
  code: string;
  name: string | null;
  capacity: number | null;
  isActive: boolean;
}

export interface OrderStayDto {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  cabin: {
    id: string;
    cabinNumber: number;
    name: string | null;
  };
  primaryGuest: {
    id: string;
    fullName: string;
  };
}

export interface OrderShiftDto {
  id: string;
  startedAt: string;
  endedAt: string | null;
  user: OrderUserSummaryDto;
}

export interface OrderItemDto {
  id: string;
  menuItemId: string | null;
  itemName: string;
  station: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  };
  menuItem: {
    id: string;
    name: string;
    isActive: boolean;
  } | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  itemNotes: string | null;
  itemStatus: string;
  createdAt: string;
  updatedAt: string | null;
  startedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  preparedBy: OrderUserSummaryDto | null;
  deliveredBy: OrderUserSummaryDto | null;
}

export interface OrderEventDto {
  id: string;
  eventType: string;
  oldValue: string | null;
  newValue: string | null;
  performedAt: string;
  performedBy: OrderUserSummaryDto;
}

export interface OrderSummaryDto {
  linesCount: number;
  activeLinesCount: number;
  totalQuantity: number;
  subtotal: string;
}

export interface OrderResponseDto {
  id: string;
  orderCode: string;
  channel: string;
  serviceMode: string;
  status: string;
  notes: string | null;
  createdAt: string;
  sentAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdBy: OrderUserSummaryDto;
  waiter: OrderUserSummaryDto | null;
  shift: OrderShiftDto | null;
  table: OrderTableDto | null;
  stay: OrderStayDto | null;
  summary: OrderSummaryDto;
  items: OrderItemDto[];
  events: OrderEventDto[];
}

function toIsoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function toUserSummary(
  user:
    | {
        id: bigint;
        username: string;
        firstName: string;
        lastName: string;
      }
    | null
    | undefined,
): OrderUserSummaryDto | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id.toString(),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
  };
}

export function toOrderResponse(record: OrderRecord): OrderResponseDto {
  const items = record.items.map((item) => ({
    id: item.id.toString(),
    menuItemId: item.menuItemId ? item.menuItemId.toString() : null,
    itemName: item.itemName,
    station: {
      id: item.station.id.toString(),
      code: item.station.code,
      name: item.station.name,
      isActive: item.station.isActive,
    },
    menuItem: item.menuItem
      ? {
          id: item.menuItem.id.toString(),
          name: item.menuItem.name,
          isActive: item.menuItem.isActive,
        }
      : null,
    unitPrice: item.unitPrice.toFixed(2),
    quantity: item.quantity,
    lineTotal: item.unitPrice.mul(item.quantity).toFixed(2),
    itemNotes: item.itemNotes ?? null,
    itemStatus: item.itemStatus,
    createdAt: item.createdAt.toISOString(),
    updatedAt: toIsoOrNull(item.updatedAt),
    startedAt: toIsoOrNull(item.startedAt),
    readyAt: toIsoOrNull(item.readyAt),
    deliveredAt: toIsoOrNull(item.deliveredAt),
    preparedBy: toUserSummary(item.preparedByUser),
    deliveredBy: toUserSummary(item.deliveredByUser),
  }));

  const subtotal = record.items.reduce((acc, item) => {
    if (item.itemStatus === OrderItemStatus.CANCELLED) {
      return acc;
    }

    return acc.add(item.unitPrice.mul(item.quantity));
  }, new Prisma.Decimal(0));

  return {
    id: record.id.toString(),
    orderCode: record.orderCode,
    channel: record.channel,
    serviceMode: record.serviceMode,
    status: record.status,
    notes: record.notes ?? null,
    createdAt: record.createdAt.toISOString(),
    sentAt: toIsoOrNull(record.sentAt),
    closedAt: toIsoOrNull(record.closedAt),
    cancelledAt: toIsoOrNull(record.cancelledAt),
    cancelReason: record.cancelReason ?? null,
    createdBy: toUserSummary(record.createdByUser)!,
    waiter: toUserSummary(record.waiter),
    shift: record.shift
      ? {
          id: record.shift.id.toString(),
          startedAt: record.shift.startedAt.toISOString(),
          endedAt: toIsoOrNull(record.shift.endedAt),
          user: toUserSummary(record.shift.user)!,
        }
      : null,
    table: record.table
      ? {
          id: record.table.id.toString(),
          code: record.table.code,
          name: record.table.name ?? null,
          capacity: record.table.capacity ?? null,
          isActive: record.table.isActive,
        }
      : null,
    stay: record.stay
      ? {
          id: record.stay.id.toString(),
          status: record.stay.status,
          checkInDate: record.stay.checkInDate.toISOString(),
          checkOutDate: record.stay.checkOutDate.toISOString(),
          cabin: {
            id: record.stay.cabin.id.toString(),
            cabinNumber: record.stay.cabin.cabinNumber,
            name: record.stay.cabin.name ?? null,
          },
          primaryGuest: {
            id: record.stay.primaryGuest.id.toString(),
            fullName: record.stay.primaryGuest.fullName,
          },
        }
      : null,
    summary: {
      linesCount: record.items.length,
      activeLinesCount: record.items.filter(
        (item) => item.itemStatus !== OrderItemStatus.CANCELLED,
      ).length,
      totalQuantity: record.items.reduce((acc, item) => acc + item.quantity, 0),
      subtotal: subtotal.toFixed(2),
    },
    items,
    events: record.events.map((event) => ({
      id: event.id.toString(),
      eventType: event.eventType,
      oldValue: event.oldValue ?? null,
      newValue: event.newValue ?? null,
      performedAt: event.performedAt.toISOString(),
      performedBy: toUserSummary(event.performedByUser)!,
    })),
  };
}