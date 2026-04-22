import {
  toRestaurantTableResponse,
  type RestaurantTableResponseDto,
} from "./mapper";
import * as restaurantTablesRepository from "./repository";
import type {
  CreateRestaurantTableBodyInput,
  ListRestaurantTablesQueryInput,
  UpdateRestaurantTableBodyInput,
  UpdateRestaurantTableStatusBodyInput,
} from "./schemas";

export class RestaurantTablesServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RestaurantTablesServiceError";
  }
}

function normalizeTableCode(code: string): string {
  return code.trim().toUpperCase();
}

async function ensureRestaurantTableExists(tableId: bigint) {
  const table = await restaurantTablesRepository.findRestaurantTableById(tableId);

  if (!table) {
    throw new RestaurantTablesServiceError(
      404,
      "RESTAURANT_TABLE_NOT_FOUND",
      "Mesa no encontrada.",
    );
  }

  return table;
}

export async function listRestaurantTables(
  filters: ListRestaurantTablesQueryInput,
): Promise<RestaurantTableResponseDto[]> {
  const tables = await restaurantTablesRepository.listRestaurantTables(filters);
  return tables.map(toRestaurantTableResponse);
}

export async function getRestaurantTableById(
  tableId: bigint,
): Promise<RestaurantTableResponseDto> {
  const table = await ensureRestaurantTableExists(tableId);
  return toRestaurantTableResponse(table);
}

export async function createRestaurantTable(
  input: CreateRestaurantTableBodyInput,
): Promise<RestaurantTableResponseDto> {
  const normalizedCode = normalizeTableCode(input.code);
  const normalizedName =
    typeof input.name === "string" ? input.name.trim() : input.name ?? null;

  const existingTable = await restaurantTablesRepository.findRestaurantTableByCode(
    normalizedCode,
  );

  if (existingTable) {
    throw new RestaurantTablesServiceError(
      409,
      "RESTAURANT_TABLE_CODE_ALREADY_EXISTS",
      "Ya existe una mesa con ese código.",
    );
  }

  const createdTable = await restaurantTablesRepository.createRestaurantTable({
    code: normalizedCode,
    name: normalizedName,
    capacity: input.capacity ?? null,
    isActive: input.isActive,
  });

  return toRestaurantTableResponse(createdTable);
}

export async function updateRestaurantTable(
  tableId: bigint,
  input: UpdateRestaurantTableBodyInput,
): Promise<RestaurantTableResponseDto> {
  const currentTable = await ensureRestaurantTableExists(tableId);

  const nextCode = input.code ? normalizeTableCode(input.code) : undefined;
  const nextName =
    typeof input.name === "string" ? input.name.trim() : input.name;
  const nextCapacity = input.capacity;

  if (nextCode && nextCode !== currentTable.code) {
    const duplicatedTable =
      await restaurantTablesRepository.findRestaurantTableByCode(nextCode);

    if (duplicatedTable && duplicatedTable.id !== tableId) {
      throw new RestaurantTablesServiceError(
        409,
        "RESTAURANT_TABLE_CODE_ALREADY_EXISTS",
        "Ya existe una mesa con ese código.",
      );
    }
  }

  const updatedTable = await restaurantTablesRepository.updateRestaurantTable(
    tableId,
    {
      ...(nextCode ? { code: nextCode } : {}),
      ...(Object.prototype.hasOwnProperty.call(input, "name")
        ? { name: nextName ?? null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(input, "capacity")
        ? { capacity: nextCapacity ?? null }
        : {}),
    },
  );

  return toRestaurantTableResponse(updatedTable);
}

export async function updateRestaurantTableStatus(
  tableId: bigint,
  input: UpdateRestaurantTableStatusBodyInput,
): Promise<RestaurantTableResponseDto> {
  await ensureRestaurantTableExists(tableId);

  if (!input.isActive) {
    const openOrdersCount =
      await restaurantTablesRepository.countOpenOrdersByTable(tableId);

    if (openOrdersCount > 0) {
      throw new RestaurantTablesServiceError(
        409,
        "RESTAURANT_TABLE_HAS_OPEN_ORDERS",
        "No puedes desactivar una mesa que todavía tiene órdenes abiertas.",
      );
    }
  }

  const updatedTable = await restaurantTablesRepository.updateRestaurantTable(
    tableId,
    {
      isActive: input.isActive,
    },
  );

  return toRestaurantTableResponse(updatedTable);
}