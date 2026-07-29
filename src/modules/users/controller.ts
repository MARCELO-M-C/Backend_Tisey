import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  createUserBodySchema,
  listUsersQuerySchema,
  replaceUserPermissionsBodySchema,
  replaceUserRolesBodySchema,
  updateUserBodySchema,
  updateUserStatusBodySchema,
  userIdParamSchema,
} from "./schemas";
import {
  UsersServiceError,
  createUser,
  getUserById,
  listUsers,
  replaceUserPermissions,
  replaceUserRoles,
  updateUser,
  updateUserStatus,
  type UserManagementActor,
} from "./service";

function handleUsersError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Payload inválido.",
      details: error.flatten(),
    });
  }

  if (error instanceof UsersServiceError) {
    return reply.status(error.statusCode).send({
      message: error.message,
      code: error.code,
    });
  }

  throw error;
}

function getUserManagementActor(
  request: FastifyRequest,
): UserManagementActor {
  return {
    roles: request.user.roles,
    permissions: request.user.permissions,
  };
}

export async function listUsersController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const query = listUsersQuerySchema.parse(request.query ?? {});
    const actor = getUserManagementActor(request);
    const users = await listUsers(query, actor);

    return reply.status(200).send(users);
  } catch (error) {
    return handleUsersError(reply, error);
  }
}
export async function getUserByIdController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = userIdParamSchema.parse(request.params);
    const user = await getUserById(params.id);

    return reply.status(200).send(user);
  } catch (error) {
    return handleUsersError(reply, error);
  }
}
export async function createUserController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const body = createUserBodySchema.parse(request.body);
    const actor = getUserManagementActor(request);
    const user = await createUser(body, actor);

    return reply.status(201).send(user);
  } catch (error) {
    return handleUsersError(reply, error);
  }
}
export async function updateUserController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = userIdParamSchema.parse(request.params);
    const body = updateUserBodySchema.parse(request.body);
    const actor = getUserManagementActor(request);
    const user = await updateUser(params.id, body, actor);

    return reply.status(200).send(user);
  } catch (error) {
    return handleUsersError(reply, error);
  }
}
export async function replaceUserRolesController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = userIdParamSchema.parse(request.params);
    const body = replaceUserRolesBodySchema.parse(request.body);
    const actor = getUserManagementActor(request);
    const user = await replaceUserRoles(params.id, body, actor);

    return reply.status(200).send(user);
  } catch (error) {
    return handleUsersError(reply, error);
  }
}
export async function replaceUserPermissionsController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = userIdParamSchema.parse(request.params);
    const body = replaceUserPermissionsBodySchema.parse(request.body);
    const grantedBy = BigInt(request.user.sub);

    const user = await replaceUserPermissions(
      params.id,
      body,
      grantedBy,
    );

    return reply.status(200).send(user);
  } catch (error) {
    return handleUsersError(reply, error);
  }
}
export async function updateUserStatusController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = userIdParamSchema.parse(request.params);
    const body = updateUserStatusBodySchema.parse(request.body);
    const actor = getUserManagementActor(request);

    const user = await updateUserStatus(
      params.id,
      body,
      actor,
    );

    return reply.status(200).send(user);
  } catch (error) {
    return handleUsersError(reply, error);
  }
}
