import {
  InvoiceLineSource,
  InvoiceStatus,
  OrderItemStatus,
  OrderStatus,
  PaymentMethod,
  Prisma,
  StayStatus,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";

const userSummarySelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  isActive: true,
} satisfies Prisma.UserSelect;

const guestSummarySelect = {
  id: true,
  fullName: true,
  idNumber: true,
} satisfies Prisma.GuestSelect;

const cabinSummarySelect = {
  id: true,
  cabinNumber: true,
  name: true,
  capacity: true,
  basePricePerNight: true,
} satisfies Prisma.CabinSelect;

const invoiceLineSelect = {
  id: true,
  source: true,
  description: true,
  quantity: true,
  unitPrice: true,
  lineTotal: true,
  orderItemId: true,
  createdAt: true,
} satisfies Prisma.InvoiceLineSelect;

const paymentSelect = Prisma.validator<Prisma.PaymentDefaultArgs>()({
  select: {
    id: true,
    invoiceId: true,
    method: true,
    amount: true,
    reference: true,
    paidAt: true,
    receivedBy: true,
    receivedByUser: {
      select: userSummarySelect,
    },
  },
});

const invoiceSelect = Prisma.validator<Prisma.InvoiceDefaultArgs>()({
  select: {
    id: true,
    invoiceCode: true,
    status: true,
    issuedBy: true,
    issuedAt: true,
    orderId: true,
    stayId: true,
    subtotal: true,
    tax: true,
    total: true,
    notes: true,
    printedAt: true,
    printedBy: true,
    printCount: true,
    issuedByUser: {
      select: userSummarySelect,
    },
    printedByUser: {
      select: userSummarySelect,
    },
    order: {
      select: {
        id: true,
        orderCode: true,
        channel: true,
        serviceMode: true,
        status: true,
        createdAt: true,
      },
    },
    stay: {
      select: {
        id: true,
        checkInDate: true,
        checkOutDate: true,
        status: true,
        cabin: {
          select: cabinSummarySelect,
        },
        primaryGuest: {
          select: guestSummarySelect,
        },
      },
    },
    lines: {
      select: invoiceLineSelect,
      orderBy: {
        id: "asc",
      },
    },
    payments: {
      select: {
        id: true,
        invoiceId: true,
        method: true,
        amount: true,
        reference: true,
        paidAt: true,
        receivedBy: true,
        receivedByUser: {
          select: userSummarySelect,
        },
      },
      orderBy: {
        paidAt: "asc",
      },
    },
  },
});

const orderForInvoiceSelect = Prisma.validator<Prisma.OrderDefaultArgs>()({
  select: {
    id: true,
    orderCode: true,
    channel: true,
    serviceMode: true,
    status: true,
    stayId: true,
    items: {
      select: {
        id: true,
        itemName: true,
        unitPrice: true,
        quantity: true,
        itemStatus: true,
      },
      orderBy: {
        id: "asc",
      },
    },
    invoices: {
      select: {
        id: true,
        status: true,
      },
    },
  },
});

