import { z } from "zod";

const bigintIdSchema = z
  .union([
    z.string().trim().regex(/^\d+$/, "Debe ser un entero positivo."),
    z.number().int().positive(),
  ])
  .transform((value) => BigInt(value));

const dateTimeSchema = z
  .string()
  .trim()
  .datetime({ offset: true, message: "Debe ser una fecha ISO válida." })
  .transform((value) => new Date(value));

const moneySchema = z
  .union([
    z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Monto inválido."),
    z.number().positive(),
  ])
  .transform((value) =>
    typeof value === "number" ? value.toFixed(2) : value.trim(),
  );

const taxRateSchema = z
  .union([
    z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Porcentaje inválido."),
    z.number().min(0).max(100),
  ])
  .transform((value) =>
    typeof value === "number" ? value.toFixed(2) : value.trim(),
  );

const nullableTextSchema = (max: number) =>
  z.union([z.string().trim().min(1).max(max), z.null()]).optional();

const invoiceStatusSchema = z.enum(["ISSUED", "VOID"]);

const paymentMethodSchema = z.enum([
  "CASH",
  "CARD",
  "TRANSFER",
  "MIXED",
  "OTHER",
]);

const extraLineSchema = z
  .object({
    description: z.string().trim().min(1).max(160),
    quantity: z.number().int().positive().max(999),
    unitPrice: moneySchema,
  })
  .strict();

export const invoiceIdParamSchema = z
  .object({
    invoiceId: bigintIdSchema,
  })
  .strict();

export const listInvoicesQuerySchema = z
  .object({
    status: invoiceStatusSchema.optional(),
    orderId: bigintIdSchema.optional(),
    stayId: bigintIdSchema.optional(),
    from: dateTimeSchema.optional(),
    to: dateTimeSchema.optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (!data.from || !data.to) return true;
      return data.to >= data.from;
    },
    {
      message: "La fecha final debe ser mayor o igual a la fecha inicial.",
      path: ["to"],
    },
  );

export const createInvoiceFromOrderBodySchema = z
  .object({
    orderId: bigintIdSchema,
    taxRate: taxRateSchema.optional().default("0.00"),
    notes: nullableTextSchema(255),
    extraLines: z.array(extraLineSchema).optional().default([]),
  })
  .strict();

export const createInvoiceFromStayBodySchema = z
  .object({
    stayId: bigintIdSchema,
    includeRoomCharge: z.boolean().optional().default(true),
    includeRestaurantCharges: z.boolean().optional().default(true),
    taxRate: taxRateSchema.optional().default("0.00"),
    notes: nullableTextSchema(255),
    extraLines: z.array(extraLineSchema).optional().default([]),
  })
  .strict();

export const voidInvoiceBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(255).optional(),
  })
  .strict();

export const printInvoiceBodySchema = z
  .object({})
  .strict();

export const createPaymentBodySchema = z
  .object({
    method: paymentMethodSchema,
    amount: moneySchema,
    reference: nullableTextSchema(80),
    paidAt: dateTimeSchema.optional(),
  })
  .strict();

export type InvoiceIdParamsInput = z.infer<typeof invoiceIdParamSchema>;
export type ListInvoicesQueryInput = z.infer<typeof listInvoicesQuerySchema>;
export type CreateInvoiceFromOrderBodyInput = z.infer<
  typeof createInvoiceFromOrderBodySchema
>;
export type CreateInvoiceFromStayBodyInput = z.infer<
  typeof createInvoiceFromStayBodySchema
>;
export type VoidInvoiceBodyInput = z.infer<typeof voidInvoiceBodySchema>;
export type PrintInvoiceBodyInput = z.infer<typeof printInvoiceBodySchema>;
export type CreatePaymentBodyInput = z.infer<typeof createPaymentBodySchema>;