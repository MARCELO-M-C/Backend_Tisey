import { z } from "zod";

const bigintIdSchema = z
  .union([
    z.string().trim().regex(/^\d+$/, "Debe ser un entero positivo."),
    z.number().int().positive(),
  ])
  .transform((value) => BigInt(value));

const roleNameSchema = z
  .string()
  .trim()
  .min(1, "El nombre del rol es requerido.")
  .max(50, "El nombre del rol no puede superar 50 caracteres.");

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

export const createRoleBodySchema = z
  .object({
    name: roleNameSchema,
    permissionIds: z.array(bigintIdSchema).optional().default([]),
  })
  .strict();

export const updateRoleBodySchema = z
  .object({
    name: roleNameSchema,
  })
  .strict();

export const updateRolePermissionsBodySchema = z
  .object({
    permissionIds: z.array(bigintIdSchema),
  })
  .strict();

export type RoleIdParamsInput = z.infer<typeof roleIdParamSchema>;
export type ListRolesQueryInput = z.infer<typeof listRolesQuerySchema>;
export type CreateRoleBodyInput = z.infer<typeof createRoleBodySchema>;
export type UpdateRoleBodyInput = z.infer<typeof updateRoleBodySchema>;
export type UpdateRolePermissionsBodyInput = z.infer<
  typeof updateRolePermissionsBodySchema
>;