import {
  OrderEventType,
  OrderItemStatus,
  OrderStatus,
  Prisma,
  ServiceMode,
} from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

import { env } from "../../config/env";
import {
  ROLE_GROUPS,
  authenticate,
  isAdminUser,
  isCashierUser,
  isKitchenUser,
  isWaiterUser,
  requireAnyRole,
} from "../auth/auth.guards";
import { prisma } from "../../lib/prisma";
import { emitOrderRealtime } from "../../realtime/socket";
import { getNextOrderCode } from "./order-code";

type CreateOrderItemBody = {
  menuItemId: string;
  quantity: number;
  itemNotes?: string;
};

type CreateOrderBody = {
  channel: "DINE_IN" | "TAKE_AWAY" | "ROOM_CHARGE";
  serviceMode: ServiceMode;
  tableId?: string;
  stayId?: string;
  stayGroupId?: string;
  waiterId?: string;
  shiftId?: string;
  notes?: string;
  items: CreateOrderItemBody[];
};

type UpdateOrderItemBody = {
  orderItemId: string;
  quantity?: number;
  itemNotes?: string;
  unitPrice?: number;
  itemStatus?: OrderItemStatus;
};

type UpdateOrderBody = {
  notes?: string;
  serviceMode?: ServiceMode;
  status?: OrderStatus;
  cancelReason?: string | null;
  tableId?: string | null;
  stayId?: string | null;
  stayGroupId?: string | null;
  addItems?: CreateOrderItemBody[];
  updateItems?: UpdateOrderItemBody[];
  cancelItemIds?: string[];
};

type OverdueQuery = {
  stationId?: string;
};

type OverdueOrderRow = {
  id: bigint;
  order_code: string;
  status: OrderStatus;
  channel: "DINE_IN" | "TAKE_AWAY" | "ROOM_CHARGE";
  service_mode: ServiceMode;
  created_at: Date;
  sent_at: Date;
  minutes_since_sent: number;
  waiter_id: bigint | null;
  waiter_first_name: string | null;
  waiter_last_name: string | null;
};

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: true };
}>;

const createOrderSchema = {
  tags: ["Orders"],
  summary: "Crear pedido (JWT requerido)",
  security: [{ bearerAuth: [] }],
  body: {
    type: "object",
    required: ["channel", "serviceMode", "items"],
    properties: {
      channel: {
        type: "string",
        enum: ["DINE_IN", "TAKE_AWAY", "ROOM_CHARGE"],
      },
      serviceMode: {
        type: "string",
        enum: ["EAT_HERE", "TO_GO"],
      },
      tableId: { type: "string" },
      stayId: { type: "string" },
      stayGroupId: { type: "string" },
      waiterId: { type: "string" },
      shiftId: { type: "string" },
      notes: { type: "string", maxLength: 500 },
      items: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["menuItemId", "quantity"],
          properties: {
            menuItemId: { type: "string" },
            quantity: { type: "integer", minimum: 1 },
            itemNotes: { type: "string", maxLength: 255 },
          },
        },
      },
    },
  },
};

const overdueSchema = {
  tags: ["Orders"],
  summary: "Pedidos atrasados con alertas",
  security: [{ bearerAuth: [] }],
  querystring: {
    type: "object",
    properties: {
      stationId: { type: "string" },
    },
  },
};

const updateOrderSchema = {
  tags: ["Orders"],
  summary: "Editar pedido por rol (mesero limitado, admin total)",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    required: ["orderId"],
    properties: {
      orderId: { type: "string" },
    },
  },
  body: {
    type: "object",
    minProperties: 1,
    properties: {
      notes: { type: "string", maxLength: 500 },
      serviceMode: {
        type: "string",
        enum: ["EAT_HERE", "TO_GO"],
      },
      status: {
        type: "string",
        enum: ["DRAFT", "SENT", "IN_PROGRESS", "READY", "DELIVERED", "CLOSED", "CANCELLED"],
      },
      cancelReason: {
        anyOf: [{ type: "string", maxLength: 255 }, { type: "null" }],
      },
      tableId: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      stayId: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      stayGroupId: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      addItems: {
        type: "array",
        items: {
          type: "object",
          required: ["menuItemId", "quantity"],
          properties: {
            menuItemId: { type: "string" },
            quantity: { type: "integer", minimum: 1 },
            itemNotes: { type: "string", maxLength: 255 },
          },
        },
      },
      updateItems: {
        type: "array",
        items: {
          type: "object",
          required: ["orderItemId"],
          properties: {
            orderItemId: { type: "string" },
            quantity: { type: "integer", minimum: 1 },
            itemNotes: { type: "string", maxLength: 255 },
            unitPrice: { type: "number", minimum: 0.01 },
            itemStatus: {
              type: "string",
              enum: ["PENDING", "IN_PROGRESS", "READY", "DELIVERED", "CANCELLED"],
            },
          },
        },
      },
      cancelItemIds: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
};

function parseOptionalId(value?: string): bigint | undefined {
  if (!value) {
    return undefined;
  }

  return BigInt(value);
}

function parseNullableId(value: string | null | undefined): bigint | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return BigInt(value);
}

