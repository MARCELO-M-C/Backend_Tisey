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
    id: { type: "string", example: "1" },
    code: { type: "string", example: "M1" },
    name: {
      anyOf: [{ type: "string" }, { type: "null" }],
      example: "Mesa terraza 1",
    },
    capacity: {
      anyOf: [{ type: "integer" }, { type: "null" }],
      example: 4,
    },
    isActive: { type: "boolean", example: true },
    ordersCount: { type: "integer", example: 3 },
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
      example: "M1",
    },
    isActive: {
      type: "string",
      enum: ["true", "false"],
      example: "true",
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
      example: "M1",
    },
    name: {
      anyOf: [{ type: "string", minLength: 1, maxLength: 50 }, { type: "null" }],
      example: "Mesa terraza 1",
    },
    capacity: {
      anyOf: [
        { type: "integer", minimum: 1, maximum: 100 },
        { type: "null" },
      ],
      example: 4,
    },
    isActive: {
      type: "boolean",
      example: true,
    },
  },
  examples: [
    {
      code: "M1",
      name: "Mesa terraza 1",
      capacity: 4,
      isActive: true,
    },
    {
      code: "M2",
      name: null,
      capacity: null,
      isActive: true,
    },
  ],
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
      example: "M1A",
    },
    name: {
      anyOf: [{ type: "string", minLength: 1, maxLength: 50 }, { type: "null" }],
      example: "Mesa principal",
    },
    capacity: {
      anyOf: [
        { type: "integer", minimum: 1, maximum: 100 },
        { type: "null" },
      ],
      example: 6,
    },
  },
  examples: [
    {
      name: "Mesa principal",
      capacity: 6,
    },
    {
      name: null,
    },
  ],
};

const updateRestaurantTableStatusBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["isActive"],
  properties: {
    isActive: {
      type: "boolean",
      example: false,
    },
  },
  examples: [
    {
      isActive: false,
    },
  ],
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