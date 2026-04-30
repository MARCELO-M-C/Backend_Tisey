import type { FastifyPluginAsync } from "fastify";
import { authenticateRequest } from "../auth/service";
import {
  createInvoiceFromOrderController,
  createInvoiceFromStayController,
  createPaymentController,
  getInvoiceByIdController,
  listInvoicePaymentsController,
  listInvoicesController,
  printInvoiceController,
  voidInvoiceController,
} from "./controller";

const digitStringSchema = {
  type: "string",
  pattern: "^[0-9]+$",
};

const positiveBodyIdSchema = {
  type: "integer",
  minimum: 1,
};

const moneySchema = {
  anyOf: [
    { type: "number", exclusiveMinimum: 0 },
    { type: "string", pattern: "^\\d+(\\.\\d{1,2})?$" },
  ],
};

const taxRateSchema = {
  anyOf: [
    { type: "number", minimum: 0, maximum: 100 },
    { type: "string", pattern: "^\\d+(\\.\\d{1,2})?$" },
  ],
};

const invoiceStatusSchema = {
  type: "string",
  enum: ["ISSUED", "VOID"],
};

const paymentMethodSchema = {
  type: "string",
  enum: ["CASH", "CARD", "TRANSFER", "MIXED", "OTHER"],
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

const userSummaryResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "username", "firstName", "lastName", "fullName", "isActive"],
  properties: {
    id: { type: "string" },
    username: { type: "string" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    fullName: { type: "string" },
    isActive: { type: "boolean" },
  },
};

const invoiceLineResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "source",
    "description",
    "quantity",
    "unitPrice",
    "lineTotal",
    "orderItemId",
    "createdAt",
  ],
  properties: {
    id: { type: "string" },
    source: { type: "string" },
    description: { type: "string" },
    quantity: { type: "integer" },
    unitPrice: { type: "string" },
    lineTotal: { type: "string" },
    orderItemId: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    createdAt: { type: "string" },
  },
};

const paymentResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "invoiceId",
    "method",
    "amount",
    "reference",
    "paidAt",
    "receivedByUser",
  ],
  properties: {
    id: { type: "string" },
    invoiceId: { type: "string" },
    method: paymentMethodSchema,
    amount: { type: "string" },
    reference: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    paidAt: { type: "string" },
    receivedByUser: userSummaryResponseSchema,
  },
};

const invoiceResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "invoiceCode",
    "status",
    "issuedAt",
    "subtotal",
    "tax",
    "total",
    "amountPaid",
    "balanceDue",
    "isPaid",
    "notes",
    "printedAt",
    "printCount",
    "issuedByUser",
    "printedByUser",
    "order",
    "stay",
    "lines",
    "payments",
  ],
  properties: {
    id: { type: "string" },
    invoiceCode: { type: "string" },
    status: invoiceStatusSchema,
    issuedAt: { type: "string" },
    subtotal: { type: "string" },
    tax: { type: "string" },
    total: { type: "string" },
    amountPaid: { type: "string" },
    balanceDue: { type: "string" },
    isPaid: { type: "boolean" },
    notes: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    printedAt: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    printCount: { type: "integer" },
    issuedByUser: userSummaryResponseSchema,
    printedByUser: {
      anyOf: [userSummaryResponseSchema, { type: "null" }],
    },
    order: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "orderCode",
            "channel",
            "serviceMode",
            "status",
            "createdAt",
          ],
          properties: {
            id: { type: "string" },
            orderCode: { type: "string" },
            channel: { type: "string" },
            serviceMode: { type: "string" },
            status: { type: "string" },
            createdAt: { type: "string" },
          },
        },
        { type: "null" },
      ],
    },
    stay: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "checkInDate",
            "checkOutDate",
            "status",
            "cabin",
            "primaryGuest",
          ],
          properties: {
            id: { type: "string" },
            checkInDate: { type: "string" },
            checkOutDate: { type: "string" },
            status: { type: "string" },
            cabin: {
              type: "object",
              additionalProperties: false,
              required: [
                "id",
                "cabinNumber",
                "name",
                "capacity",
                "basePricePerNight",
              ],
              properties: {
                id: { type: "string" },
                cabinNumber: { type: "integer" },
                name: {
                  anyOf: [{ type: "string" }, { type: "null" }],
                },
                capacity: { type: "integer" },
                basePricePerNight: {
                  anyOf: [{ type: "string" }, { type: "null" }],
                },
              },
            },
            primaryGuest: {
              type: "object",
              additionalProperties: false,
              required: ["id", "fullName", "idNumber"],
              properties: {
                id: { type: "string" },
                fullName: { type: "string" },
                idNumber: {
                  anyOf: [{ type: "string" }, { type: "null" }],
                },
              },
            },
          },
        },
        { type: "null" },
      ],
    },
    lines: {
      type: "array",
      items: invoiceLineResponseSchema,
    },
    payments: {
      type: "array",
      items: paymentResponseSchema,
    },
  },
};

const invoiceParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["invoiceId"],
  properties: {
    invoiceId: digitStringSchema,
  },
};

const listInvoicesQuerystringSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: invoiceStatusSchema,
    orderId: digitStringSchema,
    stayId: digitStringSchema,
    from: { type: "string" },
    to: { type: "string" },
  },
};

const extraLineBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["description", "quantity", "unitPrice"],
  properties: {
    description: { type: "string", minLength: 1, maxLength: 160 },
    quantity: { type: "integer", minimum: 1, maximum: 999 },
    unitPrice: moneySchema,
  },
};

const createInvoiceFromOrderBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["orderId"],
  properties: {
    orderId: positiveBodyIdSchema,
    taxRate: taxRateSchema,
    notes: {
      anyOf: [{ type: "string", minLength: 1, maxLength: 255 }, { type: "null" }],
    },
    extraLines: {
      type: "array",
      items: extraLineBodySchema,
    },
  },
};

const createInvoiceFromStayBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["stayId"],
  properties: {
    stayId: positiveBodyIdSchema,
    includeRoomCharge: { type: "boolean" },
    includeRestaurantCharges: { type: "boolean" },
    taxRate: taxRateSchema,
    notes: {
      anyOf: [{ type: "string", minLength: 1, maxLength: 255 }, { type: "null" }],
    },
    extraLines: {
      type: "array",
      items: extraLineBodySchema,
    },
  },
};

const voidInvoiceBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reason: { type: "string", minLength: 1, maxLength: 255 },
  },
};

const printInvoiceBodySchema = {
  type: "object",
  additionalProperties: false,
};

const createPaymentBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["method", "amount"],
  properties: {
    method: paymentMethodSchema,
    amount: moneySchema,
    reference: {
      anyOf: [{ type: "string", minLength: 1, maxLength: 80 }, { type: "null" }],
    },
    paidAt: { type: "string" },
  },
};

const invoicesRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Invoices"],
        summary: "Listar facturas",
        security: [{ bearerAuth: [] }],
        querystring: listInvoicesQuerystringSchema,
        response: {
          200: {
            type: "array",
            items: invoiceResponseSchema,
          },
          401: basicErrorSchema,
        },
      },
    },
    listInvoicesController,
  );

  app.get(
    "/:invoiceId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Invoices"],
        summary: "Obtener factura por id",
        security: [{ bearerAuth: [] }],
        params: invoiceParamsSchema,
        response: {
          200: invoiceResponseSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    getInvoiceByIdController,
  );

  app.post(
    "/from-order",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Invoices"],
        summary: "Emitir factura desde una orden",
        security: [{ bearerAuth: [] }],
        body: createInvoiceFromOrderBodySchema,
        response: {
          201: invoiceResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    createInvoiceFromOrderController,
  );

  app.post(
    "/from-stay",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Invoices"],
        summary: "Emitir factura desde una estadía",
        security: [{ bearerAuth: [] }],
        body: createInvoiceFromStayBodySchema,
        response: {
          201: invoiceResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    createInvoiceFromStayController,
  );

  app.patch(
    "/:invoiceId/void",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Invoices"],
        summary: "Anular factura",
        security: [{ bearerAuth: [] }],
        params: invoiceParamsSchema,
        body: voidInvoiceBodySchema,
        response: {
          200: invoiceResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    voidInvoiceController,
  );

  app.patch(
    "/:invoiceId/print",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Invoices"],
        summary: "Registrar impresión de factura",
        security: [{ bearerAuth: [] }],
        params: invoiceParamsSchema,
        body: printInvoiceBodySchema,
        response: {
          200: invoiceResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    printInvoiceController,
  );

  app.get(
    "/:invoiceId/payments",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Invoices"],
        summary: "Listar pagos de una factura",
        security: [{ bearerAuth: [] }],
        params: invoiceParamsSchema,
        response: {
          200: {
            type: "array",
            items: paymentResponseSchema,
          },
          401: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    listInvoicePaymentsController,
  );

  app.post(
    "/:invoiceId/payments",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Invoices"],
        summary: "Registrar pago de factura",
        security: [{ bearerAuth: [] }],
        params: invoiceParamsSchema,
        body: createPaymentBodySchema,
        response: {
          201: invoiceResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    createPaymentController,
  );
};

export default invoicesRoutes;