import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  createStationBodySchema,
  listStationsQuerySchema,
  stationIdParamSchema,
  updateStationBodySchema,
  updateStationStatusBodySchema,
} from "./schemas";
import {
  StationsServiceError,
  createStation,
  getStationById,
  listStations,
  updateStation,
  updateStationStatus,
} from "./service";

function handleStationsError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Payload inválido.",
      details: error.flatten(),
    });
  }

  if (error instanceof StationsServiceError) {
    return reply.status(error.statusCode).send({
      message: error.message,
      code: error.code,
    });
  }

  throw error;
}

export async function listStationsController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const query = listStationsQuerySchema.parse(request.query ?? {});
    const stations = await listStations(query);

    return reply.status(200).send(stations);
  } catch (error) {
    return handleStationsError(reply, error);
  }
}

export async function getStationByIdController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = stationIdParamSchema.parse(request.params);
    const station = await getStationById(params.stationId);

    return reply.status(200).send(station);
  } catch (error) {
    return handleStationsError(reply, error);
  }
}

export async function createStationController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const body = createStationBodySchema.parse(request.body);
    const station = await createStation(body);

    return reply.status(201).send(station);
  } catch (error) {
    return handleStationsError(reply, error);
  }
}

export async function updateStationController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = stationIdParamSchema.parse(request.params);
    const body = updateStationBodySchema.parse(request.body);
    const station = await updateStation(params.stationId, body);

    return reply.status(200).send(station);
  } catch (error) {
    return handleStationsError(reply, error);
  }
}

export async function updateStationStatusController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = stationIdParamSchema.parse(request.params);
    const body = updateStationStatusBodySchema.parse(request.body);
    const station = await updateStationStatus(params.stationId, body);

    return reply.status(200).send(station);
  } catch (error) {
    return handleStationsError(reply, error);
  }
}