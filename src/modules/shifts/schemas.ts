import { z } from "zod";

const bigintIdSchema = z
  .union([
    z.string().trim().regex(/^\d+$/, "Debe ser un entero positivo."),
    z.number().int().positive(),
  ])
  .transform((value) => BigInt(value));

const optionalBooleanQuerySchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const dateTimeSchema = z
  .string()
  .trim()
  .datetime({ offset: true, message: "Debe ser una fecha ISO válida." })
  .transform((value) => new Date(value));

const nullableNotesSchema = z
  .union([z.string().trim().min(1).max(255), z.null()])
  .optional();

export const shiftIdParamSchema = z
  .object({
    shiftId: bigintIdSchema,
  })
  .strict();

export const listShiftsQuerySchema = z
  .object({
    userId: bigintIdSchema.optional(),
    isOpen: optionalBooleanQuerySchema.optional(),
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

export const createShiftBodySchema = z
  .object({
    userId: bigintIdSchema.optional(),
    startedAt: dateTimeSchema.optional(),
    notes: nullableNotesSchema,
  })
  .strict();

export const updateShiftBodySchema = z
  .object({
    startedAt: dateTimeSchema.optional(),
    notes: nullableNotesSchema,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debes enviar al menos un campo para actualizar.",
  });

export const endShiftBodySchema = z
  .object({
    endedAt: dateTimeSchema.optional(),
    notes: nullableNotesSchema,
  })
  .strict();

export type ShiftIdParamsInput = z.infer<typeof shiftIdParamSchema>;
export type ListShiftsQueryInput = z.infer<typeof listShiftsQuerySchema>;
export type CreateShiftBodyInput = z.infer<typeof createShiftBodySchema>;
export type UpdateShiftBodyInput = z.infer<typeof updateShiftBodySchema>;
export type EndShiftBodyInput = z.infer<typeof endShiftBodySchema>;