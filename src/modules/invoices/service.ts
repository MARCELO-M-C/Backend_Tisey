import { Prisma } from "@prisma/client";
import {
  toInvoiceResponse,
  toPaymentResponse,
  type InvoiceResponseDto,
  type PaymentResponseDto,
} from "./mapper";
import * as invoicesRepository from "./repository";
import {
  InvoiceLineSource,
  InvoiceStatus,
  OrderItemStatus,
  OrderStatus,
  PaymentMethod,
  StayStatus,
} from "./repository";
import type {
  CreateInvoiceFromOrderBodyInput,
  CreateInvoiceFromStayBodyInput,
  CreatePaymentBodyInput,
  ListInvoicesQueryInput,
  VoidInvoiceBodyInput,
} from "./schemas";

export class InvoicesServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "InvoicesServiceError";
  }
}

interface BuildLineInput {
  source: InvoiceLineSource;
  description: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  orderItemId?: bigint | null;
}

interface TotalsResult {
  subtotal: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
}

function parseUserId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new InvoicesServiceError(
      400,
      "INVALID_USER_ID",
      "Id de usuario inválido.",
    );
  }
}

function normalizeOptionalText(value?: string | null): string | null {
  if (typeof value === "undefined") return null;
  if (value === null) return null;

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function generateInvoiceCode(): string {
  const randomSuffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  return `FAC-${Date.now()}-${randomSuffix}`;
}

function calculateLineTotal(
  unitPrice: Prisma.Decimal,
  quantity: number,
): Prisma.Decimal {
  return unitPrice.mul(quantity);
}

function buildInvoiceLines(lines: BuildLineInput[]) {
  return lines.map((line) => ({
    source: line.source,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: calculateLineTotal(line.unitPrice, line.quantity),
    orderItemId: line.orderItemId ?? null,
  }));
}

function calculateTotals(
  lines: ReturnType<typeof buildInvoiceLines>,
  taxRate: string,
): TotalsResult {
  const subtotal = lines.reduce(
    (sum, line) => sum.plus(line.lineTotal),
    new Prisma.Decimal(0),
  );

  const tax = new Prisma.Decimal(
    subtotal.mul(new Prisma.Decimal(taxRate)).div(100).toFixed(2),
  );

  return {
    subtotal,
    tax,
    total: subtotal.plus(tax),
  };
}

function calculateAmountPaid(invoice: invoicesRepository.InvoiceRecord) {
  return invoice.payments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    new Prisma.Decimal(0),
  );
}

function calculateBalanceDue(invoice: invoicesRepository.InvoiceRecord) {
  const amountPaid = calculateAmountPaid(invoice);
  const balanceDue = invoice.total.minus(amountPaid);

  return balanceDue.lessThan(0) ? new Prisma.Decimal(0) : balanceDue;
}

function ensureInvoiceHasLines(
  lines: ReturnType<typeof buildInvoiceLines>,
): void {
  if (lines.length === 0) {
    throw new InvoicesServiceError(
      400,
      "INVOICE_HAS_NO_LINES",
      "La factura debe tener al menos una línea.",
    );
  }
}

async function ensureInvoiceExists(invoiceId: bigint) {
  const invoice = await invoicesRepository.findInvoiceById(invoiceId);

  if (!invoice) {
    throw new InvoicesServiceError(
      404,
      "INVOICE_NOT_FOUND",
      "Factura no encontrada.",
    );
  }

  return invoice;
}

function ensureInvoiceIsIssued(invoice: invoicesRepository.InvoiceRecord) {
  if (invoice.status !== InvoiceStatus.ISSUED) {
    throw new InvoicesServiceError(
      409,
      "INVOICE_NOT_PAYABLE",
      "La factura no está activa.",
    );
  }
}

function ensureOrderCanBeInvoiced(
  order: invoicesRepository.OrderForInvoiceRecord,
) {
  if (
    order.status !== OrderStatus.DELIVERED &&
    order.status !== OrderStatus.CLOSED
  ) {
    throw new InvoicesServiceError(
      409,
      "ORDER_NOT_READY_TO_INVOICE",
      "Sólo puedes facturar órdenes entregadas o cerradas.",
    );
  }

  const hasIssuedInvoice = order.invoices.some(
    (invoice) => invoice.status === InvoiceStatus.ISSUED,
  );

  if (hasIssuedInvoice) {
    throw new InvoicesServiceError(
      409,
      "ORDER_ALREADY_INVOICED",
      "La orden ya tiene una factura emitida.",
    );
  }
}

