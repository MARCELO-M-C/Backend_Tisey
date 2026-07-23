import {
  OrderChannel,
  OrderEventType,
  OrderItemStatus,
  OrderStatus,
  Prisma,
  ServiceMode,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";

const userSummarySelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
} as const;

const orderSelect = Prisma.validator<Prisma.OrderDefaultArgs>()({
  select: {
    id: true,
    orderCode: true,
    customerName: true,
    channel: true,
    serviceMode: true,
    status: true,
    tableId: true,
    stayId: true,
    createdBy: true,
    waiterId: true,
    shiftId: true,
    notes: true,
    createdAt: true,
    sentAt: true,
    closedAt: true,
    cancelledAt: true,
    cancelReason: true,
    table: {
      select: {
        id: true,
        code: true,
        name: true,
        capacity: true,
        isActive: true,
      },
    },
    stay: {
      select: {
        id: true,
        status: true,
        checkInDate: true,
        checkOutDate: true,
        cabin: {
          select: {
            id: true,
            cabinNumber: true,
            name: true,
          },
        },
        primaryGuest: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    },
    createdByUser: {
      select: userSummarySelect,
    },
    waiter: {
      select: userSummarySelect,
    },
    shift: {
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        user: {
          select: userSummarySelect,
        },
      },
    },
    items: {
      orderBy: {
        id: "asc",
      },
      select: {
        id: true,
        orderId: true,
        menuItemId: true,
        itemName: true,
        stationId: true,
        unitPrice: true,
        quantity: true,
        itemNotes: true,
        itemStatus: true,
        createdAt: true,
        updatedAt: true,
        startedAt: true,
        readyAt: true,
        deliveredAt: true,
        preparedBy: true,
        deliveredBy: true,
        station: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
          },
        },
        menuItem: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
        preparedByUser: {
          select: userSummarySelect,
        },
        deliveredByUser: {
          select: userSummarySelect,
        },
      },
    },
    events: {
      orderBy: {
        performedAt: "desc",
      },
      select: {
        id: true,
        eventType: true,
        oldValue: true,
        newValue: true,
        performedBy: true,
        performedAt: true,
        performedByUser: {
          select: userSummarySelect,
        },
      },
    },
  },
});

export type OrderRecord = Prisma.OrderGetPayload<typeof orderSelect>;

export interface ListOrdersFilters {
  search?: string;
  status?: OrderStatus;
  channel?: OrderChannel;
  waiterId?: bigint;
  tableId?: bigint;
  stayId?: bigint;
  createdBy?: bigint;
  shiftId?: bigint;
}

export interface CreateOrderItemSnapshotInput {
  menuItemId: bigint;
  itemName: string;
  stationId: bigint;
  unitPrice: Prisma.Decimal;
  quantity: number;
  itemNotes?: string;
}

export interface CreateOrderRepositoryInput {
  orderCode: string;
  customerName?: string | null;
  channel: OrderChannel;
  serviceMode: ServiceMode;
  tableId?: bigint | null;
  stayId?: bigint | null;
  createdBy: bigint;
  waiterId?: bigint | null;
  shiftId?: bigint | null;
  notes?: string | null;
  items: CreateOrderItemSnapshotInput[];
  performedBy: bigint;
}

export interface UpdateOrderHeaderRepositoryInput {
  customerName?: string | null;
  channel?: OrderChannel;
  serviceMode?: ServiceMode;
  tableId?: bigint | null;
  stayId?: bigint | null;
  waiterId?: bigint | null;
  shiftId?: bigint | null;
  notes?: string | null;
}

