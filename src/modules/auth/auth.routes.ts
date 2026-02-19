import bcrypt from "bcryptjs";
import type { FastifyPluginAsync } from "fastify";

import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { authenticate, toAuthenticatedUser } from "./auth.guards";
import type { AuthTokenPayload } from "./auth.types";

type LoginBody = {
  username: string;
  password: string;
};

const loginSchema = {
  tags: ["Auth"],
  summary: "Iniciar sesion y obtener JWT",
  body: {
    type: "object",
    required: ["username", "password"],
    properties: {
      username: { type: "string", minLength: 1, maxLength: 50 },
      password: { type: "string", minLength: 1, maxLength: 128 },
    },
  },
};

const meSchema = {
  tags: ["Auth"],
  summary: "Obtener usuario autenticado",
  security: [{ bearerAuth: [] }],
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: LoginBody }>(
    "/login",
    {
      schema: loginSchema,
      config: {
        rateLimit: {
          max: 8,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const username = request.body.username.trim();

      const user = await prisma.user.findUnique({
        where: { username },
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!user || !user.isActive) {
        return reply.unauthorized("Credenciales invalidas.");
      }

      const passwordIsValid = await bcrypt.compare(request.body.password, user.passwordHash);
      if (!passwordIsValid) {
        return reply.unauthorized("Credenciales invalidas.");
      }

      const authUser = toAuthenticatedUser(user);
      const tokenPayload: AuthTokenPayload = {
        sub: authUser.id.toString(),
        username: authUser.username,
        roles: authUser.roles,
        permissions: authUser.permissions,
      };

      const accessToken = await reply.jwtSign(tokenPayload, {
        expiresIn: env.JWT_EXPIRES_IN,
      });

      return {
        tokenType: "Bearer",
        accessToken,
        expiresIn: env.JWT_EXPIRES_IN,
        user: {
          id: authUser.id.toString(),
          username: authUser.username,
          firstName: authUser.firstName,
          lastName: authUser.lastName,
          roles: authUser.roles,
          permissions: authUser.permissions,
        },
      };
    },
  );

  app.get(
    "/me",
    {
      preHandler: [authenticate],
      schema: meSchema,
    },
    async (request, reply) => {
      const authUser = request.authUser;
      if (!authUser) {
        return reply.unauthorized("No autenticado.");
      }

      return {
        id: authUser.id.toString(),
        username: authUser.username,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        roles: authUser.roles,
        permissions: authUser.permissions,
      };
    },
  );
};
