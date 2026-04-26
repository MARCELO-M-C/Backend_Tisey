import type { FastifyPluginAsync } from "fastify";
import { authenticateRequest } from "../auth/service";
import {
  createShiftController,
  endShiftController,
  getShiftByIdController,
  listShiftsController,
  updateShiftController,
} from "./controller";

const digitStringSchema = {
  type: "string",
  pattern: "^[0-9]+$",
};

const positiveBodyIdSchema = {
  type: "integer",
  minimum: 1,
};

const isoDateTimeSchema = {
  type: "string",
  format: "date-time",
  example: "2026-04-25T08:00:00.000Z",
};

const nullableNotesSchema = {
  anyOf: [{ type: "string", minLength: 1, maxLength: 255 }, { type: "null" }],
  example: "Turno de mañana",
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

const userSummarySchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "username", "firstName", "lastName", "fullName", "isActive"],
  properties: {
    id: { type: "string", example: "1" },
    username: { type: "string", example: "mesero1" },
    firstName: { type: "string", example: "Juan" },
    lastName: { type: "string", example: "Pérez" },
    fullName: { type: "string", example: "Juan Pérez" },
    isActive: { type: "boolean", example: true },
  },
};

const shiftResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "startedAt",
    "endedAt",
    "isOpen",
    "notes",
    "user",
    "ordersCount",
  ],
  properties: {
    id: { type: "string", example: "1" },
    startedAt: {
      type: "string",
      example: "2026-04-25T08:00:00.000Z",
    },
    endedAt: {
      anyOf: [{ type: "string" }, { type: "null" }],
      example: null,
    },
    isOpen: { type: "boolean", example: true },
    notes: {
      anyOf: [{ type: "string" }, { type: "null" }],
      example: "Turno de mañana",
    },
    user: userSummarySchema,
    ordersCount: { type: "integer", example: 5 },
  },
};

const shiftParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["shiftId"],
  properties: {
    shiftId: digitStringSchema,
  },
};

const listShiftsQuerystringSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    userId: {
      ...digitStringSchema,
      example: "1",
    },
    isOpen: {
      type: "string",
      enum: ["true", "false"],
      example: "true",
    },
    from: isoDateTimeSchema,
    to: {
      type: "string",
      format: "date-time",
      example: "2026-04-25T18:00:00.000Z",
    },
  },
};

const createShiftBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    userId: {
      ...positiveBodyIdSchema,
      description:
        "Opcional. Si no se envía, se crea el turno para el usuario autenticado.",
      example: 1,
    },
    startedAt: isoDateTimeSchema,
    notes: nullableNotesSchema,
  },
  examples: [
    {
      userId: 1,
      startedAt: "2026-04-25T08:00:00.000Z",
      notes: "Turno de mañana",
    },
    {
      notes: "Turno para el usuario autenticado",
    },
  ],
};

const updateShiftBodySchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    startedAt: isoDateTimeSchema,
    notes: nullableNotesSchema,
  },
  examples: [
    {
      notes: "Cambio de observación del turno",
    },
    {
      startedAt: "2026-04-25T09:00:00.000Z",
    },
    {
      notes: null,
    },
  ],
};

const endShiftBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    endedAt: {
      type: "string",
      format: "date-time",
      example: "2026-04-25T17:00:00.000Z",
    },
    notes: nullableNotesSchema,
  },
  examples: [
    {
      endedAt: "2026-04-25T17:00:00.000Z",
      notes: "Turno cerrado sin pendientes",
    },
    {
      notes: "Cierre usando hora actual del servidor",
    },
  ],
};

const shiftsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Shifts"],
        summary: "Listar turnos",
        security: [{ bearerAuth: [] }],
        querystring: listShiftsQuerystringSchema,
        response: {
          200: {
            type: "array",
            items: shiftResponseSchema,
          },
          401: basicErrorSchema,
        },
      },
    },
    listShiftsController,
  );

  app.get(
    "/:shiftId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Shifts"],
        summary: "Obtener turno por id",
        security: [{ bearerAuth: [] }],
        params: shiftParamsSchema,
        response: {
          200: shiftResponseSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
        },
      },
    },
    getShiftByIdController,
  );

  app.post(
    "/",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Shifts"],
        summary: "Crear turno",
        security: [{ bearerAuth: [] }],
        body: createShiftBodySchema,
        response: {
          201: shiftResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          403: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    createShiftController,
  );

  app.patch(
    "/:shiftId",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Shifts"],
        summary: "Actualizar turno abierto",
        security: [{ bearerAuth: [] }],
        params: shiftParamsSchema,
        body: updateShiftBodySchema,
        response: {
          200: shiftResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    updateShiftController,
  );

  app.patch(
    "/:shiftId/end",
    {
      onRequest: [authenticateRequest],
      schema: {
        tags: ["Shifts"],
        summary: "Cerrar turno",
        security: [{ bearerAuth: [] }],
        params: shiftParamsSchema,
        body: endShiftBodySchema,
        response: {
          200: shiftResponseSchema,
          400: basicErrorSchema,
          401: basicErrorSchema,
          404: basicErrorSchema,
          409: basicErrorSchema,
        },
      },
    },
    endShiftController,
  );
};

export default shiftsRoutes;