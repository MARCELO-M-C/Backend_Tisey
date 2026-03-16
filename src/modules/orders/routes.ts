import type { FastifyPluginAsync } from "fastify";
import { authenticateRequest } from "../auth/service";
import {
  addItemsToOrderController,
  cancelOrderController,
  createOrderController,
  getOrderByIdController,
  listOrdersController,
  sendOrderController,
  updateOrderController,
  updateOrderItemStatusController,
} from "./controller";

const digitStringSchema = {
  type: "string",
  pattern: "^[0-9]+$",
};

const positiveBodyIdSchema = {
  type: "integer",
  minimum: 1,
};

const nullableBodyIdSchema = {
  anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }],
};

const userSummarySchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "username", "firstName", "lastName", "fullName"],
  properties: {
    id: { type: "string" },
    username: { type: "string" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    fullName: { type: "string" },
  },
};

const tableSchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "code", "name", "capacity", "isActive"],
      properties: {
        id: { type: "string" },
        code: { type: "string" },
        name: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        capacity: {
          anyOf: [{ type: "integer" }, { type: "null" }],
        },
        isActive: { type: "boolean" },
      },
    },
    { type: "null" },
  ],
};

const staySchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: [
        "id",
        "status",
        "checkInDate",
        "checkOutDate",
        "cabin",
        "primaryGuest",
      ],
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        checkInDate: { type: "string" },
        checkOutDate: { type: "string" },
        cabin: {
          type: "object",
          additionalProperties: false,
          required: ["id", "cabinNumber", "name"],
          properties: {
            id: { type: "string" },
            cabinNumber: { type: "integer" },
            name: {
              anyOf: [{ type: "string" }, { type: "null" }],
            },
          },
        },
        primaryGuest: {
          type: "object",
          additionalProperties: false,
          required: ["id", "fullName"],
          properties: {
            id: { type: "string" },
            fullName: { type: "string" },
          },
        },
      },
    },
    { type: "null" },
  ],
};

const shiftSchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "startedAt", "endedAt", "user"],
      properties: {
        id: { type: "string" },
        startedAt: { type: "string" },
        endedAt: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        user: userSummarySchema,
      },
    },
    { type: "null" },
  ],
};

const orderItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "menuItemId",
    "itemName",
    "station",
    "menuItem",
    "unitPrice",
    "quantity",
    "lineTotal",
    "itemNotes",
    "itemStatus",
    "createdAt",
    "updatedAt",
    "startedAt",
    "readyAt",
    "deliveredAt",
    "preparedBy",
    "deliveredBy",
  ],
  properties: {
    id: { type: "string" },
    menuItemId: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    itemName: { type: "string" },
    station: {
      type: "object",
      additionalProperties: false,
      required: ["id", "code", "name", "isActive"],
      properties: {
        id: { type: "string" },
        code: { type: "string" },
        name: { type: "string" },
        isActive: { type: "boolean" },
      },
    },
    menuItem: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["id", "name", "isActive"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            isActive: { type: "boolean" },
          },
        },
        { type: "null" },
      ],
    },
    unitPrice: { type: "string" },
    quantity: { type: "integer" },
    lineTotal: { type: "string" },
    itemNotes: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    itemStatus: { type: "string" },
    createdAt: { type: "string" },
    updatedAt: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    startedAt: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    readyAt: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    deliveredAt: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    preparedBy: {
      anyOf: [userSummarySchema, { type: "null" }],
    },
    deliveredBy: {
      anyOf: [userSummarySchema, { type: "null" }],
    },
  },
};

const orderEventSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "eventType",
    "oldValue",
    "newValue",
    "performedAt",
    "performedBy",
  ],
  properties: {
    id: { type: "string" },
    eventType: { type: "string" },
    oldValue: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    newValue: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    performedAt: { type: "string" },
    performedBy: userSummarySchema,
  },
};

const orderResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "orderCode",
    "channel",
    "serviceMode",
    "status",
    "notes",
    "createdAt",
    "sentAt",
    "closedAt",
    "cancelledAt",
    "cancelReason",
    "createdBy",
    "waiter",
    "shift",
    "table",
    "stay",
    "summary",
    "items",
    "events",
  ],
  properties: {
    id: { type: "string" },
    orderCode: { type: "string" },
    channel: {
      type: "string",
      enum: ["DINE_IN", "TAKE_AWAY", "ROOM_CHARGE"],
    },
    serviceMode: {
      type: "string",
      enum: ["EAT_HERE", "TO_GO"],
    },
    status: {
      type: "string",
      enum: [
        "DRAFT",
        "SENT",
        "IN_PROGRESS",
        "READY",
        "DELIVERED",
        "CLOSED",
        "CANCELLED",
      ],
    },
    notes: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    createdAt: { type: "string" },
    sentAt: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    closedAt: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    cancelledAt: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    cancelReason: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    createdBy: userSummarySchema,
    waiter: {
      anyOf: [userSummarySchema, { type: "null" }],
    },
    shift: shiftSchema,
    table: tableSchema,
    stay: staySchema,
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["linesCount", "activeLinesCount", "totalQuantity", "subtotal"],
      properties: {
        linesCount: { type: "integer" },
        activeLinesCount: { type: "integer" },
        totalQuantity: { type: "integer" },
        subtotal: { type: "string" },
      },
    },
    items: {
      type: "array",
      items: orderItemSchema,
    },
    events: {
      type: "array",
      items: orderEventSchema,
    },
  },
};

