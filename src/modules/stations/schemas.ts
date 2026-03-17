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

const stationCodeSchema = z
  .string()
  .trim()
  .min(1, "El código es requerido.")
  .max(30, "El código no puede superar 30 caracteres.")
  .regex(
    /^[A-Za-z0-9_]+$/,
    "El código solo puede contener letras, números y guion bajo.",
  );

export const stationIdParamSchema = z
  .object({
    stationId: bigintIdSchema,
  })
  .strict();

export const listStationsQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(80).optional(),
    isActive: optionalBooleanQuerySchema.optional(),
  })
  .strict();

export const createStationBodySchema = z
  .object({
    code: stationCodeSchema,
    name: z.string().trim().min(1).max(80),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const updateStationBodySchema = z
  .object({
    code: stationCodeSchema.optional(),
    name: z.string().trim().min(1).max(80).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debes enviar al menos un campo para actualizar.",
  });

export const updateStationStatusBodySchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export type StationIdParamsInput = z.infer<typeof stationIdParamSchema>;
export type ListStationsQueryInput = z.infer<typeof listStationsQuerySchema>;
export type CreateStationBodyInput = z.infer<typeof createStationBodySchema>;
export type UpdateStationBodyInput = z.infer<typeof updateStationBodySchema>;
export type UpdateStationStatusBodyInput = z.infer<
  typeof updateStationStatusBodySchema
>;