export interface BasicUserLookup {
  id: bigint;
  username: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

export interface TableLookup {
  id: bigint;
  code: string;
  name: string | null;
  capacity: number | null;
  isActive: boolean;
}

export interface StayLookup {
  id: bigint;
  status: string;
  checkInDate: Date;
  checkOutDate: Date;
  primaryGuest: {
    id: bigint;
    fullName: string;
  };
  cabin: {
    id: bigint;
    cabinNumber: number;
    name: string | null;
  };
}

export interface ShiftLookup {
  id: bigint;
  userId: bigint;
  startedAt: Date;
  endedAt: Date | null;
}

export interface MenuItemLookup {
  id: bigint;
  name: string;
  basePrice: Prisma.Decimal;
  stationId: bigint;
  isActive: boolean;
}

export interface UpdateOrderItemStatusRepositoryInput {
  orderId: bigint;
  itemId: bigint;
  previousItemStatus: OrderItemStatus;
  nextItemStatus: OrderItemStatus;
  previousOrderStatus: OrderStatus;
  nextOrderStatus: OrderStatus;
  actorUserId: bigint;
}

export async function listOrders(
  filters: ListOrdersFilters,
): Promise<OrderRecord[]> {
  return prisma.order.findMany({
    where: {
      ...(filters.search
        ? {
            OR: [
              {
                orderCode: {
                  contains: filters.search,
                },
              },
              {
                customerName: {
                  contains: filters.search,
                },
              },
            ],
          }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.channel ? { channel: filters.channel } : {}),
      ...(filters.waiterId ? { waiterId: filters.waiterId } : {}),
      ...(filters.tableId ? { tableId: filters.tableId } : {}),
      ...(filters.stayId ? { stayId: filters.stayId } : {}),
      ...(filters.createdBy ? { createdBy: filters.createdBy } : {}),
      ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...orderSelect,
  });
}

export async function findOrderById(id: bigint): Promise<OrderRecord | null> {
  return prisma.order.findUnique({
    where: { id },
    ...orderSelect,
  });
}

export async function findLatestOrderCode(prefix: string): Promise<string | null> {
  const order = await prisma.order.findFirst({
    where: {
      orderCode: {
        startsWith: prefix,
      },
    },
    orderBy: {
      orderCode: "desc",
    },
    select: {
      orderCode: true,
    },
  });

  return order?.orderCode ?? null;
}

export async function findUserById(id: bigint): Promise<BasicUserLookup | null> {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });
}

export async function findTableById(id: bigint): Promise<TableLookup | null> {
  return prisma.restaurantTable.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      capacity: true,
      isActive: true,
    },
  });
}

export async function findStayById(id: bigint): Promise<StayLookup | null> {
  return prisma.stay.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      checkInDate: true,
      checkOutDate: true,
      primaryGuest: {
        select: {
          id: true,
          fullName: true,
        },
      },
      cabin: {
        select: {
          id: true,
          cabinNumber: true,
          name: true,
        },
      },
    },
  });
}

export async function findShiftById(id: bigint): Promise<ShiftLookup | null> {
  return prisma.shift.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      startedAt: true,
      endedAt: true,
    },
  });
}

export async function findMenuItemsByIds(
  ids: bigint[],
): Promise<MenuItemLookup[]> {
  return prisma.menuItem.findMany({
    where: {
      id: {
        in: ids,
      },
    },
    select: {
      id: true,
      name: true,
      basePrice: true,
      stationId: true,
      isActive: true,
    },
    orderBy: {
      id: "asc",
    },
  });
}

function ensureHydratedOrder(order: OrderRecord | null): OrderRecord {
  if (!order) {
    throw new Error("No se pudo recargar la orden.");
  }

  return order;
}

export async function createOrder(
  data: CreateOrderRepositoryInput,
): Promise<OrderRecord> {
  return prisma.$transaction(async (tx) => {
    const createdOrder = await tx.order.create({
      data: {
        orderCode: data.orderCode,
        customerName: data.customerName ?? null,
        channel: data.channel,
        serviceMode: data.serviceMode,
        status: OrderStatus.DRAFT,
        tableId: data.tableId ?? null,
        stayId: data.stayId ?? null,
        createdBy: data.createdBy,
        waiterId: data.waiterId ?? null,
        shiftId: data.shiftId ?? null,
        notes: data.notes ?? null,
      },
      select: {
        id: true,
      },
    });

    await tx.orderItem.createMany({
      data: data.items.map((item) => ({
        orderId: createdOrder.id,
        menuItemId: item.menuItemId,
        itemName: item.itemName,
        stationId: item.stationId,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        itemNotes: item.itemNotes ?? null,
      })),
    });

    await tx.orderEvent.create({
      data: {
        orderId: createdOrder.id,
        eventType: OrderEventType.OTHER,
        oldValue: null,
        newValue: `Orden creada con ${data.items.length} ítem(s).`,
        performedBy: data.performedBy,
      },
    });

    const hydratedOrder = await tx.order.findUnique({
      where: { id: createdOrder.id },
      ...orderSelect,
    });

    return ensureHydratedOrder(hydratedOrder);
  });
}

export async function updateOrderHeader(
  orderId: bigint,
  data: UpdateOrderHeaderRepositoryInput,
  performedBy: bigint,
): Promise<OrderRecord> {
  return prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        ...(Object.prototype.hasOwnProperty.call(data, "customerName")
          ? { customerName: data.customerName ?? null }
          : {}),
        ...(data.channel ? { channel: data.channel } : {}),
        ...(data.serviceMode ? { serviceMode: data.serviceMode } : {}),
        ...(Object.prototype.hasOwnProperty.call(data, "tableId")
          ? { tableId: data.tableId ?? null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(data, "stayId")
          ? { stayId: data.stayId ?? null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(data, "waiterId")
          ? { waiterId: data.waiterId ?? null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(data, "shiftId")
          ? { shiftId: data.shiftId ?? null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(data, "notes")
          ? { notes: data.notes ?? null }
          : {}),
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        eventType: OrderEventType.OTHER,
        oldValue: null,
        newValue: "Cabecera de la orden actualizada.",
        performedBy,
      },
    });

    const hydratedOrder = await tx.order.findUnique({
      where: { id: orderId },
      ...orderSelect,
    });

    return ensureHydratedOrder(hydratedOrder);
  });
}