function parseRequiredId(value: string, field: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new Error(`${field} no tiene formato valido.`);
  }
}

function decimalToNumber(value: Prisma.Decimal): number {
  return Number(value.toString());
}

function truncateForAudit(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return value.length > 200 ? `${value.slice(0, 197)}...` : value;
}

function serializeOrder(order: OrderWithItems) {
  return {
    id: order.id.toString(),
    orderCode: order.orderCode,
    channel: order.channel,
    serviceMode: order.serviceMode,
    status: order.status,
    tableId: order.tableId?.toString() ?? null,
    stayId: order.stayId?.toString() ?? null,
    stayGroupId: order.stayGroupId?.toString() ?? null,
    createdBy: order.createdBy.toString(),
    waiterId: order.waiterId?.toString() ?? null,
    shiftId: order.shiftId?.toString() ?? null,
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    sentAt: order.sentAt?.toISOString() ?? null,
    closedAt: order.closedAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancelReason: order.cancelReason,
    items: order.items.map((item) => ({
      id: item.id.toString(),
      menuItemId: item.menuItemId?.toString() ?? null,
      itemName: item.itemName,
      stationId: item.stationId.toString(),
      unitPrice: decimalToNumber(item.unitPrice),
      quantity: item.quantity,
      itemStatus: item.itemStatus,
      itemNotes: item.itemNotes,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt?.toISOString() ?? null,
      startedAt: item.startedAt?.toISOString() ?? null,
      readyAt: item.readyAt?.toISOString() ?? null,
      deliveredAt: item.deliveredAt?.toISOString() ?? null,
    })),
  };
}

function isOrderCodeConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2002") {
    return false;
  }

  const target = (error.meta as { target?: unknown } | undefined)?.target;
  const targetText = Array.isArray(target) ? target.join(",") : `${target ?? ""}`;

  return targetText.includes("order_code") || targetText.includes("orderCode");
}

function resolveAlert(minutesSinceSent: number): "EARLY" | "RED" {
  return minutesSinceSent >= env.ORDER_RED_ALERT_MINUTES ? "RED" : "EARLY";
}

function parseMinutesSinceOrderCreated(createdAt: Date): number {
  return Math.floor((Date.now() - createdAt.getTime()) / 60000);
}

