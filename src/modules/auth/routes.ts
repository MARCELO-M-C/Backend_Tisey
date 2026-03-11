import type { FastifyPluginAsync } from "fastify";
import { loginController, meController } from "./controller";
import { authenticateRequest } from "./service";

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/login",
    {
      schema: {
        tags: ["Auth"],
        summary: "Iniciar sesión",
        body: {
          type: "object",
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
            properties: {
              accessToken: { type: "string" },
              tokenType: { type: "string" },
              expiresIn: { type: "string" },
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  username: { type: "string" },
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  fullName: { type: "string" },
                  isActive: { type: "boolean" },
                  createdAt: { type: "string" },
                },
              },
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
      },
    },
    meController,
  );
};

export default authRoutes;