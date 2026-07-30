import { z } from "zod";

function isValidDateOnly(value: string): boolean {
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  );
}

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Debe tener formato YYYY-MM-DD.")
  .refine(isValidDateOnly, "Debe ser una fecha calendario válida.")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const moneySchema = z
  .union([
    z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Tarifa inválida."),
    z.number().positive(),
  ])
  .transform((value) =>
    typeof value === "number" ? value.toFixed(2) : value.trim(),
  )
  .refine((value) => Number(value) > 0, "La tarifa debe ser mayor que cero.");

export const listLodgingRatesQuerySchema = z
  .object({
    effectiveFrom: dateOnlySchema.optional(),
    effectiveTo: dateOnlySchema.optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (!data.effectiveFrom || !data.effectiveTo) return true;
      return data.effectiveTo >= data.effectiveFrom;
    },
    {
      message: "La fecha final debe ser mayor o igual a la fecha inicial.",
      path: ["effectiveTo"],
    },
  );

export const currentLodgingRateQuerySchema = z
  .object({
    date: dateOnlySchema.optional(),
  })
  .strict();

export const createLodgingRateBodySchema = z
  .object({
    amountPerPersonPerNight: moneySchema,
    minimumChargeableAge: z.number().int().min(0).max(120).optional().default(5),
    effectiveFrom: dateOnlySchema,
  })
  .strict();

export type ListLodgingRatesQueryInput = z.infer<
  typeof listLodgingRatesQuerySchema
>;
export type CurrentLodgingRateQueryInput = z.infer<
  typeof currentLodgingRateQuerySchema
>;
export type CreateLodgingRateBodyInput = z.infer<
  typeof createLodgingRateBodySchema
>;
