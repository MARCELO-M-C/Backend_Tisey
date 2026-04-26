import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { getRequestUser } from "../auth/service";
import {
  createShiftBodySchema,
  endShiftBodySchema,
  listShiftsQuerySchema,
  shiftIdParamSchema,
  updateShiftBodySchema,
} from "./schemas";
import {
  ShiftsServiceError,
  createShift,
  endShift,
  getShiftById,
  listShifts,
  updateShift,
} from "./service";

function handleShiftsError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Payload inválido.",
      details: error.flatten(),
    });
  }

  if (error instanceof ShiftsServiceError) {
    return reply.status(error.statusCode).send({
      message: error.message,
      code: error.code,
    });
  }

  throw error;
}

export async function listShiftsController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const query = listShiftsQuerySchema.parse(request.query ?? {});
    const shifts = await listShifts(query);

    return reply.status(200).send(shifts);
  } catch (error) {
    return handleShiftsError(reply, error);
  }
}

export async function getShiftByIdController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = shiftIdParamSchema.parse(request.params);
    const shift = await getShiftById(params.shiftId);

    return reply.status(200).send(shift);
  } catch (error) {
    return handleShiftsError(reply, error);
  }
}

export async function createShiftController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const body = createShiftBodySchema.parse(request.body ?? {});
    const currentUser = getRequestUser(request);
    const shift = await createShift(body, currentUser.sub);

    return reply.status(201).send(shift);
  } catch (error) {
    return handleShiftsError(reply, error);
  }
}

export async function updateShiftController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = shiftIdParamSchema.parse(request.params);
    const body = updateShiftBodySchema.parse(request.body);
    const shift = await updateShift(params.shiftId, body);

    return reply.status(200).send(shift);
  } catch (error) {
    return handleShiftsError(reply, error);
  }
}

export async function endShiftController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = shiftIdParamSchema.parse(request.params);
    const body = endShiftBodySchema.parse(request.body ?? {});
    const shift = await endShift(params.shiftId, body);

    return reply.status(200).send(shift);
  } catch (error) {
    return handleShiftsError(reply, error);
  }
}