export const ordersRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: CreateOrderBody }>(
    "/",
    {
      preHandler: [authenticate, requireAnyRole([...ROLE_GROUPS.WAITER])],
      schema: createOrderSchema,
    },
    async (request, reply) => {
      const authUser = request.authUser;
      if (!authUser) {
        return reply.unauthorized("No autenticado.");
      }

      const createdBy = authUser.id;
      const admin = isAdminUser(authUser);

      let tableId: bigint | undefined;
      let stayId: bigint | undefined;
      let stayGroupId: bigint | undefined;
      let waiterId: bigint | undefined;
      let shiftId: bigint | undefined;
      let parsedItems: Array<{
        menuItemId: bigint;
        quantity: number;
        itemNotes?: string;
      }> = [];

      try {
        tableId = parseOptionalId(request.body.tableId);
        stayId = parseOptionalId(request.body.stayId);
        stayGroupId = parseOptionalId(request.body.stayGroupId);
        shiftId = parseOptionalId(request.body.shiftId);
        waiterId = admin ? parseOptionalId(request.body.waiterId) : authUser.id;

        parsedItems = request.body.items.map((item) => ({
          menuItemId: parseRequiredId(item.menuItemId, "menuItemId"),
          quantity: item.quantity,
          itemNotes: item.itemNotes,
        }));
      } catch (error) {
        return reply.badRequest((error as Error).message);
      }

      const uniqueMenuItemIdStrings = [...new Set(parsedItems.map((item) => item.menuItemId.toString()))];
      const uniqueMenuItemIds = uniqueMenuItemIdStrings.map((id) => BigInt(id));

      const menuItems = await prisma.menuItem.findMany({
        where: {
          id: { in: uniqueMenuItemIds },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          stationId: true,
          basePrice: true,
        },
      });
      const menuItemMap = new Map(menuItems.map((item) => [item.id.toString(), item]));

      const missingMenuItemIds = uniqueMenuItemIdStrings.filter((id) => !menuItemMap.has(id));
      if (missingMenuItemIds.length > 0) {
        return reply.badRequest(
          `No se encontraron menu_items activos para los IDs: ${missingMenuItemIds.join(", ")}`,
        );
      }

      const maxAttempts = 4;
      let currentAttempt = 0;

      while (currentAttempt < maxAttempts) {
        currentAttempt += 1;

        try {
          const now = new Date();

          const createdOrder = await prisma.$transaction(
            async (tx) => {
              const orderCode = await getNextOrderCode(tx, now);

              return tx.order.create({
                data: {
                  orderCode,
                  channel: request.body.channel,
                  serviceMode: request.body.serviceMode,
                  status: OrderStatus.SENT,
                  tableId,
                  stayId,
                  stayGroupId,
                  createdBy,
                  waiterId,
                  shiftId,
                  notes: request.body.notes,
                  sentAt: now,
                  items: {
                    create: parsedItems.map((item) => {
                      const menuItem = menuItemMap.get(item.menuItemId.toString())!;

                      return {
                        menuItemId: menuItem.id,
                        itemName: menuItem.name,
                        stationId: menuItem.stationId,
                        unitPrice: menuItem.basePrice,
                        quantity: item.quantity,
                        itemNotes: item.itemNotes,
                      };
                    }),
                  },
                  events: {
                    create: {
                      eventType: OrderEventType.STATUS_CHANGE,
                      oldValue: "DRAFT",
                      newValue: OrderStatus.SENT,
                      performedBy: createdBy,
                    },
                  },
                },
                include: {
                  items: true,
                },
              });
            },
            {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
          );

          emitOrderRealtime("orders:new", {
            id: createdOrder.id.toString(),
            orderCode: createdOrder.orderCode,
            status: createdOrder.status,
            sentAt: createdOrder.sentAt?.toISOString() ?? null,
          });

          return reply.code(201).send(serializeOrder(createdOrder));
        } catch (error) {
          if (isOrderCodeConflict(error) && currentAttempt < maxAttempts) {
            continue;
          }

          request.log.error(error);
          return reply.internalServerError("No se pudo crear el pedido.");
        }
      }

      return reply.internalServerError("No se pudo crear el pedido.");
    },
  );

  app.get<{ Querystring: OverdueQuery }>(
    "/overdue",
    {
      preHandler: [
        authenticate,
        requireAnyRole([...ROLE_GROUPS.WAITER, ...ROLE_GROUPS.KITCHEN, ...ROLE_GROUPS.CASHIER]),
      ],
      schema: overdueSchema,
    },
    async (request, reply) => {
      const authUser = request.authUser;
      if (!authUser) {
        return reply.unauthorized("No autenticado.");
      }

      let stationId: bigint | undefined;
      try {
        stationId = parseOptionalId(request.query.stationId);
      } catch {
        return reply.badRequest("stationId no tiene formato valido.");
      }

      const canViewAllOrders =
        isAdminUser(authUser) || isKitchenUser(authUser) || isCashierUser(authUser);
      const restrictToWaiter = isWaiterUser(authUser) && !canViewAllOrders;

      const stationFilter = stationId
        ? Prisma.sql`AND EXISTS (
            SELECT 1
            FROM order_items oi
            WHERE oi.order_id = o.id
              AND oi.station_id = ${stationId}
          )`
        : Prisma.empty;

      const waiterFilter = restrictToWaiter
        ? Prisma.sql`AND o.waiter_id = ${authUser.id}`
        : Prisma.empty;

      const overdueOrders = await prisma.$queryRaw<OverdueOrderRow[]>(Prisma.sql`
        SELECT
          o.id,
          o.order_code,
          o.status,
          o.channel,
          o.service_mode,
          o.created_at,
          o.sent_at,
          TIMESTAMPDIFF(MINUTE, o.sent_at, NOW()) AS minutes_since_sent,
          w.id AS waiter_id,
          w.first_name AS waiter_first_name,
          w.last_name AS waiter_last_name
        FROM orders o
        LEFT JOIN users w ON w.id = o.waiter_id
        WHERE o.status IN ('SENT', 'IN_PROGRESS')
          AND o.sent_at IS NOT NULL
          AND TIMESTAMPDIFF(MINUTE, o.sent_at, NOW()) >= ${env.ORDER_ALERT_MINUTES}
          ${stationFilter}
          ${waiterFilter}
        ORDER BY o.sent_at ASC
      `);

      return {
        thresholds: {
          early: env.ORDER_ALERT_MINUTES,
          red: env.ORDER_RED_ALERT_MINUTES,
        },
        orders: overdueOrders.map((order) => ({
          id: order.id.toString(),
          orderCode: order.order_code,
          status: order.status,
          channel: order.channel,
          serviceMode: order.service_mode,
          createdAt: order.created_at.toISOString(),
          sentAt: order.sent_at.toISOString(),
          minutesSinceSent: Number(order.minutes_since_sent),
          alert: resolveAlert(Number(order.minutes_since_sent)),
          waiter: order.waiter_id
            ? {
                id: order.waiter_id.toString(),
                firstName: order.waiter_first_name,
                lastName: order.waiter_last_name,
              }
            : null,
        })),
      };
    },
  );

  app.patch<{ Params: { orderId: string }; Body: UpdateOrderBody }>(
    "/:orderId",
    {
      preHandler: [authenticate, requireAnyRole([...ROLE_GROUPS.WAITER])],
      schema: updateOrderSchema,
    },
    async (request, reply) => {
      const authUser = request.authUser;
      if (!authUser) {
        return reply.unauthorized("No autenticado.");
      }

      const admin = isAdminUser(authUser);
      const waiter = isWaiterUser(authUser);
      if (!admin && !waiter) {
        return reply.forbidden("No tienes permisos para editar pedidos.");
      }

      let orderId: bigint;
      try {
        orderId = parseRequiredId(request.params.orderId, "orderId");
      } catch (error) {
        return reply.badRequest((error as Error).message);
      }

      const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          invoices: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!existingOrder) {
        return reply.notFound("Pedido no encontrado.");
      }

      const ownsOrder =
        existingOrder.waiterId === authUser.id || existingOrder.createdBy === authUser.id;
      const minutesSinceCreated = parseMinutesSinceOrderCreated(existingOrder.createdAt);

      if (!admin) {
        if (!ownsOrder) {
          return reply.forbidden("Mesero solo puede editar sus propios pedidos.");
        }

        if (minutesSinceCreated > env.WAITER_EDIT_WINDOW_MINUTES) {
          return reply.forbidden(
            `Ventana de edicion vencida. Limite: ${env.WAITER_EDIT_WINDOW_MINUTES} minutos.`,
          );
        }

        if (existingOrder.invoices.length > 0) {
          return reply.forbidden("No puedes editar pedidos ya facturados.");
        }

        if (
          existingOrder.status === OrderStatus.CLOSED ||
          existingOrder.status === OrderStatus.CANCELLED
        ) {
          return reply.forbidden("No puedes editar pedidos cerrados o cancelados.");
        }

        if (request.body.status !== undefined || request.body.cancelReason !== undefined) {
          return reply.forbidden("Solo admin puede cambiar status/cancelReason del pedido.");
        }

        if (
          request.body.updateItems?.some(
            (item) => item.unitPrice !== undefined || item.itemStatus !== undefined,
          )
        ) {
          return reply.forbidden("Solo admin puede editar precio o estado de items.");
        }
      }

      let addItems: Array<{
        menuItemId: bigint;
        quantity: number;
        itemNotes?: string;
      }> = [];
      let updateItems: Array<{
        orderItemId: bigint;
        quantity?: number;
        itemNotes?: string;
        unitPrice?: number;
        itemStatus?: OrderItemStatus;
      }> = [];
      let cancelItemIds: bigint[] = [];
      let tableId: bigint | null | undefined;
      let stayId: bigint | null | undefined;
      let stayGroupId: bigint | null | undefined;

      try {
        addItems =
          request.body.addItems?.map((item) => ({
            menuItemId: parseRequiredId(item.menuItemId, "addItems.menuItemId"),
            quantity: item.quantity,
            itemNotes: item.itemNotes,
          })) ?? [];

        updateItems =
          request.body.updateItems?.map((item) => ({
            orderItemId: parseRequiredId(item.orderItemId, "updateItems.orderItemId"),
            quantity: item.quantity,
            itemNotes: item.itemNotes,
            unitPrice: item.unitPrice,
            itemStatus: item.itemStatus,
          })) ?? [];

        cancelItemIds =
          request.body.cancelItemIds?.map((itemId) =>
            parseRequiredId(itemId, "cancelItemIds.orderItemId"),
          ) ?? [];

        tableId = parseNullableId(request.body.tableId);
        stayId = parseNullableId(request.body.stayId);
        stayGroupId = parseNullableId(request.body.stayGroupId);
      } catch (error) {
        return reply.badRequest((error as Error).message);
      }

      const orderItemMap = new Map(existingOrder.items.map((item) => [item.id.toString(), item]));

      for (const item of updateItems) {
        if (!orderItemMap.has(item.orderItemId.toString())) {
          return reply.badRequest(`orderItemId ${item.orderItemId.toString()} no pertenece al pedido.`);
        }

        const hasEditableFields = admin
          ? item.quantity !== undefined ||
            item.itemNotes !== undefined ||
            item.unitPrice !== undefined ||
            item.itemStatus !== undefined
          : item.quantity !== undefined || item.itemNotes !== undefined;

        if (!hasEditableFields) {
          return reply.badRequest(
            `updateItems para ${item.orderItemId.toString()} no incluye campos editables.`,
          );
        }
      }

      for (const itemId of cancelItemIds) {
        if (!orderItemMap.has(itemId.toString())) {
          return reply.badRequest(`orderItemId ${itemId.toString()} no pertenece al pedido.`);
        }
      }

      const cancelIdSet = new Set(cancelItemIds.map((id) => id.toString()));
      const hasOverlapUpdateAndCancel = updateItems.some((item) =>
        cancelIdSet.has(item.orderItemId.toString()),
      );
      if (hasOverlapUpdateAndCancel) {
        return reply.badRequest("No puedes actualizar y cancelar el mismo item en la misma peticion.");
      }

      const uniqueAddMenuItemIdStrings = [...new Set(addItems.map((item) => item.menuItemId.toString()))];
      const uniqueAddMenuItemIds = uniqueAddMenuItemIdStrings.map((id) => BigInt(id));

      const menuItemsForAdd = uniqueAddMenuItemIds.length
        ? await prisma.menuItem.findMany({
            where: {
              id: { in: uniqueAddMenuItemIds },
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              stationId: true,
              basePrice: true,
            },
          })
        : [];
      const menuItemMap = new Map(menuItemsForAdd.map((item) => [item.id.toString(), item]));

      const missingAddMenuItemIds = uniqueAddMenuItemIdStrings.filter((id) => !menuItemMap.has(id));
      if (missingAddMenuItemIds.length > 0) {
        return reply.badRequest(
          `No se encontraron menu_items activos para los IDs: ${missingAddMenuItemIds.join(", ")}`,
        );
      }

      const now = new Date();
      const orderData: Prisma.OrderUncheckedUpdateInput = {};
      const events: Prisma.OrderEventCreateManyInput[] = [];

      if (request.body.notes !== undefined) {
        orderData.notes = request.body.notes;
        events.push({
          orderId,
          eventType: OrderEventType.NOTE_UPDATED,
          oldValue: truncateForAudit(existingOrder.notes),
          newValue: truncateForAudit(request.body.notes),
          performedBy: authUser.id,
        });
      }

      if (request.body.serviceMode !== undefined) {
        orderData.serviceMode = request.body.serviceMode;
        if (request.body.serviceMode !== existingOrder.serviceMode) {
          events.push({
            orderId,
            eventType: OrderEventType.OTHER,
            oldValue: truncateForAudit(existingOrder.serviceMode),
            newValue: truncateForAudit(request.body.serviceMode),
            performedBy: authUser.id,
          });
        }
      }

      if (tableId !== undefined) {
        orderData.tableId = tableId;
      }

      if (stayId !== undefined) {
        orderData.stayId = stayId;
      }

      if (stayGroupId !== undefined) {
        orderData.stayGroupId = stayGroupId;
      }

      if (admin && request.body.cancelReason !== undefined) {
        orderData.cancelReason = request.body.cancelReason;
      }

      if (admin && request.body.status !== undefined && request.body.status !== existingOrder.status) {
        orderData.status = request.body.status;

        if (request.body.status === OrderStatus.CANCELLED) {
          orderData.cancelledAt = now;
          if (request.body.cancelReason === undefined) {
            orderData.cancelReason = existingOrder.cancelReason ?? "Sin motivo especificado";
          }
        }

        if (request.body.status === OrderStatus.CLOSED) {
          orderData.closedAt = now;
        }

        events.push({
          orderId,
          eventType: OrderEventType.STATUS_CHANGE,
          oldValue: truncateForAudit(existingOrder.status),
          newValue: truncateForAudit(request.body.status),
          performedBy: authUser.id,
        });
      }

      if (addItems.length > 0) {
        events.push({
          orderId,
          eventType: OrderEventType.ITEM_ADDED,
          oldValue: null,
          newValue: truncateForAudit(`${addItems.length} item(s) agregados`),
          performedBy: authUser.id,
        });
      }

      if (updateItems.length > 0) {
        events.push({
          orderId,
          eventType: OrderEventType.ITEM_UPDATED,
          oldValue: null,
          newValue: truncateForAudit(`${updateItems.length} item(s) actualizados`),
          performedBy: authUser.id,
        });
      }

      if (cancelItemIds.length > 0) {
        events.push({
          orderId,
          eventType: OrderEventType.ITEM_CANCELLED,
          oldValue: null,
          newValue: truncateForAudit(`${cancelItemIds.length} item(s) cancelados`),
          performedBy: authUser.id,
        });
      }

      const updatedOrder = await prisma.$transaction(async (tx) => {
        if (Object.keys(orderData).length > 0) {
          await tx.order.update({
            where: { id: orderId },
            data: orderData,
          });
        }

        if (addItems.length > 0) {
          await tx.orderItem.createMany({
            data: addItems.map((item) => {
              const menuItem = menuItemMap.get(item.menuItemId.toString())!;
              return {
                orderId,
                menuItemId: menuItem.id,
                itemName: menuItem.name,
                stationId: menuItem.stationId,
                unitPrice: menuItem.basePrice,
                quantity: item.quantity,
                itemNotes: item.itemNotes,
              };
            }),
          });
        }

        for (const item of updateItems) {
          const orderItemData: Prisma.OrderItemUncheckedUpdateInput = {
            updatedAt: now,
          };

          if (item.quantity !== undefined) {
            orderItemData.quantity = item.quantity;
          }

          if (item.itemNotes !== undefined) {
            orderItemData.itemNotes = item.itemNotes;
          }

          if (admin && item.unitPrice !== undefined) {
            orderItemData.unitPrice = item.unitPrice;
          }

          if (admin && item.itemStatus !== undefined) {
            orderItemData.itemStatus = item.itemStatus;

            if (item.itemStatus === OrderItemStatus.IN_PROGRESS) {
              orderItemData.startedAt = now;
            }

            if (item.itemStatus === OrderItemStatus.READY) {
              orderItemData.readyAt = now;
            }

            if (item.itemStatus === OrderItemStatus.DELIVERED) {
              orderItemData.deliveredAt = now;
            }
          }

          await tx.orderItem.update({
            where: { id: item.orderItemId },
            data: orderItemData,
          });
        }

        if (cancelItemIds.length > 0) {
          await tx.orderItem.updateMany({
            where: {
              id: { in: cancelItemIds },
              orderId,
            },
            data: {
              itemStatus: OrderItemStatus.CANCELLED,
              updatedAt: now,
            },
          });
        }

        if (events.length > 0) {
          await tx.orderEvent.createMany({
            data: events,
          });
        }

        return tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: {
            items: true,
          },
        });
      });

      emitOrderRealtime("orders:update", {
        id: updatedOrder.id.toString(),
        orderCode: updatedOrder.orderCode,
        status: updatedOrder.status,
      });

      return {
        waiterEditWindowMinutes: env.WAITER_EDIT_WINDOW_MINUTES,
        minutesSinceCreated,
        order: serializeOrder(updatedOrder),
      };
    },
  );
};
