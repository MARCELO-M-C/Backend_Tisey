import type { FastifyPluginAsync } from "fastify";
import { authenticateRequest } from "../auth/service";
import {
  createRoleController,
  getRoleByIdController,
  listPermissionsController,
  listRolesController,
  updateRoleController,
  updateRolePermissionsController,
} from "./controller";

const digitStringSchema = {
  type: "string",
  pattern: "^[0-9]+$",
};

const positiveBodyIdSchema = {
  type: "integer",
  minimum: 1,
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

const permissionResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "code", "description"],
  properties: {
    id: { type: "string" },
    code: { type: "string" },
    description: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
  },
};

const roleResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "usersCount", "permissionsCount", "permissions"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    usersCount: { type: "integer" },
    permissionsCount: { type: "integer" },
    permissions: {
      type: "array",
      items: permissionResponseSchema,
    },
  },
};

const roleParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["roleId"],
  properties: {
    roleId: digitStringSchema,
  },
};

const listRolesQuerystringSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    search: { type: "string", minLength: 1, maxLength: 80 },
  },
};

const createRoleBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["name"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 50 },
    permissionIds: {
      type: "array",
      items: positiveBodyIdSchema,
    },
  },
};

const updateRoleBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["name"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 50 },
  },
};

const updateRolePermissionsBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["permissionIds"],
  properties: {
    permissionIds: {
      type: "array",
      items: positiveBodyIdSchema,
    },
  },
};

const rolesRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Roles"],
        summary: "Listar roles",
        security: [{ bearerAuth: [] }],
        querystring: listRolesQuerystringSchema,
        response: {
          200: {
            type: "array",
            items: roleResponseSchema,
          },
          401: basicErrorSchema,
        },
      },
    },
    listRolesController,
  );

  app.get(
    "/permissions",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Roles"],
        summary: "Listar permisos disponibles",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "array",
            items: permissionResponseSchema,
          },
          401: basicErrorSchema,
        },
      },
    },
    listPermissionsController,
  );

  app.get(
    "/:roleId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Roles"],
        summary: "Obtener rol por id",
        security: [{ bearerAuth: [] }],
        params: roleParamsSchema,
        response: {
          200: roleResponseSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    getRoleByIdController,
  );

  app.post(
    "/",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Roles"],
        summary: "Crear rol",
        security: [{ bearerAuth: [] }],
        body: createRoleBodySchema,
        response: {
          201: roleResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    createRoleController,
  );

  app.patch(
    "/:roleId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Roles"],
        summary: "Actualizar rol",
        security: [{ bearerAuth: [] }],
        params: roleParamsSchema,
        body: updateRoleBodySchema,
        response: {
          200: roleResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    updateRoleController,
  );

  app.patch(
    "/:roleId/permissions",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Roles"],
        summary: "Reemplazar permisos del rol",
        security: [{ bearerAuth: [] }],
        params: roleParamsSchema,
        body: updateRolePermissionsBodySchema,
        response: {
          200: roleResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    updateRolePermissionsController,
  );
};

export default rolesRoutes;