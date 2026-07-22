import type { FastifyPluginAsync } from "fastify";
import { loginController, meController } from "./controller";
import { authenticateRequest } from "./service";

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
  required: ["id", "name", "permissions"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    permissions: {
      type: "array",
      items: permissionResponseSchema,
    },
  },
};

const authUserResponseSchema = {
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
      items: roleResponseSchema,
    },
    permissions: {
      type: "array",
      items: permissionResponseSchema,
    },
  },
};

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/login",
    {
      schema: {
        tags: ["Auth"],
        summary: "Iniciar sesión",
        body: {
          type: "object",
          additionalProperties: false,
          required: ["username", "password"],
          properties: {
            username: {
              type: "string",
              minLength: 3,
            },
            password: {
              type: "string",
              minLength: 6,
            },
          },
        },
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: [
              "accessToken",
              "tokenType",
              "expiresIn",
              "user",
            ],
            properties: {
              accessToken: { type: "string" },
              tokenType: { type: "string" },
              expiresIn: { type: "string" },
              user: authUserResponseSchema,
            },
          },
        },
      },
    },
    loginController,
  );

  app.get(
    "/me",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Auth"],
        summary: "Obtener el usuario autenticado",
        security: [{ bearerAuth: [] }],
        response: {
          200: authUserResponseSchema,
        },
      },
    },
    meController,
  );
};

export default authRoutes;
