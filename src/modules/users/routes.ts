import type { FastifyPluginAsync } from "fastify";
import { authorizePermissions } from "../auth/service";
import {
  createUserController,
  getUserByIdController,
  listUsersController,
  replaceUserRolesController,
  updateUserController,
  updateUserStatusController,
} from "./controller";

const requireUsersManage = authorizePermissions(["users:manage"]);

const digitStringSchema = {
  type: "string",
  pattern: "^[0-9]+$",
};

const positiveBodyIdSchema = {
  type: "integer",
  minimum: 1,
};

const permissionSchema = {
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

const roleSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "permissions"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    permissions: {
      type: "array",
      items: permissionSchema,
    },
  },
};

const userResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "username",
    "firstName",
    "lastName",
    "fullName",
    "isActive",
    "createdAt",
    "roles",
    "permissions",
  ],
  properties: {
    id: { type: "string" },
    username: { type: "string" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    fullName: { type: "string" },
    isActive: { type: "boolean" },
    createdAt: { type: "string" },
    roles: {
      type: "array",
      items: roleSchema,
    },
    permissions: {
      type: "array",
      items: permissionSchema,
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

const userIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: {
    id: digitStringSchema,
  },
};

const listUsersQuerystringSchema = {
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
    roleId: digitStringSchema,
  },
};

const createUserBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["username", "password", "firstName", "lastName", "roleIds"],
  properties: {
    username: {
      type: "string",
      minLength: 3,
      maxLength: 50,
    },
    password: {
      type: "string",
      minLength: 8,
      maxLength: 72,
    },
    firstName: {
      type: "string",
      minLength: 1,
      maxLength: 80,
    },
    lastName: {
      type: "string",
      minLength: 1,
      maxLength: 80,
    },
    isActive: {
      type: "boolean",
    },
    roleIds: {
      type: "array",
      minItems: 1,
      items: positiveBodyIdSchema,
    },
  },
};

const updateUserBodySchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    username: {
      type: "string",
      minLength: 3,
      maxLength: 50,
    },
    password: {
      type: "string",
      minLength: 8,
      maxLength: 72,
    },
    firstName: {
      type: "string",
      minLength: 1,
      maxLength: 80,
    },
    lastName: {
      type: "string",
      minLength: 1,
      maxLength: 80,
    },
    isActive: {
      type: "boolean",
    },
  },
};

const replaceUserRolesBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["roleIds"],
  properties: {
    roleIds: {
      type: "array",
      minItems: 1,
      items: positiveBodyIdSchema,
    },
  },
};

const updateUserStatusBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["isActive"],
  properties: {
    isActive: {
      type: "boolean",
    },
  },
};

const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      onRequest: [requireUsersManage],
      schema: {
        tags: ["Users"],
        summary: "Listar usuarios",
        security: [{ bearerAuth: [] }],
        querystring: listUsersQuerystringSchema,
        response: {
          200: {
            type: "array",
            items: userResponseSchema,
          },
          401: basicErrorSchema,
          403: basicErrorSchema,
        },
      },
    },
    listUsersController,
  );

  app.get(
    "/:id",
    {
      onRequest: [requireUsersManage],
      schema: {
        tags: ["Users"],
        summary: "Obtener usuario por id",
        security: [{ bearerAuth: [] }],
        params: userIdParamsSchema,
        response: {
          200: userResponseSchema,
          401: basicErrorSchema,
          403: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    getUserByIdController,
  );

  app.post(
    "/",
    {
      onRequest: [requireUsersManage],
      schema: {
        tags: ["Users"],
        summary: "Crear usuario",
        security: [{ bearerAuth: [] }],
        body: createUserBodySchema,
        response: {
          201: userResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          403: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    createUserController,
  );

  app.patch(
    "/:id",
    {
      onRequest: [requireUsersManage],
      schema: {
        tags: ["Users"],
        summary: "Actualizar datos básicos de un usuario",
        security: [{ bearerAuth: [] }],
        params: userIdParamsSchema,
        body: updateUserBodySchema,
        response: {
          200: userResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          403: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    updateUserController,
  );

  app.patch(
    "/:id/status",
    {
      onRequest: [requireUsersManage],
      schema: {
        tags: ["Users"],
        summary: "Activar o desactivar un usuario",
        security: [{ bearerAuth: [] }],
        params: userIdParamsSchema,
        body: updateUserStatusBodySchema,
        response: {
          200: userResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          403: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    updateUserStatusController,
  );

  app.put(
    "/:id/roles",
    {
      onRequest: [requireUsersManage],
      schema: {
        tags: ["Users"],
        summary: "Reemplazar roles de un usuario",
        security: [{ bearerAuth: [] }],
        params: userIdParamsSchema,
        body: replaceUserRolesBodySchema,
        response: {
          200: userResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          403: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    replaceUserRolesController,
  );
};

export default usersRoutes;