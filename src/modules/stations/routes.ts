import type { FastifyPluginAsync } from "fastify";
import { authenticateRequest } from "../auth/service";
import {
  createStationController,
  getStationByIdController,
  listStationsController,
  updateStationController,
  updateStationStatusController,
} from "./controller";

const digitStringSchema = {
  type: "string",
  pattern: "^[0-9]+$",
};

const stationResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "code",
    "name",
    "isActive",
    "menuItemsCount",
    "orderItemsCount",
  ],
  properties: {
    id: { type: "string" },
    code: { type: "string" },
    name: { type: "string" },
    isActive: { type: "boolean" },
    menuItemsCount: { type: "integer" },
    orderItemsCount: { type: "integer" },
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

const stationParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["stationId"],
  properties: {
    stationId: digitStringSchema,
  },
};

const listStationsQuerystringSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    search: { type: "string", minLength: 1, maxLength: 80 },
    isActive: { type: "string", enum: ["true", "false"] },
  },
};

const createStationBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "name"],
  properties: {
    code: {
      type: "string",
      minLength: 1,
      maxLength: 30,
      pattern: "^[A-Za-z0-9_]+$",
    },
    name: { type: "string", minLength: 1, maxLength: 80 },
    isActive: { type: "boolean" },
  },
};

const updateStationBodySchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    code: {
      type: "string",
      minLength: 1,
      maxLength: 30,
      pattern: "^[A-Za-z0-9_]+$",
    },
    name: { type: "string", minLength: 1, maxLength: 80 },
  },
};

const updateStationStatusBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["isActive"],
  properties: {
    isActive: { type: "boolean" },
  },
};

const stationsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Stations"],
        summary: "Listar estaciones",
        security: [{ bearerAuth: [] }],
        querystring: listStationsQuerystringSchema,
        response: {
          200: {
            type: "array",
            items: stationResponseSchema,
          },
          401: basicErrorSchema,
        },
      },
    },
    listStationsController,
  );

  app.get(
    "/:stationId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Stations"],
        summary: "Obtener estación por id",
        security: [{ bearerAuth: [] }],
        params: stationParamsSchema,
        response: {
          200: stationResponseSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    getStationByIdController,
  );

  app.post(
    "/",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Stations"],
        summary: "Crear estación",
        security: [{ bearerAuth: [] }],
        body: createStationBodySchema,
        response: {
          201: stationResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    createStationController,
  );

  app.patch(
    "/:stationId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Stations"],
        summary: "Actualizar estación",
        security: [{ bearerAuth: [] }],
        params: stationParamsSchema,
        body: updateStationBodySchema,
        response: {
          200: stationResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    updateStationController,
  );

  app.patch(
    "/:stationId/status",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Stations"],
        summary: "Activar o desactivar estación",
        security: [{ bearerAuth: [] }],
        params: stationParamsSchema,
        body: updateStationStatusBodySchema,
        response: {
          200: stationResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    updateStationStatusController,
  );
};

export default stationsRoutes;