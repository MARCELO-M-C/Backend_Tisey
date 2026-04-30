import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { getRequestUser } from "../auth/service";
import {
  createStayBodySchema,
  listStaysQuerySchema,
  replaceStayGuestsBodySchema,
  stayIdParamSchema,
  updateStayBodySchema,
  updateStayStatusBodySchema,
} from "./schemas";
import {
  StaysServiceError,
  createStay,
  getStayById,
  listStays,
  replaceStayGuests,
  updateStay,
  updateStayStatus,
} from "./service";

function handleStaysError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Payload inválido.",
      details: error.flatten(),
    });
  }

  if (error instanceof StaysServiceError) {
    return reply.status(error.statusCode).send({
      message: error.message,
      code: error.code,
    });
  }

  throw error;
}

export async function listStaysController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const query = listStaysQuerySchema.parse(request.query ?? {});
    const stays = await listStays(query);

    return reply.status(200).send(stays);
  } catch (error) {
    return handleStaysError(reply, error);
  }
}

export async function getStayByIdController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = stayIdParamSchema.parse(request.params);
    const stay = await getStayById(params.stayId);

    return reply.status(200).send(stay);
  } catch (error) {
    return handleStaysError(reply, error);
  }
}

export async function createStayController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const body = createStayBodySchema.parse(request.body);
    const currentUser = getRequestUser(request);
    const stay = await createStay(body, currentUser.sub);

    return reply.status(201).send(stay);
  } catch (error) {
    return handleStaysError(reply, error);
  }
}

export async function updateStayController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = stayIdParamSchema.parse(request.params);
    const body = updateStayBodySchema.parse(request.body);
    const stay = await updateStay(params.stayId, body);

    return reply.status(200).send(stay);
  } catch (error) {
    return handleStaysError(reply, error);
  }
}

export async function updateStayStatusController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = stayIdParamSchema.parse(request.params);
    const body = updateStayStatusBodySchema.parse(request.body);
    const stay = await updateStayStatus(params.stayId, body);

    return reply.status(200).send(stay);
  } catch (error) {
    return handleStaysError(reply, error);
  }
}

export async function replaceStayGuestsController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = stayIdParamSchema.parse(request.params);
    const body = replaceStayGuestsBodySchema.parse(request.body);
    const stay = await replaceStayGuests(params.stayId, body);

    return reply.status(200).send(stay);
  } catch (error) {
    return handleStaysError(reply, error);
  }
}