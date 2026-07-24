import type { FastifyPluginAsync } from "fastify";
import { authorizeRoles } from "../auth/service";
import {
  getRoleByIdController,
  listPermissionsController,
  listRolesController,
} from "./controller";

const requireAdmin = authorizeRoles(
  ["ADMIN"],
  { adminBypass: false },
);

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

const permissionResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "code", "description"],
  properties: {
    id: { type: "string" },
    code: { type: "string" },
    description: {
      anyOf: [
        { type: "string" },
        { type: "null" },
      ],
    },
  },
};

const roleResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "usersCount"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    usersCount: { type: "integer" },
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
    search: {
      type: "string",
      minLength: 1,
      maxLength: 80,
    },
  },
};

const rolesRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      onRequest: [requireAdmin],
      schema: {
        tags: ["Roles"],
        summary: "Listar roles del sistema",
        security: [{ bearerAuth: [] }],
        querystring: listRolesQuerystringSchema,
        response: {
          200: {
            type: "array",
            items: roleResponseSchema,
          },
          401: basicErrorSchema,
          403: basicErrorSchema,
        },
      },
    },
    listRolesController,
  );

  app.get(
    "/permissions",
    {
      onRequest: [requireAdmin],
      schema: {
        tags: ["Roles"],
        summary: "Listar permisos asignables a MANAGER",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "array",
            items: permissionResponseSchema,
          },
          401: basicErrorSchema,
          403: basicErrorSchema,
        },
      },
    },
    listPermissionsController,
  );

  app.get(
    "/:roleId",
    {
      onRequest: [requireAdmin],
      schema: {
        tags: ["Roles"],
        summary: "Obtener rol por id",
        security: [{ bearerAuth: [] }],
        params: roleParamsSchema,
        response: {
          200: roleResponseSchema,
          401: basicErrorSchema,
          403: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    getRoleByIdController,
  );
};

export default rolesRoutes;
