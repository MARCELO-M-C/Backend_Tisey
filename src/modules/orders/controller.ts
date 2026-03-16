import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { getRequestUser } from "../auth/service";
import {
  addOrderItemsBodySchema,
  cancelOrderBodySchema,
  createOrderBodySchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
  orderItemParamsSchema,
  updateOrderBodySchema,
  updateOrderItemStatusBodySchema,
} from "./schemas";
import {
  OrdersServiceError,
  addItemsToOrder,
  cancelOrder,
  createOrder,
  getOrderById,
  listOrders,
  sendOrder,
  updateOrder,
  updateOrderItemStatus,
} from "./service";

function handleOrdersError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Payload inválido.",
      details: error.flatten(),
    });
  }

  if (error instanceof OrdersServiceError) {
    return reply.status(error.statusCode).send({
      message: error.message,
      code: error.code,
    });
  }

  throw error;
}

export async function listOrdersController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const query = listOrdersQuerySchema.parse(request.query ?? {});
    const orders = await listOrders(query);

    return reply.status(200).send(orders);
  } catch (error) {
    return handleOrdersError(reply, error);
  }
}

export async function getOrderByIdController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = orderIdParamSchema.parse(request.params);
    const order = await getOrderById(params.id);

    return reply.status(200).send(order);
  } catch (error) {
    return handleOrdersError(reply, error);
  }
}

export async function createOrderController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const body = createOrderBodySchema.parse(request.body);
    const currentUser = getRequestUser(request);

    const order = await createOrder(body, currentUser.sub);

    return reply.status(201).send(order);
  } catch (error) {
    return handleOrdersError(reply, error);
  }
}

export async function updateOrderController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = orderIdParamSchema.parse(request.params);
    const body = updateOrderBodySchema.parse(request.body);
    const currentUser = getRequestUser(request);

    const order = await updateOrder(params.id, body, currentUser.sub);

    return reply.status(200).send(order);
  } catch (error) {
    return handleOrdersError(reply, error);
  }
}

export async function addItemsToOrderController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = orderIdParamSchema.parse(request.params);
    const body = addOrderItemsBodySchema.parse(request.body);
    const currentUser = getRequestUser(request);

    const order = await addItemsToOrder(params.id, body, currentUser.sub);

    return reply.status(200).send(order);
  } catch (error) {
    return handleOrdersError(reply, error);
  }
}

export async function sendOrderController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = orderIdParamSchema.parse(request.params);
    const currentUser = getRequestUser(request);

    const order = await sendOrder(params.id, currentUser.sub);

    return reply.status(200).send(order);
  } catch (error) {
    return handleOrdersError(reply, error);
  }
}

export async function cancelOrderController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = orderIdParamSchema.parse(request.params);
    const body = cancelOrderBodySchema.parse(request.body);
    const currentUser = getRequestUser(request);

    const order = await cancelOrder(params.id, body, currentUser.sub);

    return reply.status(200).send(order);
  } catch (error) {
    return handleOrdersError(reply, error);
  }
}

export async function updateOrderItemStatusController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = orderItemParamsSchema.parse(request.params);
    const body = updateOrderItemStatusBodySchema.parse(request.body);
    const currentUser = getRequestUser(request);

    const order = await updateOrderItemStatus(
      params.id,
      params.itemId,
      body,
      currentUser.sub,
    );

    return reply.status(200).send(order);
  } catch (error) {
    return handleOrdersError(reply, error);
  }
}