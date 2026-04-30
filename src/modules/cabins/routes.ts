import type { FastifyPluginAsync } from "fastify";
import { authenticateRequest } from "../auth/service";
import {
  createCabinController,
  getCabinByIdController,
  listCabinsController,
  updateCabinActiveStatusController,
  updateCabinController,
  updateCabinStatusController,
} from "./controller";

const digitStringSchema = {
  type: "string",
  pattern: "^[0-9]+$",
};

const cabinStatusSchema = {
  type: "string",
  enum: ["AVAILABLE", "OCCUPIED", "MAINTENANCE"],
};

const moneySchema = {
  anyOf: [
    { type: "number", exclusiveMinimum: 0 },
    { type: "string", pattern: "^\\d+(\\.\\d{1,2})?$" },
  ],
};

const nullableMoneySchema = {
  anyOf: [
    { type: "number", exclusiveMinimum: 0 },
    { type: "string", pattern: "^\\d+(\\.\\d{1,2})?$" },
    { type: "null" },
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

const cabinResponseSchema = {
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
    "staysCount",
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
    status: cabinStatusSchema,
    isActive: { type: "boolean" },
    staysCount: { type: "integer" },
  },
};

const cabinParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["cabinId"],
  properties: {
    cabinId: digitStringSchema,
  },
};

const listCabinsQuerystringSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    search: { type: "string", minLength: 1, maxLength: 80 },
    status: cabinStatusSchema,
    isActive: { type: "string", enum: ["true", "false"] },
    minCapacity: digitStringSchema,
  },
};

const createCabinBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["cabinNumber", "capacity"],
  properties: {
    cabinNumber: { type: "integer", minimum: 1, maximum: 9999 },
    name: {
      anyOf: [{ type: "string", minLength: 1, maxLength: 80 }, { type: "null" }],
    },
    capacity: { type: "integer", minimum: 1, maximum: 100 },
    basePricePerNight: nullableMoneySchema,
    status: cabinStatusSchema,
    isActive: { type: "boolean" },
  },
};

const updateCabinBodySchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    cabinNumber: { type: "integer", minimum: 1, maximum: 9999 },
    name: {
      anyOf: [{ type: "string", minLength: 1, maxLength: 80 }, { type: "null" }],
    },
    capacity: { type: "integer", minimum: 1, maximum: 100 },
    basePricePerNight: nullableMoneySchema,
  },
};

const updateCabinStatusBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["status"],
  properties: {
    status: cabinStatusSchema,
  },
};

const updateCabinActiveBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["isActive"],
  properties: {
    isActive: { type: "boolean" },
  },
};

const cabinsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Cabins"],
        summary: "Listar cabañas",
        security: [{ bearerAuth: [] }],
        querystring: listCabinsQuerystringSchema,
        response: {
          200: {
            type: "array",
            items: cabinResponseSchema,
          },
          401: basicErrorSchema,
        },
      },
    },
    listCabinsController,
  );

  app.get(
    "/:cabinId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Cabins"],
        summary: "Obtener cabaña por id",
        security: [{ bearerAuth: [] }],
        params: cabinParamsSchema,
        response: {
          200: cabinResponseSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    getCabinByIdController,
  );

  app.post(
    "/",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Cabins"],
        summary: "Crear cabaña",
        security: [{ bearerAuth: [] }],
        body: createCabinBodySchema,
        response: {
          201: cabinResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    createCabinController,
  );

  app.patch(
    "/:cabinId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Cabins"],
        summary: "Actualizar cabaña",
        security: [{ bearerAuth: [] }],
        params: cabinParamsSchema,
        body: updateCabinBodySchema,
        response: {
          200: cabinResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    updateCabinController,
  );

  app.patch(
    "/:cabinId/status",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Cabins"],
        summary: "Actualizar estado operativo de la cabaña",
        security: [{ bearerAuth: [] }],
        params: cabinParamsSchema,
        body: updateCabinStatusBodySchema,
        response: {
          200: cabinResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    updateCabinStatusController,
  );

  app.patch(
    "/:cabinId/active",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Cabins"],
        summary: "Activar o desactivar cabaña",
        security: [{ bearerAuth: [] }],
        params: cabinParamsSchema,
        body: updateCabinActiveBodySchema,
        response: {
          200: cabinResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    updateCabinActiveStatusController,
  );
};

export default cabinsRoutes;