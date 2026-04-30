import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  cabinIdParamSchema,
  createCabinBodySchema,
  listCabinsQuerySchema,
  updateCabinActiveBodySchema,
  updateCabinBodySchema,
  updateCabinStatusBodySchema,
} from "./schemas";
import {
  CabinsServiceError,
  createCabin,
  getCabinById,
  listCabins,
  updateCabin,
  updateCabinActiveStatus,
  updateCabinStatus,
} from "./service";

function handleCabinsError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Payload inválido.",
      details: error.flatten(),
    });
  }

  if (error instanceof CabinsServiceError) {
    return reply.status(error.statusCode).send({
      message: error.message,
      code: error.code,
    });
  }

  throw error;
}

export async function listCabinsController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const query = listCabinsQuerySchema.parse(request.query ?? {});
    const cabins = await listCabins(query);

    return reply.status(200).send(cabins);
  } catch (error) {
    return handleCabinsError(reply, error);
  }
}

export async function getCabinByIdController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = cabinIdParamSchema.parse(request.params);
    const cabin = await getCabinById(params.cabinId);

    return reply.status(200).send(cabin);
  } catch (error) {
    return handleCabinsError(reply, error);
  }
}

export async function createCabinController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const body = createCabinBodySchema.parse(request.body);
    const cabin = await createCabin(body);

    return reply.status(201).send(cabin);
  } catch (error) {
    return handleCabinsError(reply, error);
  }
}

export async function updateCabinController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = cabinIdParamSchema.parse(request.params);
    const body = updateCabinBodySchema.parse(request.body);
    const cabin = await updateCabin(params.cabinId, body);

    return reply.status(200).send(cabin);
  } catch (error) {
    return handleCabinsError(reply, error);
  }
}

export async function updateCabinStatusController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = cabinIdParamSchema.parse(request.params);
    const body = updateCabinStatusBodySchema.parse(request.body);
    const cabin = await updateCabinStatus(params.cabinId, body);

    return reply.status(200).send(cabin);
  } catch (error) {
    return handleCabinsError(reply, error);
  }
}

export async function updateCabinActiveStatusController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = cabinIdParamSchema.parse(request.params);
    const body = updateCabinActiveBodySchema.parse(request.body);
    const cabin = await updateCabinActiveStatus(params.cabinId, body);

    return reply.status(200).send(cabin);
  } catch (error) {
    return handleCabinsError(reply, error);
  }
}