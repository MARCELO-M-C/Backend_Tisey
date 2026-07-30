import type { FastifyPluginAsync } from "fastify";
import {
  authenticateRequest,
  authorizePermissions,
} from "../auth/service";
import {
  createGuestController,
  getGuestByIdController,
  listGuestsController,
  updateGuestController,
} from "./controller";

const requireLodgingManage = authorizePermissions(["ADMIN_LODGING_MANAGE"]);
const digitStringSchema = { type: "string", pattern: "^[0-9]+$" };
const dateOnlySchema = {
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
};
const nullableDateOnlySchema = {
  anyOf: [dateOnlySchema, { type: "null" }],
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
const guestResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "fullName",
    "idNumber",
    "originPlace",
    "birthDate",
    "createdAt",
    "staysCount",
    "primaryStaysCount",
  ],
  properties: {
    id: { type: "string" },
    fullName: { type: "string" },
    idNumber: { anyOf: [{ type: "string" }, { type: "null" }] },
    originPlace: { anyOf: [{ type: "string" }, { type: "null" }] },
    birthDate: nullableDateOnlySchema,
    createdAt: { type: "string" },
    staysCount: { type: "integer" },
    primaryStaysCount: { type: "integer" },
  },
};
const guestParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["guestId"],
  properties: { guestId: digitStringSchema },
};
const listGuestsQuerystringSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    search: { type: "string", minLength: 1, maxLength: 120 },
    idNumber: { type: "string", minLength: 1, maxLength: 40 },
  },
};
const createGuestBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["fullName"],
  properties: {
    fullName: { type: "string", minLength: 1, maxLength: 160 },
    idNumber: {
      anyOf: [{ type: "string", minLength: 1, maxLength: 40 }, { type: "null" }],
    },
    originPlace: {
      anyOf: [
        { type: "string", minLength: 1, maxLength: 120 },
        { type: "null" },
      ],
    },
    birthDate: nullableDateOnlySchema,
  },
};
const updateGuestBodySchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    fullName: { type: "string", minLength: 1, maxLength: 160 },
    idNumber: {
      anyOf: [{ type: "string", minLength: 1, maxLength: 40 }, { type: "null" }],
    },
    originPlace: {
      anyOf: [
        { type: "string", minLength: 1, maxLength: 120 },
        { type: "null" },
      ],
    },
    birthDate: nullableDateOnlySchema,
  },
};

const guestsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Guests"],
        summary: "Listar huéspedes",
        security: [{ bearerAuth: [] }],
        querystring: listGuestsQuerystringSchema,
        response: {
          200: { type: "array", items: guestResponseSchema },
          401: basicErrorSchema,
        },
      },
    },
    listGuestsController,
  );

  app.get(
    "/:guestId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Guests"],
        summary: "Obtener huésped por id",
        security: [{ bearerAuth: [] }],
        params: guestParamsSchema,
        response: {
          200: guestResponseSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    getGuestByIdController,
  );

  app.post(
    "/",
    {
      onRequest: [requireLodgingManage],
      schema: {
        tags: ["Guests"],
        summary: "Crear huésped",
        security: [{ bearerAuth: [] }],
        body: createGuestBodySchema,
        response: {
          201: guestResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          403: basicErrorSchema,
        },
      },
    },
    createGuestController,
  );

  app.patch(
    "/:guestId",
    {
      onRequest: [requireLodgingManage],
      schema: {
        tags: ["Guests"],
        summary: "Actualizar huésped",
        security: [{ bearerAuth: [] }],
        params: guestParamsSchema,
        body: updateGuestBodySchema,
        response: {
          200: guestResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          403: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    updateGuestController,
  );
};

export default guestsRoutes;