export async function addItemsToOrder(
  orderId: bigint,
  items: CreateOrderItemSnapshotInput[],
  performedBy: bigint,
): Promise<OrderRecord> {
  return prisma.$transaction(async (tx) => {
    await tx.orderItem.createMany({
      data: items.map((item) => ({
        orderId,
        menuItemId: item.menuItemId,
        itemName: item.itemName,
        stationId: item.stationId,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        itemNotes: item.itemNotes ?? null,
      })),
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        eventType: OrderEventType.ITEM_ADDED,
        oldValue: null,
        newValue: `Se agregaron ${items.length} ítem(s).`,
        performedBy,
      },
    });

    const hydratedOrder = await tx.order.findUnique({
      where: { id: orderId },
      ...orderSelect,
    });

    return ensureHydratedOrder(hydratedOrder);
  });
}

export async function sendOrder(
  orderId: bigint,
  performedBy: bigint,
): Promise<OrderRecord> {
  return prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.SENT,
        sentAt: new Date(),
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        eventType: OrderEventType.STATUS_CHANGE,
        oldValue: OrderStatus.DRAFT,
        newValue: OrderStatus.SENT,
        performedBy,
      },
    });

    const hydratedOrder = await tx.order.findUnique({
      where: { id: orderId },
      ...orderSelect,
    });

    return ensureHydratedOrder(hydratedOrder);
  });
}

export async function cancelOrder(
  orderId: bigint,
  reason: string,
  performedBy: bigint,
): Promise<OrderRecord> {
  return prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });

    await tx.orderItem.updateMany({
      where: {
        orderId,
        itemStatus: {
          notIn: [OrderItemStatus.CANCELLED, OrderItemStatus.DELIVERED],
        },
      },
      data: {
        itemStatus: OrderItemStatus.CANCELLED,
        updatedAt: new Date(),
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        eventType: OrderEventType.STATUS_CHANGE,
        oldValue: null,
        newValue: `CANCELLED | ${reason}`,
        performedBy,
      },
    });

    const hydratedOrder = await tx.order.findUnique({
      where: { id: orderId },
      ...orderSelect,
    });

    return ensureHydratedOrder(hydratedOrder);
  });
}

export async function updateOrderItemStatus(
  data: UpdateOrderItemStatusRepositoryInput,
): Promise<OrderRecord> {
  return prisma.$transaction(async (tx) => {
    await tx.orderItem.update({
      where: {
        id: data.itemId,
      },
      data: {
        itemStatus: data.nextItemStatus,
        updatedAt: new Date(),
        ...(data.nextItemStatus === OrderItemStatus.IN_PROGRESS
          ? {
              startedAt: new Date(),
              preparedBy: data.actorUserId,
            }
          : {}),
        ...(data.nextItemStatus === OrderItemStatus.READY
          ? {
              readyAt: new Date(),
              preparedBy: data.actorUserId,
            }
          : {}),
        ...(data.nextItemStatus === OrderItemStatus.DELIVERED
          ? {
              deliveredAt: new Date(),
              deliveredBy: data.actorUserId,
            }
          : {}),
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: data.orderId,
        eventType:
          data.nextItemStatus === OrderItemStatus.CANCELLED
            ? OrderEventType.ITEM_CANCELLED
            : OrderEventType.ITEM_UPDATED,
        oldValue: data.previousItemStatus,
        newValue: data.nextItemStatus,
        performedBy: data.actorUserId,
      },
    });

    if (data.nextOrderStatus !== data.previousOrderStatus) {
      await tx.order.update({
        where: { id: data.orderId },
        data: {
          status: data.nextOrderStatus,
          ...(data.nextOrderStatus === OrderStatus.CANCELLED
            ? {
                cancelledAt: new Date(),
                cancelReason: "Todos los ítems fueron cancelados.",
              }
            : {}),
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: data.orderId,
          eventType: OrderEventType.STATUS_CHANGE,
          oldValue: data.previousOrderStatus,
          newValue: data.nextOrderStatus,
          performedBy: data.actorUserId,
        },
      });
    }

    const hydratedOrder = await tx.order.findUnique({
      where: { id: data.orderId },
      ...orderSelect,
    });

    return ensureHydratedOrder(hydratedOrder);
  });
}