const basicErrorSchema = {
  type: "object",
  additionalProperties: true,
  required: ["message"],
  properties: {
    message: { type: "string" },
    code: { type: "string" },
  },
};

const orderIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: {
    id: digitStringSchema,
  },
};

const orderItemParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "itemId"],
  properties: {
    id: digitStringSchema,
    itemId: digitStringSchema,
  },
};

const listOrdersQuerystringSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    search: {
      type: "string",
      minLength: 1,
      maxLength: 30,
    },
    status: {
      type: "string",
      enum: [
        "DRAFT",
        "SENT",
        "IN_PROGRESS",
        "READY",
        "DELIVERED",
        "CLOSED",
        "CANCELLED",
      ],
    },
    channel: {
      type: "string",
      enum: ["DINE_IN", "TAKE_AWAY", "ROOM_CHARGE"],
    },
    waiterId: digitStringSchema,
    tableId: digitStringSchema,
    stayId: digitStringSchema,
    createdBy: digitStringSchema,
    shiftId: digitStringSchema,
  },
};

const orderItemInputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["menuItemId", "quantity"],
  properties: {
    menuItemId: positiveBodyIdSchema,
    quantity: {
      type: "integer",
      minimum: 1,
      maximum: 999,
    },
    itemNotes: {
      type: "string",
      maxLength: 255,
    },
  },
};

const createOrderBodySchema = {
  type: "object",
  additionalProperties: false,
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
    tableId: positiveBodyIdSchema,
    stayId: positiveBodyIdSchema,
    waiterId: positiveBodyIdSchema,
    shiftId: positiveBodyIdSchema,
    notes: {
      type: "string",
      maxLength: 500,
    },
    items: {
      type: "array",
      minItems: 1,
      items: orderItemInputSchema,
    },
  },
};

const updateOrderBodySchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    channel: {
      type: "string",
      enum: ["DINE_IN", "TAKE_AWAY", "ROOM_CHARGE"],
    },
    serviceMode: {
      type: "string",
      enum: ["EAT_HERE", "TO_GO"],
    },
    tableId: nullableBodyIdSchema,
    stayId: nullableBodyIdSchema,
    waiterId: nullableBodyIdSchema,
    shiftId: nullableBodyIdSchema,
    notes: {
      anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }],
    },
  },
};

const addOrderItemsBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      minItems: 1,
      items: orderItemInputSchema,
    },
  },
};

const cancelOrderBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["reason"],
  properties: {
    reason: {
      type: "string",
      minLength: 1,
      maxLength: 255,
    },
  },
};

const updateOrderItemStatusBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["status"],
  properties: {
    status: {
      type: "string",
      enum: ["PENDING", "IN_PROGRESS", "READY", "DELIVERED", "CANCELLED"],
    },
  },
};

const ordersRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Orders"],
        summary: "Listar órdenes",
        security: [{ bearerAuth: [] }],
        querystring: listOrdersQuerystringSchema,
        response: {
          200: {
            type: "array",
            items: orderResponseSchema,
          },
          401: basicErrorSchema,
        },
      },
    },
    listOrdersController,
  );

  app.get(
    "/:id",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Orders"],
        summary: "Obtener orden por id",
        security: [{ bearerAuth: [] }],
        params: orderIdParamsSchema,
        response: {
          200: orderResponseSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    getOrderByIdController,
  );

  app.post(
    "/",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Orders"],
        summary: "Crear orden",
        security: [{ bearerAuth: [] }],
        body: createOrderBodySchema,
        response: {
          201: orderResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          403: basicErrorSchema,
        },
      },
    },
    createOrderController,
  );

  app.patch(
    "/:id",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Orders"],
        summary: "Actualizar cabecera de una orden DRAFT",
        security: [{ bearerAuth: [] }],
        params: orderIdParamsSchema,
        body: updateOrderBodySchema,
        response: {
          200: orderResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    updateOrderController,
  );

  app.post(
    "/:id/items",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Orders"],
        summary: "Agregar ítems a una orden DRAFT",
        security: [{ bearerAuth: [] }],
        params: orderIdParamsSchema,
        body: addOrderItemsBodySchema,
        response: {
          200: orderResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    addItemsToOrderController,
  );

  app.post(
    "/:id/send",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Orders"],
        summary: "Enviar orden a cocina",
        security: [{ bearerAuth: [] }],
        params: orderIdParamsSchema,
        response: {
          200: orderResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    sendOrderController,
  );

  app.post(
    "/:id/cancel",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Orders"],
        summary: "Cancelar orden",
        security: [{ bearerAuth: [] }],
        params: orderIdParamsSchema,
        body: cancelOrderBodySchema,
        response: {
          200: orderResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    cancelOrderController,
  );

  app.patch(
    "/:id/items/:itemId/status",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Orders"],
        summary: "Actualizar estado de un ítem",
        security: [{ bearerAuth: [] }],
        params: orderItemParamsSchema,
        body: updateOrderItemStatusBodySchema,
        response: {
          200: orderResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    updateOrderItemStatusController,
  );
};

export default ordersRoutes;