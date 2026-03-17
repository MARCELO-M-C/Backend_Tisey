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

const moneySchema = z
  .union([
    z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Precio inválido."),
    z.number().positive(),
  ])
  .transform((value) =>
    typeof value === "number" ? value.toFixed(2) : value.trim(),
  );

export const categoryIdParamSchema = z
  .object({
    categoryId: bigintIdSchema,
  })
  .strict();

export const itemIdParamSchema = z
  .object({
    itemId: bigintIdSchema,
  })
  .strict();

export const listStationsQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(80).optional(),
    isActive: optionalBooleanQuerySchema.optional(),
  })
  .strict();

export const listCategoriesQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(80).optional(),
    isActive: optionalBooleanQuerySchema.optional(),
  })
  .strict();

export const createCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    sortOrder: z.number().int().min(0).max(9999).optional().default(0),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const updateCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debes enviar al menos un campo para actualizar.",
  });

export const updateCategoryStatusBodySchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export const listMenuItemsQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(120).optional(),
    categoryId: bigintIdSchema.optional(),
    stationId: bigintIdSchema.optional(),
    isActive: optionalBooleanQuerySchema.optional(),
  })
  .strict();

export const createMenuItemBodySchema = z
  .object({
    categoryId: bigintIdSchema,
    stationId: bigintIdSchema,
    name: z.string().trim().min(1).max(120),
    basePrice: moneySchema,
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const updateMenuItemBodySchema = z
  .object({
    categoryId: bigintIdSchema.optional(),
    stationId: bigintIdSchema.optional(),
    name: z.string().trim().min(1).max(120).optional(),
    basePrice: moneySchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debes enviar al menos un campo para actualizar.",
  });

export const updateMenuItemStatusBodySchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export type CategoryIdParamsInput = z.infer<typeof categoryIdParamSchema>;
export type ItemIdParamsInput = z.infer<typeof itemIdParamSchema>;
export type ListStationsQueryInput = z.infer<typeof listStationsQuerySchema>;
export type ListCategoriesQueryInput = z.infer<typeof listCategoriesQuerySchema>;
export type CreateCategoryBodyInput = z.infer<typeof createCategoryBodySchema>;
export type UpdateCategoryBodyInput = z.infer<typeof updateCategoryBodySchema>;
export type UpdateCategoryStatusBodyInput = z.infer<
  typeof updateCategoryStatusBodySchema
>;
export type ListMenuItemsQueryInput = z.infer<typeof listMenuItemsQuerySchema>;
export type CreateMenuItemBodyInput = z.infer<typeof createMenuItemBodySchema>;
export type UpdateMenuItemBodyInput = z.infer<typeof updateMenuItemBodySchema>;
export type UpdateMenuItemStatusBodyInput = z.infer<
  typeof updateMenuItemStatusBodySchema
>;