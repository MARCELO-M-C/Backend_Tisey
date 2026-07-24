import { z } from "zod";

const bigintIdSchema = z
  .union([
    z.string().trim().regex(
      /^\d+$/,
      "Debe ser un entero positivo.",
    ),
    z.number().int().positive(),
  ])
  .transform((value) => BigInt(value));

export const roleIdParamSchema = z
  .object({
    roleId: bigintIdSchema,
  })
  .strict();

export const listRolesQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export type RoleIdParamsInput =
  z.infer<typeof roleIdParamSchema>;

export type ListRolesQueryInput =
  z.infer<typeof listRolesQuerySchema>;