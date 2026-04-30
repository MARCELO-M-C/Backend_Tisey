import type { FastifyPluginAsync } from "fastify";
import { authenticateRequest } from "../auth/service";
import {
  createStayController,
  getStayByIdController,
  listStaysController,
  replaceStayGuestsController,
  updateStayController,
  updateStayStatusController,
} from "./controller";

const digitStringSchema = {
  type: "string",
  pattern: "^[0-9]+$",
};

const positiveBodyIdSchema = {
  type: "integer",
  minimum: 1,
};

const dateOnlySchema = {
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
};

const stayStatusSchema = {
  type: "string",
  enum: ["BOOKED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"],
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

const guestSummaryResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "fullName", "idNumber", "originPlace"],
  properties: {
    id: { type: "string" },
    fullName: { type: "string" },
    idNumber: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    originPlace: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
  },
};

const cabinSummaryResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "cabinNumber",
    "name",
    "capacity",
    "basePricePerNight",
    "status",
    "isActive",
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
    status: { type: "string" },
    isActive: { type: "boolean" },
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

const stayResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "checkInDate",
    "checkOutDate",
    "status",
    "createdAt",
    "cabin",
    "primaryGuest",
    "guests",
    "createdByUser",
    "guestsCount",
    "ordersCount",
    "invoicesCount",
  ],
  properties: {
    id: { type: "string" },
    checkInDate: { type: "string" },
    checkOutDate: { type: "string" },
    status: stayStatusSchema,
    createdAt: { type: "string" },
    cabin: cabinSummaryResponseSchema,
    primaryGuest: guestSummaryResponseSchema,
    guests: {
      type: "array",
      items: guestSummaryResponseSchema,
    },
    createdByUser: {
      anyOf: [userSummaryResponseSchema, { type: "null" }],
    },
    guestsCount: { type: "integer" },
    ordersCount: { type: "integer" },
    invoicesCount: { type: "integer" },
  },
};

const stayParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["stayId"],
  properties: {
    stayId: digitStringSchema,
  },
};

const listStaysQuerystringSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    cabinId: digitStringSchema,
    primaryGuestId: digitStringSchema,
    status: stayStatusSchema,
    from: dateOnlySchema,
    to: dateOnlySchema,
  },
};

const createStayBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["cabinId", "primaryGuestId", "checkInDate", "checkOutDate"],
  properties: {
    cabinId: positiveBodyIdSchema,
    primaryGuestId: positiveBodyIdSchema,
    checkInDate: dateOnlySchema,
    checkOutDate: dateOnlySchema,
    status: stayStatusSchema,
    guestIds: {
      type: "array",
      items: positiveBodyIdSchema,
    },
  },
};

const updateStayBodySchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    cabinId: positiveBodyIdSchema,
    primaryGuestId: positiveBodyIdSchema,
    checkInDate: dateOnlySchema,
    checkOutDate: dateOnlySchema,
  },
};

const updateStayStatusBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["status"],
  properties: {
    status: stayStatusSchema,
    notes: {
      anyOf: [{ type: "string", minLength: 1, maxLength: 255 }, { type: "null" }],
    },
  },
};

const replaceStayGuestsBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["guestIds"],
  properties: {
    guestIds: {
      type: "array",
      items: positiveBodyIdSchema,
    },
  },
};

const staysRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Stays"],
        summary: "Listar estadías",
        security: [{ bearerAuth: [] }],
        querystring: listStaysQuerystringSchema,
        response: {
          200: {
            type: "array",
            items: stayResponseSchema,
          },
          401: basicErrorSchema,
        },
      },
    },
    listStaysController,
  );

  app.get(
    "/:stayId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Stays"],
        summary: "Obtener estadía por id",
        security: [{ bearerAuth: [] }],
        params: stayParamsSchema,
        response: {
          200: stayResponseSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    getStayByIdController,
  );

  app.post(
    "/",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Stays"],
        summary: "Crear estadía",
        security: [{ bearerAuth: [] }],
        body: createStayBodySchema,
        response: {
          201: stayResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    createStayController,
  );

  app.patch(
    "/:stayId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Stays"],
        summary: "Actualizar estadía",
        security: [{ bearerAuth: [] }],
        params: stayParamsSchema,
        body: updateStayBodySchema,
        response: {
          200: stayResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    updateStayController,
  );

  app.patch(
    "/:stayId/status",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Stays"],
        summary: "Actualizar estado de estadía",
        security: [{ bearerAuth: [] }],
        params: stayParamsSchema,
        body: updateStayStatusBodySchema,
        response: {
          200: stayResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    updateStayStatusController,
  );

  app.patch(
    "/:stayId/guests",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Stays"],
        summary: "Reemplazar huéspedes asociados a la estadía",
        security: [{ bearerAuth: [] }],
        params: stayParamsSchema,
        body: replaceStayGuestsBodySchema,
        response: {
          200: stayResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    replaceStayGuestsController,
  );
};

export default staysRoutes;