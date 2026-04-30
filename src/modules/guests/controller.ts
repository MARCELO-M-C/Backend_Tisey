import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  createGuestBodySchema,
  guestIdParamSchema,
  listGuestsQuerySchema,
  updateGuestBodySchema,
} from "./schemas";
import {
  GuestsServiceError,
  createGuest,
  getGuestById,
  listGuests,
  updateGuest,
} from "./service";

function handleGuestsError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Payload inválido.",
      details: error.flatten(),
    });
  }

  if (error instanceof GuestsServiceError) {
    return reply.status(error.statusCode).send({
      message: error.message,
      code: error.code,
    });
  }

  throw error;
}

export async function listGuestsController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const query = listGuestsQuerySchema.parse(request.query ?? {});
    const guests = await listGuests(query);

    return reply.status(200).send(guests);
  } catch (error) {
    return handleGuestsError(reply, error);
  }
}

export async function getGuestByIdController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = guestIdParamSchema.parse(request.params);
    const guest = await getGuestById(params.guestId);

    return reply.status(200).send(guest);
  } catch (error) {
    return handleGuestsError(reply, error);
  }
}

export async function createGuestController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const body = createGuestBodySchema.parse(request.body);
    const guest = await createGuest(body);

    return reply.status(201).send(guest);
  } catch (error) {
    return handleGuestsError(reply, error);
  }
}

export async function updateGuestController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = guestIdParamSchema.parse(request.params);
    const body = updateGuestBodySchema.parse(request.body);
    const guest = await updateGuest(params.guestId, body);

    return reply.status(200).send(guest);
  } catch (error) {
    return handleGuestsError(reply, error);
  }
}