function ensureStayCanBeInvoiced(stay: invoicesRepository.StayForInvoiceRecord) {
  if (stay.status === StayStatus.CANCELLED) {
    throw new InvoicesServiceError(
      409,
      "STAY_CANCELLED",
      "No puedes facturar una estadía cancelada.",
    );
  }

  const hasIssuedStayInvoice = stay.invoices.some(
    (invoice) =>
      invoice.status === InvoiceStatus.ISSUED && invoice.orderId === null,
  );

  if (hasIssuedStayInvoice) {
    throw new InvoicesServiceError(
      409,
      "STAY_ALREADY_INVOICED",
      "La estadía ya tiene una factura de hospedaje emitida.",
    );
  }
}

function calculateNights(checkInDate: Date, checkOutDate: Date): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const diff = checkOutDate.getTime() - checkInDate.getTime();

  return Math.max(1, Math.ceil(diff / millisecondsPerDay));
}

export async function listInvoices(
  filters: ListInvoicesQueryInput,
): Promise<InvoiceResponseDto[]> {
  const invoices = await invoicesRepository.listInvoices({
    ...filters,
    status: filters.status as InvoiceStatus | undefined,
  });

  return invoices.map(toInvoiceResponse);
}

export async function getInvoiceById(
  invoiceId: bigint,
): Promise<InvoiceResponseDto> {
  const invoice = await ensureInvoiceExists(invoiceId);
  return toInvoiceResponse(invoice);
}

export async function createInvoiceFromOrder(
  input: CreateInvoiceFromOrderBodyInput,
  actorUserId: string,
): Promise<InvoiceResponseDto> {
  const issuedBy = parseUserId(actorUserId);

  const order = await invoicesRepository.findOrderForInvoiceById(input.orderId);

  if (!order) {
    throw new InvoicesServiceError(
      404,
      "ORDER_NOT_FOUND",
      "Orden no encontrada.",
    );
  }

  ensureOrderCanBeInvoiced(order);

  const orderLines: BuildLineInput[] = order.items
    .filter((item) => item.itemStatus !== OrderItemStatus.CANCELLED)
    .map((item) => ({
      source: InvoiceLineSource.RESTAURANT,
      description: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      orderItemId: item.id,
    }));

  const extraLines: BuildLineInput[] = input.extraLines.map((line) => ({
    source: InvoiceLineSource.EXTRA,
    description: line.description.trim(),
    quantity: line.quantity,
    unitPrice: new Prisma.Decimal(line.unitPrice),
  }));

  const invoiceLines = buildInvoiceLines([...orderLines, ...extraLines]);
  ensureInvoiceHasLines(invoiceLines);

  const totals = calculateTotals(invoiceLines, input.taxRate);

  const invoice = await invoicesRepository.createInvoice({
    invoiceCode: generateInvoiceCode(),
    issuedBy,
    orderId: order.id,
    stayId: order.stayId ?? null,
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    notes: normalizeOptionalText(input.notes),
    lines: invoiceLines,
  });

  return toInvoiceResponse(invoice);
}

export async function createInvoiceFromStay(
  input: CreateInvoiceFromStayBodyInput,
  actorUserId: string,
): Promise<InvoiceResponseDto> {
  const issuedBy = parseUserId(actorUserId);

  const stay = await invoicesRepository.findStayForInvoiceById(input.stayId);

  if (!stay) {
    throw new InvoicesServiceError(
      404,
      "STAY_NOT_FOUND",
      "Estadía no encontrada.",
    );
  }

  ensureStayCanBeInvoiced(stay);

  const lines: BuildLineInput[] = [];

  if (input.includeRoomCharge) {
    if (!stay.cabin.basePricePerNight) {
      throw new InvoicesServiceError(
        400,
        "CABIN_HAS_NO_BASE_PRICE",
        "La cabaña no tiene precio base por noche configurado.",
      );
    }

    const nights = calculateNights(stay.checkInDate, stay.checkOutDate);

    lines.push({
      source: InvoiceLineSource.ROOM,
      description: `Hospedaje cabaña ${stay.cabin.cabinNumber}`,
      quantity: nights,
      unitPrice: stay.cabin.basePricePerNight,
    });
  }

  if (input.includeRestaurantCharges) {
    for (const order of stay.orders) {
      const orderIsBillable =
        order.status === OrderStatus.DELIVERED ||
        order.status === OrderStatus.CLOSED;

      const orderAlreadyInvoiced = order.invoices.some(
        (invoice) => invoice.status === InvoiceStatus.ISSUED,
      );

      if (!orderIsBillable || orderAlreadyInvoiced) {
        continue;
      }

      for (const item of order.items) {
        if (item.itemStatus === OrderItemStatus.CANCELLED) {
          continue;
        }

        lines.push({
          source: InvoiceLineSource.RESTAURANT,
          description: `${order.orderCode} - ${item.itemName}`,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          orderItemId: item.id,
        });
      }
    }
  }

  for (const extraLine of input.extraLines) {
    lines.push({
      source: InvoiceLineSource.EXTRA,
      description: extraLine.description.trim(),
      quantity: extraLine.quantity,
      unitPrice: new Prisma.Decimal(extraLine.unitPrice),
    });
  }

  const invoiceLines = buildInvoiceLines(lines);
  ensureInvoiceHasLines(invoiceLines);

  const totals = calculateTotals(invoiceLines, input.taxRate);

  const invoice = await invoicesRepository.createInvoice({
    invoiceCode: generateInvoiceCode(),
    issuedBy,
    stayId: stay.id,
    orderId: null,
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    notes: normalizeOptionalText(input.notes),
    lines: invoiceLines,
  });

  return toInvoiceResponse(invoice);
}

