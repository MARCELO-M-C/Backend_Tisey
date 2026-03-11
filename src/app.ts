import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";

import authRoutes from "./modules/auth/routes";
import usersRoutes from "./modules/users/routes";

import { env } from "./config/env";

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
        { name: "Auth", description: "Autenticación" },
        { name: "Cabins", description: "Cabañas y disponibilidad" },
        { name: "Guests", description: "Huéspedes y reservas" },
        { name: "Roles", description: "Roles generales y permisos" },
        { name: "Users", description: "Usuarios y roles" },
        { name: "Menu", description: "Menú y categorías" },
        { name: "Stations", description: "Estaciones KDS" },
        { name: "Orders", description: "Pedidos y estado de preparación" },
        { name: "Stays", description: "Estadías y check-in/check-out" },
        { name: "Invoices", description: "Facturación y pagos" },
        { name: "Restaurant-Tables", description: "Mesas del restaurante" },
        { name: "Shifts", description: "Turnos de trabajo" },
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
        tags: ["Base"],
        summary: "Raíz de la API",
      },
    },
    async () => ({
      name: "Backend Tisey API",
      status: "running",
      docs: "/docs",
    }),
  );

  app.get(
    "/health",
    {
      schema: {
        tags: ["Base"],
        summary: "Estado de salud de la API",
      },
    },
    async () => ({
      ok: true,
      status: "healthy",
    }),
  );

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(usersRoutes, { prefix: "/users" });
  
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