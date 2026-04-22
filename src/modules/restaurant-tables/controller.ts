import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  createRestaurantTableBodySchema,
  listRestaurantTablesQuerySchema,
  restaurantTableIdParamSchema,
  updateRestaurantTableBodySchema,
  updateRestaurantTableStatusBodySchema,
} from "./schemas";
import {
  RestaurantTablesServiceError,
  createRestaurantTable,
  getRestaurantTableById,
  listRestaurantTables,
  updateRestaurantTable,
  updateRestaurantTableStatus,
} from "./service";

function handleRestaurantTablesError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Payload inválido.",
      details: error.flatten(),
    });
  }

  if (error instanceof RestaurantTablesServiceError) {
    return reply.status(error.statusCode).send({
      message: error.message,
      code: error.code,
    });
  }

  throw error;
}

export async function listRestaurantTablesController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const query = listRestaurantTablesQuerySchema.parse(request.query ?? {});
    const tables = await listRestaurantTables(query);

    return reply.status(200).send(tables);
  } catch (error) {
    return handleRestaurantTablesError(reply, error);
  }
}

export async function getRestaurantTableByIdController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = restaurantTableIdParamSchema.parse(request.params);
    const table = await getRestaurantTableById(params.tableId);

    return reply.status(200).send(table);
  } catch (error) {
    return handleRestaurantTablesError(reply, error);
  }
}

export async function createRestaurantTableController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const body = createRestaurantTableBodySchema.parse(request.body);
    const table = await createRestaurantTable(body);

    return reply.status(201).send(table);
  } catch (error) {
    return handleRestaurantTablesError(reply, error);
  }
}

export async function updateRestaurantTableController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = restaurantTableIdParamSchema.parse(request.params);
    const body = updateRestaurantTableBodySchema.parse(request.body);
    const table = await updateRestaurantTable(params.tableId, body);

    return reply.status(200).send(table);
  } catch (error) {
    return handleRestaurantTablesError(reply, error);
  }
}

export async function updateRestaurantTableStatusController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = restaurantTableIdParamSchema.parse(request.params);
    const body = updateRestaurantTableStatusBodySchema.parse(request.body);
    const table = await updateRestaurantTableStatus(params.tableId, body);

    return reply.status(200).send(table);
  } catch (error) {
    return handleRestaurantTablesError(reply, error);
  }
}