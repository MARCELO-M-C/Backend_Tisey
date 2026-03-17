import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  categoryIdParamSchema,
  createCategoryBodySchema,
  createMenuItemBodySchema,
  itemIdParamSchema,
  listCategoriesQuerySchema,
  listMenuItemsQuerySchema,
  listStationsQuerySchema,
  updateCategoryBodySchema,
  updateCategoryStatusBodySchema,
  updateMenuItemBodySchema,
  updateMenuItemStatusBodySchema,
} from "./schemas";
import {
  MenuServiceError,
  createCategory,
  createMenuItem,
  getCategoryById,
  getMenuItemById,
  listCategories,
  listMenuItems,
  listStations,
  updateCategory,
  updateCategoryStatus,
  updateMenuItem,
  updateMenuItemStatus,
} from "./service";

function handleMenuError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Payload inválido.",
      details: error.flatten(),
    });
  }

  if (error instanceof MenuServiceError) {
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
    return handleMenuError(reply, error);
  }
}

export async function listCategoriesController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const query = listCategoriesQuerySchema.parse(request.query ?? {});
    const categories = await listCategories(query);

    return reply.status(200).send(categories);
  } catch (error) {
    return handleMenuError(reply, error);
  }
}

export async function getCategoryByIdController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = categoryIdParamSchema.parse(request.params);
    const category = await getCategoryById(params.categoryId);

    return reply.status(200).send(category);
  } catch (error) {
    return handleMenuError(reply, error);
  }
}

export async function createCategoryController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const body = createCategoryBodySchema.parse(request.body);
    const category = await createCategory(body);

    return reply.status(201).send(category);
  } catch (error) {
    return handleMenuError(reply, error);
  }
}

export async function updateCategoryController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = categoryIdParamSchema.parse(request.params);
    const body = updateCategoryBodySchema.parse(request.body);
    const category = await updateCategory(params.categoryId, body);

    return reply.status(200).send(category);
  } catch (error) {
    return handleMenuError(reply, error);
  }
}

export async function updateCategoryStatusController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = categoryIdParamSchema.parse(request.params);
    const body = updateCategoryStatusBodySchema.parse(request.body);
    const category = await updateCategoryStatus(params.categoryId, body);

    return reply.status(200).send(category);
  } catch (error) {
    return handleMenuError(reply, error);
  }
}

export async function listMenuItemsController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const query = listMenuItemsQuerySchema.parse(request.query ?? {});
    const items = await listMenuItems(query);

    return reply.status(200).send(items);
  } catch (error) {
    return handleMenuError(reply, error);
  }
}

export async function getMenuItemByIdController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = itemIdParamSchema.parse(request.params);
    const item = await getMenuItemById(params.itemId);

    return reply.status(200).send(item);
  } catch (error) {
    return handleMenuError(reply, error);
  }
}

export async function createMenuItemController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const body = createMenuItemBodySchema.parse(request.body);
    const item = await createMenuItem(body);

    return reply.status(201).send(item);
  } catch (error) {
    return handleMenuError(reply, error);
  }
}

export async function updateMenuItemController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = itemIdParamSchema.parse(request.params);
    const body = updateMenuItemBodySchema.parse(request.body);
    const item = await updateMenuItem(params.itemId, body);

    return reply.status(200).send(item);
  } catch (error) {
    return handleMenuError(reply, error);
  }
}

export async function updateMenuItemStatusController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = itemIdParamSchema.parse(request.params);
    const body = updateMenuItemStatusBodySchema.parse(request.body);
    const item = await updateMenuItemStatus(params.itemId, body);

    return reply.status(200).send(item);
  } catch (error) {
    return handleMenuError(reply, error);
  }
}