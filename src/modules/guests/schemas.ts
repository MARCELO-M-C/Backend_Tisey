import { z } from "zod";

const bigintIdSchema = z
  .union([
    z.string().trim().regex(/^\d+$/, "Debe ser un entero positivo."),
    z.number().int().positive(),
  ])
  .transform((value) => BigInt(value));

const nullableTextSchema = (max: number) =>
  z.union([z.string().trim().min(1).max(max), z.null()]).optional();

export const guestIdParamSchema = z
  .object({
    guestId: bigintIdSchema,
  })
  .strict();

export const listGuestsQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(120).optional(),
    idNumber: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

export const createGuestBodySchema = z
  .object({
    fullName: z.string().trim().min(1).max(160),
    idNumber: nullableTextSchema(40),
    originPlace: nullableTextSchema(120),
  })
  .strict();

export const updateGuestBodySchema = z
  .object({
    fullName: z.string().trim().min(1).max(160).optional(),
    idNumber: z.union([z.string().trim().min(1).max(40), z.null()]).optional(),
    originPlace: z
      .union([z.string().trim().min(1).max(120), z.null()])
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debes enviar al menos un campo para actualizar.",
  });

export type GuestIdParamsInput = z.infer<typeof guestIdParamSchema>;
export type ListGuestsQueryInput = z.infer<typeof listGuestsQuerySchema>;
export type CreateGuestBodyInput = z.infer<typeof createGuestBodySchema>;
export type UpdateGuestBodyInput = z.infer<typeof updateGuestBodySchema>;