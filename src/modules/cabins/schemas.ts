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

const cabinStatusSchema = z.enum(["AVAILABLE", "OCCUPIED", "MAINTENANCE"]);

const moneyValueSchema = z
  .union([
    z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Precio inválido."),
    z.number().positive(),
  ])
  .transform((value) =>
    typeof value === "number" ? value.toFixed(2) : value.trim(),
  );

const nullableMoneySchema = z.union([moneyValueSchema, z.null()]).optional();

const nullableNameSchema = z
  .union([z.string().trim().min(1).max(80), z.null()])
  .optional();

export const cabinIdParamSchema = z
  .object({
    cabinId: bigintIdSchema,
  })
  .strict();

export const listCabinsQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(80).optional(),
    status: cabinStatusSchema.optional(),
    isActive: optionalBooleanQuerySchema.optional(),
    minCapacity: z
      .union([
        z.string().trim().regex(/^\d+$/),
        z.number().int().positive(),
      ])
      .transform((value) => Number(value))
      .optional(),
  })
  .strict();

export const createCabinBodySchema = z
  .object({
    cabinNumber: z.number().int().positive().max(9999),
    name: nullableNameSchema,
    capacity: z.number().int().positive().max(100),
    basePricePerNight: nullableMoneySchema,
    status: cabinStatusSchema.optional().default("AVAILABLE"),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const updateCabinBodySchema = z
  .object({
    cabinNumber: z.number().int().positive().max(9999).optional(),
    name: z.union([z.string().trim().min(1).max(80), z.null()]).optional(),
    capacity: z.number().int().positive().max(100).optional(),
    basePricePerNight: z.union([moneyValueSchema, z.null()]).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debes enviar al menos un campo para actualizar.",
  });

export const updateCabinStatusBodySchema = z
  .object({
    status: cabinStatusSchema,
  })
  .strict();

export const updateCabinActiveBodySchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export type CabinIdParamsInput = z.infer<typeof cabinIdParamSchema>;
export type ListCabinsQueryInput = z.infer<typeof listCabinsQuerySchema>;
export type CreateCabinBodyInput = z.infer<typeof createCabinBodySchema>;
export type UpdateCabinBodyInput = z.infer<typeof updateCabinBodySchema>;
export type UpdateCabinStatusBodyInput = z.infer<
  typeof updateCabinStatusBodySchema
>;
export type UpdateCabinActiveBodyInput = z.infer<
  typeof updateCabinActiveBodySchema
>;