import { Prisma } from "@prisma/client";
import type { InvoiceRecord, PaymentRecord } from "./repository";

export interface UserSummaryDto {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  isActive: boolean;
}

export interface InvoiceLineResponseDto {
  id: string;
  source: string;
  description: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  orderItemId: string | null;
  createdAt: string;
}

export interface PaymentResponseDto {
  id: string;
  invoiceId: string;
  method: string;
  amount: string;
  reference: string | null;
  paidAt: string;
  receivedByUser: UserSummaryDto;
}

export interface InvoiceResponseDto {
  id: string;
  invoiceCode: string;
  status: string;
  issuedAt: string;
  subtotal: string;
  tax: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  isPaid: boolean;
  notes: string | null;
  printedAt: string | null;
  printCount: number;
  issuedByUser: UserSummaryDto;
  printedByUser: UserSummaryDto | null;
  order: {
    id: string;
    orderCode: string;
    channel: string;
    serviceMode: string;
    status: string;
    createdAt: string;
  } | null;
  stay: {
    id: string;
    checkInDate: string;
    checkOutDate: string;
    status: string;
    cabin: {
      id: string;
      cabinNumber: number;
      name: string | null;
      capacity: number;
      basePricePerNight: string | null;
    };
    primaryGuest: {
      id: string;
      fullName: string;
      idNumber: string | null;
    };
  } | null;
  lines: InvoiceLineResponseDto[];
  payments: PaymentResponseDto[];
}

function toUserSummary(record: {
  id: bigint;
  username: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}): UserSummaryDto {
  return {
    id: record.id.toString(),
    username: record.username,
    firstName: record.firstName,
    lastName: record.lastName,
    fullName: `${record.firstName} ${record.lastName}`,
    isActive: record.isActive,
  };
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function toPaymentResponse(record: PaymentRecord): PaymentResponseDto {
  return {
    id: record.id.toString(),
    invoiceId: record.invoiceId.toString(),
    method: record.method,
    amount: record.amount.toFixed(2),
    reference: record.reference,
    paidAt: record.paidAt.toISOString(),
    receivedByUser: toUserSummary(record.receivedByUser),
  };
}

export function toInvoiceResponse(record: InvoiceRecord): InvoiceResponseDto {
  const amountPaid = record.payments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    new Prisma.Decimal(0),
  );

  const balanceDue = record.total.minus(amountPaid);

  return {
    id: record.id.toString(),
    invoiceCode: record.invoiceCode,
    status: record.status,
    issuedAt: record.issuedAt.toISOString(),
    subtotal: record.subtotal.toFixed(2),
    tax: record.tax.toFixed(2),
    total: record.total.toFixed(2),
    amountPaid: amountPaid.toFixed(2),
    balanceDue: balanceDue.lessThan(0) ? "0.00" : balanceDue.toFixed(2),
    isPaid: balanceDue.lessThanOrEqualTo(0),
    notes: record.notes,
    printedAt: record.printedAt ? record.printedAt.toISOString() : null,
    printCount: record.printCount,
    issuedByUser: toUserSummary(record.issuedByUser),
    printedByUser: record.printedByUser
      ? toUserSummary(record.printedByUser)
      : null,
    order: record.order
      ? {
          id: record.order.id.toString(),
          orderCode: record.order.orderCode,
          channel: record.order.channel,
          serviceMode: record.order.serviceMode,
          status: record.order.status,
          createdAt: record.order.createdAt.toISOString(),
        }
      : null,
    stay: record.stay
      ? {
          id: record.stay.id.toString(),
          checkInDate: toDateOnly(record.stay.checkInDate),
          checkOutDate: toDateOnly(record.stay.checkOutDate),
          status: record.stay.status,
          cabin: {
            id: record.stay.cabin.id.toString(),
            cabinNumber: record.stay.cabin.cabinNumber,
            name: record.stay.cabin.name,
            capacity: record.stay.cabin.capacity,
            basePricePerNight: record.stay.cabin.basePricePerNight
              ? record.stay.cabin.basePricePerNight.toFixed(2)
              : null,
          },
          primaryGuest: {
            id: record.stay.primaryGuest.id.toString(),
            fullName: record.stay.primaryGuest.fullName,
            idNumber: record.stay.primaryGuest.idNumber,
          },
        }
      : null,
    lines: record.lines.map((line) => ({
      id: line.id.toString(),
      source: line.source,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice.toFixed(2),
      lineTotal: line.lineTotal.toFixed(2),
      orderItemId: line.orderItemId ? line.orderItemId.toString() : null,
      createdAt: line.createdAt.toISOString(),
    })),
    payments: record.payments.map((payment) => ({
      id: payment.id.toString(),
      invoiceId: payment.invoiceId.toString(),
      method: payment.method,
      amount: payment.amount.toFixed(2),
      reference: payment.reference,
      paidAt: payment.paidAt.toISOString(),
      receivedByUser: toUserSummary(payment.receivedByUser),
    })),
  };
}