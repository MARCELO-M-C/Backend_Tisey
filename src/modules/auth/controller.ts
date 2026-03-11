import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { env } from "../../config/env";
import { loginBodySchema } from "./schemas";
import {
  AuthServiceError,
  getCurrentUser,
  getRequestUser,
  login,
} from "./service";

function handleAuthError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Payload inválido.",
      details: error.flatten(),
    });
  }

  if (error instanceof AuthServiceError) {
    return reply.status(error.statusCode).send({
      message: error.message,
      code: error.code,
    });
  }

  throw error;
}

export async function loginController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const body = loginBodySchema.parse(request.body);

    const result = await login(
      body,
      (payload) => request.server.jwt.sign(payload),
      env.JWT_EXPIRES_IN,
    );

    return reply.status(200).send(result);
  } catch (error) {
    return handleAuthError(reply, error);
  }
}

export async function meController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const currentUser = getRequestUser(request);
    const user = await getCurrentUser(currentUser.sub);

    return reply.status(200).send(user);
  } catch (error) {
    return handleAuthError(reply, error);
  }
}