import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  createLodgingRateBodySchema,
  currentLodgingRateQuerySchema,
  listLodgingRatesQuerySchema,
} from "./schemas";
import {
  LodgingRatesServiceError,
  createLodgingRate,
  getCurrentLodgingRate,
  listLodgingRates,
} from "./service";

function handleLodgingRatesError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Payload inválido.",
      details: error.flatten(),
    });
  }

  if (error instanceof LodgingRatesServiceError) {
    return reply.status(error.statusCode).send({
      message: error.message,
      code: error.code,
    });
  }

  throw error;
}

export async function listLodgingRatesController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const query = listLodgingRatesQuerySchema.parse(request.query ?? {});
    return reply.status(200).send(await listLodgingRates(query));
  } catch (error) {
    return handleLodgingRatesError(reply, error);
  }
}

export async function getCurrentLodgingRateController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const query = currentLodgingRateQuerySchema.parse(request.query ?? {});
    return reply.status(200).send(await getCurrentLodgingRate(query));
  } catch (error) {
    return handleLodgingRatesError(reply, error);
  }
}

export async function createLodgingRateController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const body = createLodgingRateBodySchema.parse(request.body);
    return reply.status(201).send(await createLodgingRate(body));
  } catch (error) {
    return handleLodgingRatesError(reply, error);
  }
}