import { z } from "zod";

export const loginBodySchema = z
  .object({
    username: z.string().trim().min(3).max(50),
    password: z.string().min(6).max(72),
  })
  .strict();

export type LoginBodyInput = z.infer<typeof loginBodySchema>;