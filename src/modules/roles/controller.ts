import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  listRolesQuerySchema,
  roleIdParamSchema,
} from "./schemas";
import {
  RolesServiceError,
  getRoleById,
  listPermissions,
  listRoles,
} from "./service";

function handleRolesError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Payload inválido.",
      details: error.flatten(),
    });
  }

  if (error instanceof RolesServiceError) {
    return reply.status(error.statusCode).send({
      message: error.message,
      code: error.code,
    });
  }

  throw error;
}

export async function listRolesController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const query = listRolesQuerySchema.parse(
      request.query ?? {},
    );

    const roles = await listRoles(query);
    return reply.status(200).send(roles);
  } catch (error) {
    return handleRolesError(reply, error);
  }
}

export async function listPermissionsController(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const permissions = await listPermissions();
    return reply.status(200).send(permissions);
  } catch (error) {
    return handleRolesError(reply, error);
  }
}

export async function getRoleByIdController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = roleIdParamSchema.parse(request.params);
    const role = await getRoleById(params.roleId);

    return reply.status(200).send(role);
  } catch (error) {
    return handleRolesError(reply, error);
  }
}
