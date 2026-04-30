import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { getRequestUser } from "../auth/service";
import {
  createInvoiceFromOrderBodySchema,
  createInvoiceFromStayBodySchema,
  createPaymentBodySchema,
  invoiceIdParamSchema,
  listInvoicesQuerySchema,
  printInvoiceBodySchema,
  voidInvoiceBodySchema,
} from "./schemas";
import {
  InvoicesServiceError,
  createInvoiceFromOrder,
  createInvoiceFromStay,
  createPayment,
  getInvoiceById,
  listInvoicePayments,
  listInvoices,
  printInvoice,
  voidInvoice,
} from "./service";

function handleInvoicesError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Payload inválido.",
      details: error.flatten(),
    });
  }

  if (error instanceof InvoicesServiceError) {
    return reply.status(error.statusCode).send({
      message: error.message,
      code: error.code,
    });
  }

  throw error;
}

export async function listInvoicesController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const query = listInvoicesQuerySchema.parse(request.query ?? {});
    const invoices = await listInvoices(query);

    return reply.status(200).send(invoices);
  } catch (error) {
    return handleInvoicesError(reply, error);
  }
}

export async function getInvoiceByIdController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = invoiceIdParamSchema.parse(request.params);
    const invoice = await getInvoiceById(params.invoiceId);

    return reply.status(200).send(invoice);
  } catch (error) {
    return handleInvoicesError(reply, error);
  }
}

export async function createInvoiceFromOrderController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const body = createInvoiceFromOrderBodySchema.parse(request.body);
    const currentUser = getRequestUser(request);
    const invoice = await createInvoiceFromOrder(body, currentUser.sub);

    return reply.status(201).send(invoice);
  } catch (error) {
    return handleInvoicesError(reply, error);
  }
}

export async function createInvoiceFromStayController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const body = createInvoiceFromStayBodySchema.parse(request.body);
    const currentUser = getRequestUser(request);
    const invoice = await createInvoiceFromStay(body, currentUser.sub);

    return reply.status(201).send(invoice);
  } catch (error) {
    return handleInvoicesError(reply, error);
  }
}

export async function voidInvoiceController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = invoiceIdParamSchema.parse(request.params);
    const body = voidInvoiceBodySchema.parse(request.body ?? {});
    const invoice = await voidInvoice(params.invoiceId, body);

    return reply.status(200).send(invoice);
  } catch (error) {
    return handleInvoicesError(reply, error);
  }
}

export async function printInvoiceController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = invoiceIdParamSchema.parse(request.params);
    printInvoiceBodySchema.parse(request.body ?? {});

    const currentUser = getRequestUser(request);
    const invoice = await printInvoice(params.invoiceId, currentUser.sub);

    return reply.status(200).send(invoice);
  } catch (error) {
    return handleInvoicesError(reply, error);
  }
}

export async function listInvoicePaymentsController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = invoiceIdParamSchema.parse(request.params);
    const payments = await listInvoicePayments(params.invoiceId);

    return reply.status(200).send(payments);
  } catch (error) {
    return handleInvoicesError(reply, error);
  }
}

export async function createPaymentController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const params = invoiceIdParamSchema.parse(request.params);
    const body = createPaymentBodySchema.parse(request.body);
    const currentUser = getRequestUser(request);
    const invoice = await createPayment(params.invoiceId, body, currentUser.sub);

    return reply.status(201).send(invoice);
  } catch (error) {
    return handleInvoicesError(reply, error);
  }
}