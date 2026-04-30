import { z } from "zod";

const bigintIdSchema = z
  .union([
    z.string().trim().regex(/^\d+$/, "Debe ser un entero positivo."),
    z.number().int().positive(),
  ])
  .transform((value) => BigInt(value));

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Debe tener formato YYYY-MM-DD.")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const stayStatusSchema = z.enum([
  "BOOKED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
]);

const nullableNotesSchema = z
  .union([z.string().trim().min(1).max(255), z.null()])
  .optional();

export const stayIdParamSchema = z
  .object({
    stayId: bigintIdSchema,
  })
  .strict();

export const listStaysQuerySchema = z
  .object({
    cabinId: bigintIdSchema.optional(),
    primaryGuestId: bigintIdSchema.optional(),
    status: stayStatusSchema.optional(),
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
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

export const createStayBodySchema = z
  .object({
    cabinId: bigintIdSchema,
    primaryGuestId: bigintIdSchema,
    checkInDate: dateOnlySchema,
    checkOutDate: dateOnlySchema,
    status: stayStatusSchema.optional().default("CHECKED_IN"),
    guestIds: z.array(bigintIdSchema).optional().default([]),
  })
  .strict()
  .refine((data) => data.checkOutDate > data.checkInDate, {
    message: "La fecha de salida debe ser mayor que la fecha de entrada.",
    path: ["checkOutDate"],
  });

export const updateStayBodySchema = z
  .object({
    cabinId: bigintIdSchema.optional(),
    primaryGuestId: bigintIdSchema.optional(),
    checkInDate: dateOnlySchema.optional(),
    checkOutDate: dateOnlySchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debes enviar al menos un campo para actualizar.",
  });

export const updateStayStatusBodySchema = z
  .object({
    status: stayStatusSchema,
    notes: nullableNotesSchema,
  })
  .strict();

export const replaceStayGuestsBodySchema = z
  .object({
    guestIds: z.array(bigintIdSchema),
  })
  .strict();

export type StayIdParamsInput = z.infer<typeof stayIdParamSchema>;
export type ListStaysQueryInput = z.infer<typeof listStaysQuerySchema>;
export type CreateStayBodyInput = z.infer<typeof createStayBodySchema>;
export type UpdateStayBodyInput = z.infer<typeof updateStayBodySchema>;
export type UpdateStayStatusBodyInput = z.infer<
  typeof updateStayStatusBodySchema
>;
export type ReplaceStayGuestsBodyInput = z.infer<
  typeof replaceStayGuestsBodySchema
>;