export async function voidInvoice(
  invoiceId: bigint,
  input: VoidInvoiceBodyInput,
): Promise<InvoiceResponseDto> {
  const invoice = await ensureInvoiceExists(invoiceId);

  if (invoice.status === InvoiceStatus.VOID) {
    throw new InvoicesServiceError(
      409,
      "INVOICE_ALREADY_VOID",
      "La factura ya está anulada.",
    );
  }

  const amountPaid = calculateAmountPaid(invoice);

  if (amountPaid.greaterThan(0)) {
    throw new InvoicesServiceError(
      409,
      "INVOICE_HAS_PAYMENTS",
      "No puedes anular una factura que ya tiene pagos registrados.",
    );
  }

  const reason = normalizeOptionalText(input.reason);

  const updatedInvoice = await invoicesRepository.updateInvoice(invoiceId, {
    status: InvoiceStatus.VOID,
    notes: reason ? `ANULADA: ${reason}` : invoice.notes,
  });

  return toInvoiceResponse(updatedInvoice);
}

export async function printInvoice(
  invoiceId: bigint,
  actorUserId: string,
): Promise<InvoiceResponseDto> {
  const printedBy = parseUserId(actorUserId);
  const invoice = await ensureInvoiceExists(invoiceId);

  if (invoice.status === InvoiceStatus.VOID) {
    throw new InvoicesServiceError(
      409,
      "INVOICE_VOID",
      "No puedes imprimir una factura anulada.",
    );
  }

  const updatedInvoice = await invoicesRepository.updateInvoice(invoiceId, {
    printedAt: new Date(),
    printedByUser: {
      connect: {
        id: printedBy,
      },
    },
    printCount: {
      increment: 1,
    },
  });

  return toInvoiceResponse(updatedInvoice);
}

export async function listInvoicePayments(
  invoiceId: bigint,
): Promise<PaymentResponseDto[]> {
  await ensureInvoiceExists(invoiceId);

  const payments = await invoicesRepository.listPaymentsByInvoice(invoiceId);

  return payments.map(toPaymentResponse);
}

export async function createPayment(
  invoiceId: bigint,
  input: CreatePaymentBodyInput,
  actorUserId: string,
): Promise<InvoiceResponseDto> {
  const receivedBy = parseUserId(actorUserId);
  const invoice = await ensureInvoiceExists(invoiceId);

  ensureInvoiceIsIssued(invoice);

  const amount = new Prisma.Decimal(input.amount);
  const balanceDue = calculateBalanceDue(invoice);

  if (balanceDue.lessThanOrEqualTo(0)) {
    throw new InvoicesServiceError(
      409,
      "INVOICE_ALREADY_PAID",
      "La factura ya está completamente pagada.",
    );
  }

  if (amount.greaterThan(balanceDue)) {
    throw new InvoicesServiceError(
      400,
      "PAYMENT_EXCEEDS_BALANCE",
      "El pago supera el saldo pendiente de la factura.",
    );
  }

  const updatedInvoice = await invoicesRepository.createPayment({
    invoiceId,
    method: input.method as PaymentMethod,
    amount,
    reference: normalizeOptionalText(input.reference),
    paidAt: input.paidAt,
    receivedBy,
  });

  return toInvoiceResponse(updatedInvoice);
}