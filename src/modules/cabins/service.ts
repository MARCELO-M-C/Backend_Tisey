import { Prisma, cabins_status } from "@prisma/client";
import { toCabinResponse, type CabinResponseDto } from "./mapper";
import * as cabinsRepository from "./repository";
import type {
  CreateCabinBodyInput,
  ListCabinsQueryInput,
  UpdateCabinActiveBodyInput,
  UpdateCabinBodyInput,
  UpdateCabinStatusBodyInput,
} from "./schemas";

export class CabinsServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CabinsServiceError";
  }
}

function normalizeName(value?: string | null): string | null | undefined {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

async function ensureCabinExists(cabinId: bigint) {
  const cabin = await cabinsRepository.findCabinById(cabinId);

  if (!cabin) {
    throw new CabinsServiceError(
      404,
      "CABIN_NOT_FOUND",
      "Cabaña no encontrada.",
    );
  }

  return cabin;
}

async function ensureCabinNumberIsAvailable(
  cabinNumber: number,
  currentCabinId?: bigint,
) {
  const existingCabin = await cabinsRepository.findCabinByNumber(cabinNumber);

  if (existingCabin && existingCabin.id !== currentCabinId) {
    throw new CabinsServiceError(
      409,
      "CABIN_NUMBER_ALREADY_EXISTS",
      "Ya existe una cabaña con ese número.",
    );
  }
}

async function ensureCabinHasNoActiveStays(cabinId: bigint) {
  const activeStaysCount = await cabinsRepository.countActiveStaysByCabin(
    cabinId,
  );

  if (activeStaysCount > 0) {
    throw new CabinsServiceError(
      409,
      "CABIN_HAS_ACTIVE_STAYS",
      "La cabaña tiene estadías activas o reservadas.",
    );
  }
}

export async function listCabins(
  filters: ListCabinsQueryInput,
): Promise<CabinResponseDto[]> {
  const cabins = await cabinsRepository.listCabins({
    ...filters,
    status: filters.status as cabins_status | undefined,
  });

  return cabins.map(toCabinResponse);
}

export async function getCabinById(
  cabinId: bigint,
): Promise<CabinResponseDto> {
  const cabin = await ensureCabinExists(cabinId);
  return toCabinResponse(cabin);
}

export async function createCabin(
  input: CreateCabinBodyInput,
): Promise<CabinResponseDto> {
  await ensureCabinNumberIsAvailable(input.cabinNumber);

  const createdCabin = await cabinsRepository.createCabin({
    cabinNumber: input.cabinNumber,
    name: normalizeName(input.name) ?? null,
    capacity: input.capacity,
    basePricePerNight: input.basePricePerNight
      ? new Prisma.Decimal(input.basePricePerNight)
      : null,
    status: input.status as cabins_status,
    isActive: input.isActive,
  });

  return toCabinResponse(createdCabin);
}

export async function updateCabin(
  cabinId: bigint,
  input: UpdateCabinBodyInput,
): Promise<CabinResponseDto> {
  const currentCabin = await ensureCabinExists(cabinId);

  if (
    typeof input.cabinNumber === "number" &&
    input.cabinNumber !== currentCabin.cabinNumber
  ) {
    await ensureCabinNumberIsAvailable(input.cabinNumber, cabinId);
  }

  const updatedCabin = await cabinsRepository.updateCabin(cabinId, {
    ...(typeof input.cabinNumber === "number"
      ? { cabinNumber: input.cabinNumber }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(input, "name")
      ? { name: normalizeName(input.name) ?? null }
      : {}),
    ...(typeof input.capacity === "number" ? { capacity: input.capacity } : {}),
    ...(Object.prototype.hasOwnProperty.call(input, "basePricePerNight")
      ? {
          basePricePerNight: input.basePricePerNight
            ? new Prisma.Decimal(input.basePricePerNight)
            : null,
        }
      : {}),
  });

  return toCabinResponse(updatedCabin);
}

export async function updateCabinStatus(
  cabinId: bigint,
  input: UpdateCabinStatusBodyInput,
): Promise<CabinResponseDto> {
  await ensureCabinExists(cabinId);

  const nextStatus = input.status as cabins_status;

  if (
    nextStatus === cabins_status.AVAILABLE ||
    nextStatus === cabins_status.MAINTENANCE
  ) {
    await ensureCabinHasNoActiveStays(cabinId);
  }

  const updatedCabin = await cabinsRepository.updateCabin(cabinId, {
    status: nextStatus,
  });

  return toCabinResponse(updatedCabin);
}

export async function updateCabinActiveStatus(
  cabinId: bigint,
  input: UpdateCabinActiveBodyInput,
): Promise<CabinResponseDto> {
  await ensureCabinExists(cabinId);

  if (!input.isActive) {
    await ensureCabinHasNoActiveStays(cabinId);
  }

  const updatedCabin = await cabinsRepository.updateCabin(cabinId, {
    isActive: input.isActive,
  });

  return toCabinResponse(updatedCabin);
}