const stayForInvoiceSelect = Prisma.validator<Prisma.StayDefaultArgs>()({
  select: {
    id: true,
    checkInDate: true,
    checkOutDate: true,
    status: true,
    cabin: {
      select: cabinSummarySelect,
    },
    primaryGuest: {
      select: guestSummarySelect,
    },
    invoices: {
      select: {
        id: true,
        status: true,
        orderId: true,
      },
    },
    orders: {
      select: {
        id: true,
        orderCode: true,
        status: true,
        invoices: {
          select: {
            id: true,
            status: true,
          },
        },
        items: {
          select: {
            id: true,
            itemName: true,
            unitPrice: true,
            quantity: true,
            itemStatus: true,
          },
          orderBy: {
            id: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    },
  },
});

export type InvoiceRecord = Prisma.InvoiceGetPayload<typeof invoiceSelect>;
export type PaymentRecord = Prisma.PaymentGetPayload<typeof paymentSelect>;
export type OrderForInvoiceRecord = Prisma.OrderGetPayload<
  typeof orderForInvoiceSelect
>;
export type StayForInvoiceRecord = Prisma.StayGetPayload<
  typeof stayForInvoiceSelect
>;

export interface ListInvoicesFilters {
  status?: InvoiceStatus;
  orderId?: bigint;
  stayId?: bigint;
  from?: Date;
  to?: Date;
}

export interface CreateInvoiceLineRepositoryInput {
  source: InvoiceLineSource;
  description: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  orderItemId?: bigint | null;
}

export interface CreateInvoiceRepositoryInput {
  invoiceCode: string;
  issuedBy: bigint;
  orderId?: bigint | null;
  stayId?: bigint | null;
  subtotal: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
  notes?: string | null;
  lines: CreateInvoiceLineRepositoryInput[];
}

export interface CreatePaymentRepositoryInput {
  invoiceId: bigint;
  method: PaymentMethod;
  amount: Prisma.Decimal;
  reference?: string | null;
  paidAt?: Date;
  receivedBy: bigint;
}

export async function listInvoices(
  filters: ListInvoicesFilters,
): Promise<InvoiceRecord[]> {
  return prisma.invoice.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.orderId ? { orderId: filters.orderId } : {}),
      ...(filters.stayId ? { stayId: filters.stayId } : {}),
      ...(filters.from || filters.to
        ? {
            issuedAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ issuedAt: "desc" }],
    ...invoiceSelect,
  });
}

export async function findInvoiceById(
  invoiceId: bigint,
): Promise<InvoiceRecord | null> {
  return prisma.invoice.findUnique({
    where: { id: invoiceId },
    ...invoiceSelect,
  });
}

export async function findOrderForInvoiceById(
  orderId: bigint,
): Promise<OrderForInvoiceRecord | null> {
  return prisma.order.findUnique({
    where: { id: orderId },
    ...orderForInvoiceSelect,
  });
}

export async function findStayForInvoiceById(
  stayId: bigint,
): Promise<StayForInvoiceRecord | null> {
  return prisma.stay.findUnique({
    where: { id: stayId },
    ...stayForInvoiceSelect,
  });
}

export async function createInvoice(
  data: CreateInvoiceRepositoryInput,
): Promise<InvoiceRecord> {
  return prisma.invoice.create({
    data: {
      invoiceCode: data.invoiceCode,
      issuedBy: data.issuedBy,
      orderId: data.orderId ?? null,
      stayId: data.stayId ?? null,
      subtotal: data.subtotal,
      tax: data.tax,
      total: data.total,
      notes: data.notes ?? null,
      lines: {
        create: data.lines.map((line) => ({
          source: line.source,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          orderItemId: line.orderItemId ?? null,
        })),
      },
    },
    ...invoiceSelect,
  });
}

export async function updateInvoice(
  invoiceId: bigint,
  data: Prisma.InvoiceUpdateInput,
): Promise<InvoiceRecord> {
  return prisma.invoice.update({
    where: { id: invoiceId },
    data,
    ...invoiceSelect,
  });
}

export async function listPaymentsByInvoice(
  invoiceId: bigint,
): Promise<PaymentRecord[]> {
  return prisma.payment.findMany({
    where: {
      invoiceId,
    },
    orderBy: [{ paidAt: "asc" }],
    ...paymentSelect,
  });
}

export async function createPayment(
  data: CreatePaymentRepositoryInput,
): Promise<InvoiceRecord> {
  await prisma.payment.create({
    data: {
      invoiceId: data.invoiceId,
      method: data.method,
      amount: data.amount,
      reference: data.reference ?? null,
      ...(data.paidAt ? { paidAt: data.paidAt } : {}),
      receivedBy: data.receivedBy,
    },
  });

  return prisma.invoice.findUniqueOrThrow({
    where: { id: data.invoiceId },
    ...invoiceSelect,
  });
}

export {
  InvoiceLineSource,
  InvoiceStatus,
  OrderItemStatus,
  OrderStatus,
  PaymentMethod,
  StayStatus,
};