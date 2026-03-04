import { Prisma } from "@prisma/client";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toApiValue<T = unknown>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString() as T;
  }

  if (value instanceof Date) {
    return value.toISOString() as T;
  }

  if (value instanceof Prisma.Decimal) {
    return Number(value.toString()) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toApiValue(item)) as T;
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = toApiValue(nestedValue);
    }

    return result as T;
  }

  return value;
}

export function parseBigIntLike(value: unknown, fieldName: string): bigint | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  try {
    if (typeof value === "bigint") {
      return value;
    }

    if (typeof value === "number") {
      if (!Number.isInteger(value)) {
        throw new Error();
      }

      return BigInt(value);
    }

    if (typeof value === "string") {
      return BigInt(value);
    }
  } catch {
    throw new Error(`${fieldName} debe ser un entero valido.`);
  }

  throw new Error(`${fieldName} debe ser un entero valido.`);
}

export function normalizeBigIntFields(
  payload: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> {
  const normalizedPayload: Record<string, unknown> = { ...payload };

  for (const fieldName of fields) {
    if (!(fieldName in normalizedPayload)) {
      continue;
    }

    const parsedValue = parseBigIntLike(normalizedPayload[fieldName], fieldName);
    normalizedPayload[fieldName] = parsedValue;
  }

  return normalizedPayload;
}
