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

export const userIdParamSchema = z
  .object({
    id: bigintIdSchema,
  })
  .strict();

export const listUsersQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(80).optional(),
    isActive: optionalBooleanQuerySchema.optional(),
    roleId: bigintIdSchema.optional(),
  })
  .strict();

export const createUserBodySchema = z
  .object({
    username: z.string().trim().min(3).max(50),
    password: z.string().min(8).max(72),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    isActive: z.boolean().optional().default(true),
    roleIds: z.array(bigintIdSchema).min(1),
  })
  .strict();

export const updateUserBodySchema = z
  .object({
    username: z.string().trim().min(3).max(50).optional(),
    password: z.string().min(8).max(72).optional(),
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debes enviar al menos un campo para actualizar.",
  });

export const replaceUserRolesBodySchema = z
  .object({
    roleIds: z.array(bigintIdSchema).min(1),
  })
  .strict();

export const updateUserStatusBodySchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export type UserIdParamsInput = z.infer<typeof userIdParamSchema>;
export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>;
export type CreateUserBodyInput = z.infer<typeof createUserBodySchema>;
export type UpdateUserBodyInput = z.infer<typeof updateUserBodySchema>;
export type ReplaceUserRolesBodyInput = z.infer<typeof replaceUserRolesBodySchema>;
export type UpdateUserStatusBodyInput = z.infer<typeof updateUserStatusBodySchema>;