import type { FastifyPluginAsync } from "fastify";
import { authenticateRequest } from "../auth/service";
import {
  createRestaurantTableController,
  getRestaurantTableByIdController,
  listRestaurantTablesController,
  updateRestaurantTableController,
  updateRestaurantTableStatusController,
} from "./controller";

const digitStringSchema = {
  type: "string",
  pattern: "^[0-9]+$",
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

const restaurantTableResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "code", "name", "capacity", "isActive", "ordersCount"],
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
    ordersCount: { type: "integer" },
  },
};

const restaurantTableParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tableId"],
  properties: {
    tableId: digitStringSchema,
  },
};

const listRestaurantTablesQuerystringSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    search: {
      type: "string",
      minLength: 1,
      maxLength: 80,
    },
    isActive: {
      type: "string",
      enum: ["true", "false"],
    },
  },
};

const createRestaurantTableBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["code"],
  properties: {
    code: {
      type: "string",
      minLength: 1,
      maxLength: 20,
      pattern: "^[A-Za-z0-9_-]+$",
    },
    name: {
      anyOf: [{ type: "string", minLength: 1, maxLength: 50 }, { type: "null" }],
    },
    capacity: {
      anyOf: [
        { type: "integer", minimum: 1, maximum: 100 },
        { type: "null" },
      ],
    },
    isActive: {
      type: "boolean",
    },
  },
};

const updateRestaurantTableBodySchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    code: {
      type: "string",
      minLength: 1,
      maxLength: 20,
      pattern: "^[A-Za-z0-9_-]+$",
    },
    name: {
      anyOf: [{ type: "string", minLength: 1, maxLength: 50 }, { type: "null" }],
    },
    capacity: {
      anyOf: [
        { type: "integer", minimum: 1, maximum: 100 },
        { type: "null" },
      ],
    },
  },
};

const updateRestaurantTableStatusBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["isActive"],
  properties: {
    isActive: {
      type: "boolean",
    },
  },
};

const restaurantTablesRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Restaurant-Tables"],
        summary: "Listar mesas del restaurante",
        security: [{ bearerAuth: [] }],
        querystring: listRestaurantTablesQuerystringSchema,
        response: {
          200: {
            type: "array",
            items: restaurantTableResponseSchema,
          },
          401: basicErrorSchema,
        },
      },
    },
    listRestaurantTablesController,
  );

  app.get(
    "/:tableId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Restaurant-Tables"],
        summary: "Obtener mesa por id",
        security: [{ bearerAuth: [] }],
        params: restaurantTableParamsSchema,
        response: {
          200: restaurantTableResponseSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    getRestaurantTableByIdController,
  );

  app.post(
    "/",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Restaurant-Tables"],
        summary: "Crear mesa del restaurante",
        security: [{ bearerAuth: [] }],
        body: createRestaurantTableBodySchema,
        response: {
          201: restaurantTableResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    createRestaurantTableController,
  );

  app.patch(
    "/:tableId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Restaurant-Tables"],
        summary: "Actualizar mesa del restaurante",
        security: [{ bearerAuth: [] }],
        params: restaurantTableParamsSchema,
        body: updateRestaurantTableBodySchema,
        response: {
          200: restaurantTableResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    updateRestaurantTableController,
  );

  app.patch(
    "/:tableId/status",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Restaurant-Tables"],
        summary: "Activar o desactivar mesa",
        security: [{ bearerAuth: [] }],
        params: restaurantTableParamsSchema,
        body: updateRestaurantTableStatusBodySchema,
        response: {
          200: restaurantTableResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    updateRestaurantTableStatusController,
  );
};

export default restaurantTablesRoutes;