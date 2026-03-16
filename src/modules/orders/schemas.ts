import {
  OrderChannel,
  OrderItemStatus,
  OrderStatus,
  ServiceMode,
} from "@prisma/client";
import { z } from "zod";

const bigintIdSchema = z
  .union([
    z.string().trim().regex(/^\d+$/, "Debe ser un entero positivo."),
    z.number().int().positive(),
  ])
  .transform((value) => BigInt(value));

const nullableBigintIdSchema = bigintIdSchema.nullable();

export const orderIdParamSchema = z
  .object({
    id: bigintIdSchema,
  })
  .strict();

export const orderItemParamsSchema = z
  .object({
    id: bigintIdSchema,
    itemId: bigintIdSchema,
  })
  .strict();

export const listOrdersQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(30).optional(),
    status: z.nativeEnum(OrderStatus).optional(),
    channel: z.nativeEnum(OrderChannel).optional(),
    waiterId: bigintIdSchema.optional(),
    tableId: bigintIdSchema.optional(),
    stayId: bigintIdSchema.optional(),
    createdBy: bigintIdSchema.optional(),
    shiftId: bigintIdSchema.optional(),
  })
  .strict();

export const createOrderItemInputSchema = z
  .object({
    menuItemId: bigintIdSchema,
    quantity: z.number().int().positive().max(999).default(1),
    itemNotes: z.string().trim().max(255).optional(),
  })
  .strict();

export const createOrderBodySchema = z
  .object({
    channel: z.nativeEnum(OrderChannel),
    serviceMode: z.nativeEnum(ServiceMode),
    tableId: bigintIdSchema.optional(),
    stayId: bigintIdSchema.optional(),
    waiterId: bigintIdSchema.optional(),
    shiftId: bigintIdSchema.optional(),
    notes: z.string().trim().max(500).optional(),
    items: z.array(createOrderItemInputSchema).min(1),
  })
  .strict();

export const updateOrderBodySchema = z
  .object({
    channel: z.nativeEnum(OrderChannel).optional(),
    serviceMode: z.nativeEnum(ServiceMode).optional(),
    tableId: nullableBigintIdSchema.optional(),
    stayId: nullableBigintIdSchema.optional(),
    waiterId: nullableBigintIdSchema.optional(),
    shiftId: nullableBigintIdSchema.optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debes enviar al menos un campo para actualizar.",
  });

export const addOrderItemsBodySchema = z
  .object({
    items: z.array(createOrderItemInputSchema).min(1),
  })
  .strict();

export const cancelOrderBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(255),
  })
  .strict();

export const updateOrderItemStatusBodySchema = z
  .object({
    status: z.nativeEnum(OrderItemStatus),
  })
  .strict();

export type OrderIdParamsInput = z.infer<typeof orderIdParamSchema>;
export type OrderItemParamsInput = z.infer<typeof orderItemParamsSchema>;
export type ListOrdersQueryInput = z.infer<typeof listOrdersQuerySchema>;
export type CreateOrderItemInput = z.infer<typeof createOrderItemInputSchema>;
export type CreateOrderBodyInput = z.infer<typeof createOrderBodySchema>;
export type UpdateOrderBodyInput = z.infer<typeof updateOrderBodySchema>;
export type AddOrderItemsBodyInput = z.infer<typeof addOrderItemsBodySchema>;
export type CancelOrderBodyInput = z.infer<typeof cancelOrderBodySchema>;
export type UpdateOrderItemStatusBodyInput = z.infer<
  typeof updateOrderItemStatusBodySchema
>;