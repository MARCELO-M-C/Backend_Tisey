import type { FastifyPluginAsync } from "fastify";
import {
  authenticateRequest,
  authorizePermissions,
} from "../auth/service";
import {
  createStayController,
  getStayByIdController,
  listStaysController,
  replaceStayGuestsController,
  updateStayController,
  updateStayStatusController,
} from "./controller";

const requireLodgingManage = authorizePermissions(["ADMIN_LODGING_MANAGE"]);

const digitStringSchema = {
  type: "string",
  pattern: "^[0-9]+$",
};
const positiveBodyIdSchema = { type: "integer", minimum: 1 };
const dateOnlySchema = {
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
};
const nullableDateOnlySchema = {
  anyOf: [dateOnlySchema, { type: "null" }],
};
const stayStatusSchema = {
  type: "string",
  enum: ["BOOKED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"],
};
const initialStayStatusSchema = {
  type: "string",
  enum: ["BOOKED", "CHECKED_IN"],
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
  required: ["id", "fullName", "idNumber", "originPlace", "birthDate"],
  properties: {
    id: { type: "string" },
    fullName: { type: "string" },
    idNumber: { anyOf: [{ type: "string" }, { type: "null" }] },
    originPlace: { anyOf: [{ type: "string" }, { type: "null" }] },
    birthDate: nullableDateOnlySchema,
  },
};

const stayGuestResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "fullName",
    "idNumber",
    "originPlace",
    "birthDate",
    "ageAtCheckIn",
    "isChargeable",
  ],
  properties: {
    ...guestSummaryResponseSchema.properties,
    ageAtCheckIn: {
      anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }],
    },
    isChargeable: { type: "boolean" },
  },
};

const cabinSummaryResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "cabinNumber", "name", "capacity", "status", "isActive"],
  properties: {
    id: { type: "string" },
    cabinNumber: { type: "integer" },
    name: { anyOf: [{ type: "string" }, { type: "null" }] },
    capacity: { type: "integer" },
    status: { type: "string" },
    isActive: { type: "boolean" },
  },
};

const lodgingRateSummaryResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "amountPerPersonPerNight",
    "minimumChargeableAge",
    "effectiveFrom",
  ],
  properties: {
    id: { type: "string" },
    amountPerPersonPerNight: { type: "string" },
    minimumChargeableAge: { type: "integer" },
    effectiveFrom: dateOnlySchema,
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
    "lodgingRateId",
    "checkInDate",
    "checkOutDate",
    "ratePerPersonPerNight",
    "minimumChargeableAge",
    "status",
    "createdAt",
    "cabin",
    "lodgingRate",
    "primaryGuest",
    "guests",
    "createdByUser",
    "nightsCount",
    "guestsCount",
    "chargeableGuestsCount",
    "personNightsCount",
    "estimatedRoomTotal",
    "ordersCount",
    "invoicesCount",
  ],
  properties: {
    id: { type: "string" },
    lodgingRateId: { type: "string" },
    checkInDate: dateOnlySchema,
    checkOutDate: dateOnlySchema,
    ratePerPersonPerNight: { type: "string" },
    minimumChargeableAge: { type: "integer" },
    status: stayStatusSchema,
    createdAt: { type: "string" },
    cabin: cabinSummaryResponseSchema,
    lodgingRate: lodgingRateSummaryResponseSchema,
    primaryGuest: guestSummaryResponseSchema,
    guests: { type: "array", items: stayGuestResponseSchema },
    createdByUser: {
      anyOf: [userSummaryResponseSchema, { type: "null" }],
    },
    nightsCount: { type: "integer", minimum: 1 },
    guestsCount: { type: "integer", minimum: 1 },
    chargeableGuestsCount: { type: "integer", minimum: 0 },
    personNightsCount: { type: "integer", minimum: 0 },
    estimatedRoomTotal: { type: "string" },
    ordersCount: { type: "integer", minimum: 0 },
    invoicesCount: { type: "integer", minimum: 0 },
  },
};

const stayParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["stayId"],
  properties: { stayId: digitStringSchema },
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
    status: initialStayStatusSchema,
    guestIds: { type: "array", items: positiveBodyIdSchema },
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
    guestIds: { type: "array", items: positiveBodyIdSchema },
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
          200: { type: "array", items: stayResponseSchema },
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
      onRequest: [requireLodgingManage],
      schema: {
        tags: ["Stays"],
        summary: "Crear estadía con tarifa y cobro por huésped",
        security: [{ bearerAuth: [] }],
        body: createStayBodySchema,
        response: {
          201: stayResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          403: basicErrorSchema,
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
      onRequest: [requireLodgingManage],
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
          403: basicErrorSchema,
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
      onRequest: [requireLodgingManage],
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
          403: basicErrorSchema,
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
      onRequest: [requireLodgingManage],
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
          403: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    replaceStayGuestsController,
  );
};

export default staysRoutes;
