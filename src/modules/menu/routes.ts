import type { FastifyPluginAsync } from "fastify";
import { authenticateRequest } from "../auth/service";
import {
  createCategoryController,
  createMenuItemController,
  getCategoryByIdController,
  getMenuItemByIdController,
  listCategoriesController,
  listMenuItemsController,
  listStationsController,
  updateCategoryController,
  updateCategoryStatusController,
  updateMenuItemController,
  updateMenuItemStatusController,
} from "./controller";

const digitStringSchema = {
  type: "string",
  pattern: "^[0-9]+$",
};

const positiveBodyIdSchema = {
  type: "integer",
  minimum: 1,
};

const stationResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "code", "name", "isActive"],
  properties: {
    id: { type: "string" },
    code: { type: "string" },
    name: { type: "string" },
    isActive: { type: "boolean" },
  },
};

const categoryResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "sortOrder", "isActive", "itemsCount"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    sortOrder: { type: "integer" },
    isActive: { type: "boolean" },
    itemsCount: { type: "integer" },
  },
};

const menuItemResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "name",
    "basePrice",
    "isActive",
    "createdAt",
    "updatedAt",
    "category",
    "station",
  ],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    basePrice: { type: "string" },
    isActive: { type: "boolean" },
    createdAt: { type: "string" },
    updatedAt: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    category: {
      type: "object",
      additionalProperties: false,
      required: ["id", "name", "sortOrder", "isActive"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        sortOrder: { type: "integer" },
        isActive: { type: "boolean" },
      },
    },
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

const categoryParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["categoryId"],
  properties: {
    categoryId: digitStringSchema,
  },
};

const itemParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["itemId"],
  properties: {
    itemId: digitStringSchema,
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

const listCategoriesQuerystringSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    search: { type: "string", minLength: 1, maxLength: 80 },
    isActive: { type: "string", enum: ["true", "false"] },
  },
};

const createCategoryBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["name"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 80 },
    sortOrder: { type: "integer", minimum: 0, maximum: 9999 },
    isActive: { type: "boolean" },
  },
};

const updateCategoryBodySchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 80 },
    sortOrder: { type: "integer", minimum: 0, maximum: 9999 },
  },
};

const updateCategoryStatusBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["isActive"],
  properties: {
    isActive: { type: "boolean" },
  },
};

const listMenuItemsQuerystringSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    search: { type: "string", minLength: 1, maxLength: 120 },
    categoryId: digitStringSchema,
    stationId: digitStringSchema,
    isActive: { type: "string", enum: ["true", "false"] },
  },
};

const createMenuItemBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["categoryId", "stationId", "name", "basePrice"],
  properties: {
    categoryId: positiveBodyIdSchema,
    stationId: positiveBodyIdSchema,
    name: { type: "string", minLength: 1, maxLength: 120 },
    basePrice: {
      anyOf: [
        { type: "number", exclusiveMinimum: 0 },
        { type: "string", pattern: "^\\d+(\\.\\d{1,2})?$" },
      ],
    },
    isActive: { type: "boolean" },
  },
};

const updateMenuItemBodySchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    categoryId: positiveBodyIdSchema,
    stationId: positiveBodyIdSchema,
    name: { type: "string", minLength: 1, maxLength: 120 },
    basePrice: {
      anyOf: [
        { type: "number", exclusiveMinimum: 0 },
        { type: "string", pattern: "^\\d+(\\.\\d{1,2})?$" },
      ],
    },
  },
};

const updateMenuItemStatusBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["isActive"],
  properties: {
    isActive: { type: "boolean" },
  },
};

const menuRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/stations",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Stations"],
        summary: "Listar estaciones KDS",
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
    "/categories",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Menu"],
        summary: "Listar categorías de menú",
        security: [{ bearerAuth: [] }],
        querystring: listCategoriesQuerystringSchema,
        response: {
          200: {
            type: "array",
            items: categoryResponseSchema,
          },
          401: basicErrorSchema,
        },
      },
    },
    listCategoriesController,
  );

  app.get(
    "/categories/:categoryId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Menu"],
        summary: "Obtener categoría por id",
        security: [{ bearerAuth: [] }],
        params: categoryParamsSchema,
        response: {
          200: categoryResponseSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    getCategoryByIdController,
  );

  app.post(
    "/categories",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Menu"],
        summary: "Crear categoría de menú",
        security: [{ bearerAuth: [] }],
        body: createCategoryBodySchema,
        response: {
          201: categoryResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    createCategoryController,
  );

  app.patch(
    "/categories/:categoryId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Menu"],
        summary: "Actualizar categoría de menú",
        security: [{ bearerAuth: [] }],
        params: categoryParamsSchema,
        body: updateCategoryBodySchema,
        response: {
          200: categoryResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    updateCategoryController,
  );

  app.patch(
    "/categories/:categoryId/status",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Menu"],
        summary: "Activar o desactivar categoría",
        security: [{ bearerAuth: [] }],
        params: categoryParamsSchema,
        body: updateCategoryStatusBodySchema,
        response: {
          200: categoryResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    updateCategoryStatusController,
  );

  app.get(
    "/items",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Menu"],
        summary: "Listar ítems de menú",
        security: [{ bearerAuth: [] }],
        querystring: listMenuItemsQuerystringSchema,
        response: {
          200: {
            type: "array",
            items: menuItemResponseSchema,
          },
          401: basicErrorSchema,
        },
      },
    },
    listMenuItemsController,
  );

  app.get(
    "/items/:itemId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Menu"],
        summary: "Obtener ítem de menú por id",
        security: [{ bearerAuth: [] }],
        params: itemParamsSchema,
        response: {
          200: menuItemResponseSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    getMenuItemByIdController,
  );

  app.post(
    "/items",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Menu"],
        summary: "Crear ítem de menú",
        security: [{ bearerAuth: [] }],
        body: createMenuItemBodySchema,
        response: {
          201: menuItemResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    createMenuItemController,
  );

  app.patch(
    "/items/:itemId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Menu"],
        summary: "Actualizar ítem de menú",
        security: [{ bearerAuth: [] }],
        params: itemParamsSchema,
        body: updateMenuItemBodySchema,
        response: {
          200: menuItemResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    updateMenuItemController,
  );

  app.patch(
    "/items/:itemId/status",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Menu"],
        summary: "Activar o desactivar ítem de menú",
        security: [{ bearerAuth: [] }],
        params: itemParamsSchema,
        body: updateMenuItemStatusBodySchema,
        response: {
          200: menuItemResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    updateMenuItemStatusController,
  );
};

export default menuRoutes;