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

const tableCodeSchema = z
  .string()
  .trim()
  .min(1, "El código es requerido.")
  .max(20, "El código no puede superar 20 caracteres.")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "El código solo puede contener letras, números, guion y guion bajo.",
  );

const nullableNameSchema = z
  .union([z.string().trim().min(1).max(50), z.null()])
  .optional();

const nullableCapacitySchema = z
  .union([z.number().int().positive().max(100), z.null()])
  .optional();

export const restaurantTableIdParamSchema = z
  .object({
    tableId: bigintIdSchema,
  })
  .strict();

export const listRestaurantTablesQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(80).optional(),
    isActive: optionalBooleanQuerySchema.optional(),
  })
  .strict();

export const createRestaurantTableBodySchema = z
  .object({
    code: tableCodeSchema,
    name: nullableNameSchema,
    capacity: nullableCapacitySchema,
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const updateRestaurantTableBodySchema = z
  .object({
    code: tableCodeSchema.optional(),
    name: z.union([z.string().trim().min(1).max(50), z.null()]).optional(),
    capacity: z.union([z.number().int().positive().max(100), z.null()]).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debes enviar al menos un campo para actualizar.",
  });

export const updateRestaurantTableStatusBodySchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export type RestaurantTableIdParamsInput = z.infer<
  typeof restaurantTableIdParamSchema
>;
export type ListRestaurantTablesQueryInput = z.infer<
  typeof listRestaurantTablesQuerySchema
>;
export type CreateRestaurantTableBodyInput = z.infer<
  typeof createRestaurantTableBodySchema
>;
export type UpdateRestaurantTableBodyInput = z.infer<
  typeof updateRestaurantTableBodySchema
>;
export type UpdateRestaurantTableStatusBodyInput = z.infer<
  typeof updateRestaurantTableStatusBodySchema
>;