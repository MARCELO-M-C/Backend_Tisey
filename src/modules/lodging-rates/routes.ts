import type { FastifyPluginAsync } from "fastify";
import { authorizePermissions } from "../auth/service";
import {
  createLodgingRateController,
  getCurrentLodgingRateController,
  listLodgingRatesController,
} from "./controller";

const requireLodgingManage = authorizePermissions(["ADMIN_LODGING_MANAGE"]);

const dateOnlySchema = {
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
};

const moneySchema = {
  anyOf: [
    { type: "number", exclusiveMinimum: 0 },
    { type: "string", pattern: "^\\d+(\\.\\d{1,2})?$" },
  ],
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

const lodgingRateResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "amountPerPersonPerNight",
    "minimumChargeableAge",
    "effectiveFrom",
    "createdAt",
  ],
  properties: {
    id: { type: "string" },
    amountPerPersonPerNight: { type: "string" },
    minimumChargeableAge: { type: "integer" },
    effectiveFrom: dateOnlySchema,
    createdAt: { type: "string" },
  },
};

const lodgingRatesRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      onRequest: [requireLodgingManage],
      schema: {
        tags: ["Lodging-Rates"],
        summary: "Listar historial de tarifas de hospedaje",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            effectiveFrom: dateOnlySchema,
            effectiveTo: dateOnlySchema,
          },
        },
        response: {
          200: { type: "array", items: lodgingRateResponseSchema },
          401: basicErrorSchema,
          403: basicErrorSchema,
        },
      },
    },
    listLodgingRatesController,
  );

  app.get(
    "/current",
    {
      onRequest: [requireLodgingManage],
      schema: {
        tags: ["Lodging-Rates"],
        summary: "Obtener tarifa aplicable para una fecha",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: { date: dateOnlySchema },
        },
        response: {
          200: lodgingRateResponseSchema,
          401: basicErrorSchema,
          403: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    getCurrentLodgingRateController,
  );

  app.post(
    "/",
    {
      onRequest: [requireLodgingManage],
      schema: {
        tags: ["Lodging-Rates"],
        summary: "Registrar una nueva tarifa de hospedaje",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["amountPerPersonPerNight", "effectiveFrom"],
          properties: {
            amountPerPersonPerNight: moneySchema,
            minimumChargeableAge: {
              type: "integer",
              minimum: 0,
              maximum: 120,
            },
            effectiveFrom: dateOnlySchema,
          },
        },
        response: {
          201: lodgingRateResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          403: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    createLodgingRateController,
  );
};

export default lodgingRatesRoutes;
