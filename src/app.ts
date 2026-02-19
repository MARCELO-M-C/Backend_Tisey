import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";

import { env } from "./config/env";
import { authRoutes } from "./modules/auth/auth.routes";
import { healthRoutes } from "./modules/health/health.routes";
import { ordersRoutes } from "./modules/orders/orders.routes";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });
  const allowedOrigins = env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(sensible);
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed"), false);
    },
    credentials: true,
  });
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Backend Tisey API",
        version: "1.0.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      tags: [
        { name: "Auth", description: "Autenticacion y autorizacion" },
        { name: "Health", description: "Disponibilidad de la API" },
        { name: "Orders", description: "Pedidos y tiempos KDS" },
      ],
    },
  });
  await app.register(swaggerUi, {
    routePrefix: "/docs",
    staticCSP: true,
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });

  app.get(
    "/",
    {
      schema: {
        tags: ["Health"],
        summary: "Raiz de la API",
      },
    },
    async () => ({
      name: "Backend Tisey API",
      status: "running",
      docs: "/docs",
    }),
  );

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(healthRoutes);
  await app.register(ordersRoutes, { prefix: "/api/orders" });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);

    if (error.validation) {
      return reply.status(400).send({
        message: "Invalid request payload.",
        details: error.validation,
      });
    }

    const statusCode =
      error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;

    return reply.status(statusCode).send({
      message: statusCode === 500 ? "Internal server error." : error.message,
    });
  });

  return app;
}
