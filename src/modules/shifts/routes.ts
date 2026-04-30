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
};

const nullableNotesSchema = {
  anyOf: [{ type: "string", minLength: 1, maxLength: 255 }, { type: "null" }],
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
    id: { type: "string" },
    username: { type: "string" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    fullName: { type: "string" },
    isActive: { type: "boolean" },
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
    id: { type: "string" },
    startedAt: {
      type: "string",
    },
    endedAt: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    isOpen: { type: "boolean" },
    notes: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    user: userSummarySchema,
    ordersCount: { type: "integer" },
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
    userId: digitStringSchema,
    isOpen: {
      type: "string",
      enum: ["true", "false"],
    },
    from: isoDateTimeSchema,
    to: {
      type: "string",
      format: "date-time",
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
    },
    startedAt: isoDateTimeSchema,
    notes: nullableNotesSchema,
  },
};

const updateShiftBodySchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    startedAt: isoDateTimeSchema,
    notes: nullableNotesSchema,
  },
};

const endShiftBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    endedAt: {
      type: "string",
      format: "date-time",
    },
    notes: nullableNotesSchema,
  },
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