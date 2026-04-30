import { StayStatus, cabins_status } from "@prisma/client";
import { toStayResponse, type StayResponseDto } from "./mapper";
import * as staysRepository from "./repository";
import type {
  CreateStayBodyInput,
  ListStaysQueryInput,
  ReplaceStayGuestsBodyInput,
  UpdateStayBodyInput,
  UpdateStayStatusBodyInput,
} from "./schemas";

export class StaysServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "StaysServiceError";
  }
}

function parseUserId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new StaysServiceError(
      400,
      "INVALID_USER_ID",
      "Id de usuario inválido.",
    );
  }
}

function uniqueBigIntValues(values: bigint[]): bigint[] {
  return [...new Set(values.map((value) => value.toString()))].map((value) =>
    BigInt(value),
  );
}

async function ensureStayExists(stayId: bigint) {
  const stay = await staysRepository.findStayById(stayId);

  if (!stay) {
    throw new StaysServiceError(
      404,
      "STAY_NOT_FOUND",
      "Estadía no encontrada.",
    );
  }

  return stay;
}

async function ensureCabinCanBeUsed(
  cabinId: bigint,
  targetStatus: StayStatus,
) {
  const cabin = await staysRepository.findCabinById(cabinId);

  if (!cabin) {
    throw new StaysServiceError(
      404,
      "CABIN_NOT_FOUND",
      "Cabaña no encontrada.",
    );
  }

  if (!cabin.isActive) {
    throw new StaysServiceError(
      400,
      "CABIN_INACTIVE",
      "La cabaña está inactiva.",
    );
  }

  if (cabin.status === cabins_status.MAINTENANCE) {
    throw new StaysServiceError(
      409,
      "CABIN_IN_MAINTENANCE",
      "La cabaña está en mantenimiento.",
    );
  }

  if (
    targetStatus === StayStatus.CHECKED_IN &&
    cabin.status === cabins_status.OCCUPIED
  ) {
    throw new StaysServiceError(
      409,
      "CABIN_OCCUPIED",
      "La cabaña está ocupada.",
    );
  }

  return cabin;
}

async function ensureGuestExists(guestId: bigint) {
  const guest = await staysRepository.findGuestById(guestId);

  if (!guest) {
    throw new StaysServiceError(
      404,
      "GUEST_NOT_FOUND",
      "Huésped no encontrado.",
    );
  }

  return guest;
}

async function ensureGuestsExist(guestIds: bigint[]): Promise<bigint[]> {
  const uniqueGuestIds = uniqueBigIntValues(guestIds);

  if (uniqueGuestIds.length === 0) return [];

  const existingGuestsCount = await staysRepository.countGuestsByIds(
    uniqueGuestIds,
  );

  if (existingGuestsCount !== uniqueGuestIds.length) {
    throw new StaysServiceError(
      400,
      "INVALID_GUEST_IDS",
      "Uno o más huéspedes no existen.",
    );
  }

  return uniqueGuestIds;
}

async function ensureCabinHasNoDateConflict(
  cabinId: bigint,
  checkInDate: Date,
  checkOutDate: Date,
  excludeStayId?: bigint,
) {
  const overlappingStaysCount =
    await staysRepository.countOverlappingActiveStaysByCabin(
      cabinId,
      checkInDate,
      checkOutDate,
      excludeStayId,
    );

  if (overlappingStaysCount > 0) {
    throw new StaysServiceError(
      409,
      "CABIN_HAS_OVERLAPPING_STAY",
      "La cabaña ya tiene una estadía activa o reservada en ese rango de fechas.",
    );
  }
}

async function releaseCabinIfPossible(cabinId: bigint, excludeStayId?: bigint) {
  const activeStaysCount = await staysRepository.countActiveStaysByCabin(
    cabinId,
    excludeStayId,
  );

  if (activeStaysCount === 0) {
    await staysRepository.updateCabinStatus(cabinId, cabins_status.AVAILABLE);
  }
}

function ensureStayIsEditable(status: StayStatus) {
  if (status === StayStatus.CHECKED_OUT || status === StayStatus.CANCELLED) {
    throw new StaysServiceError(
      409,
      "STAY_NOT_EDITABLE",
      "No puedes editar una estadía finalizada o cancelada.",
    );
  }
}

export async function listStays(
  filters: ListStaysQueryInput,
): Promise<StayResponseDto[]> {
  const stays = await staysRepository.listStays({
    ...filters,
    status: filters.status as StayStatus | undefined,
  });

  return stays.map(toStayResponse);
}

export async function getStayById(stayId: bigint): Promise<StayResponseDto> {
  const stay = await ensureStayExists(stayId);
  return toStayResponse(stay);
}

export async function createStay(
  input: CreateStayBodyInput,
  actorUserId: string,
): Promise<StayResponseDto> {
  const createdBy = parseUserId(actorUserId);
  const status = input.status as StayStatus;

  await ensureCabinCanBeUsed(input.cabinId, status);
  await ensureGuestExists(input.primaryGuestId);
  await ensureCabinHasNoDateConflict(
    input.cabinId,
    input.checkInDate,
    input.checkOutDate,
  );

  const guestIds = await ensureGuestsExist([
    input.primaryGuestId,
    ...input.guestIds,
  ]);

  const createdStay = await staysRepository.createStay({
    cabinId: input.cabinId,
    primaryGuestId: input.primaryGuestId,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    status,
    createdBy,
    guestIds,
  });

  return toStayResponse(createdStay);
}

export async function updateStay(
  stayId: bigint,
  input: UpdateStayBodyInput,
): Promise<StayResponseDto> {
  const currentStay = await ensureStayExists(stayId);
  ensureStayIsEditable(currentStay.status);

  const nextCabinId = input.cabinId ?? currentStay.cabinId;
  const nextPrimaryGuestId = input.primaryGuestId ?? currentStay.primaryGuestId;
  const nextCheckInDate = input.checkInDate ?? currentStay.checkInDate;
  const nextCheckOutDate = input.checkOutDate ?? currentStay.checkOutDate;

  if (nextCheckOutDate <= nextCheckInDate) {
    throw new StaysServiceError(
      400,
      "INVALID_STAY_DATES",
      "La fecha de salida debe ser mayor que la fecha de entrada.",
    );
  }

  if (input.cabinId && input.cabinId !== currentStay.cabinId) {
    await ensureCabinCanBeUsed(input.cabinId, currentStay.status);
  }

  if (input.primaryGuestId) {
    await ensureGuestExists(input.primaryGuestId);
  }

  await ensureCabinHasNoDateConflict(
    nextCabinId,
    nextCheckInDate,
    nextCheckOutDate,
    stayId,
  );

  const updatedStay = await staysRepository.updateStay(stayId, {
    ...(input.cabinId ? { cabinId: input.cabinId } : {}),
    ...(input.primaryGuestId ? { primaryGuestId: input.primaryGuestId } : {}),
    ...(input.checkInDate ? { checkInDate: input.checkInDate } : {}),
    ...(input.checkOutDate ? { checkOutDate: input.checkOutDate } : {}),
  });

  if (
    currentStay.status === StayStatus.CHECKED_IN &&
    input.cabinId &&
    input.cabinId !== currentStay.cabinId
  ) {
    await releaseCabinIfPossible(currentStay.cabinId, stayId);
    await staysRepository.updateCabinStatus(input.cabinId, cabins_status.OCCUPIED);
  }

  if (input.primaryGuestId) {
    const guestIds = await ensureGuestsExist([
      input.primaryGuestId,
      ...updatedStay.stayGuests.map((stayGuest) => stayGuest.guest.id),
    ]);

    return toStayResponse(
      await staysRepository.replaceStayGuests(stayId, guestIds),
    );
  }

  return toStayResponse(updatedStay);
}

export async function updateStayStatus(
  stayId: bigint,
  input: UpdateStayStatusBodyInput,
): Promise<StayResponseDto> {
  const currentStay = await ensureStayExists(stayId);
  const nextStatus = input.status as StayStatus;

  if (currentStay.status === nextStatus) {
    return toStayResponse(currentStay);
  }

  if (
    currentStay.status === StayStatus.CHECKED_OUT ||
    currentStay.status === StayStatus.CANCELLED
  ) {
    throw new StaysServiceError(
      409,
      "STAY_ALREADY_CLOSED",
      "La estadía ya está finalizada o cancelada.",
    );
  }

  if (nextStatus === StayStatus.CHECKED_IN) {
    await ensureCabinCanBeUsed(currentStay.cabinId, StayStatus.CHECKED_IN);
    await ensureCabinHasNoDateConflict(
      currentStay.cabinId,
      currentStay.checkInDate,
      currentStay.checkOutDate,
      stayId,
    );

    const updatedStay = await staysRepository.updateStay(stayId, {
      status: nextStatus,
    });

    await staysRepository.updateCabinStatus(
      currentStay.cabinId,
      cabins_status.OCCUPIED,
    );

    return toStayResponse(updatedStay);
  }

  if (
    nextStatus === StayStatus.CHECKED_OUT ||
    nextStatus === StayStatus.CANCELLED
  ) {
    const openOrdersCount = await staysRepository.countOpenOrdersByStay(stayId);

    if (openOrdersCount > 0) {
      throw new StaysServiceError(
        409,
        "STAY_HAS_OPEN_ORDERS",
        "No puedes finalizar o cancelar una estadía con órdenes abiertas.",
      );
    }

    const updatedStay = await staysRepository.updateStay(stayId, {
      status: nextStatus,
    });

    await releaseCabinIfPossible(currentStay.cabinId, stayId);

    return toStayResponse(updatedStay);
  }

  const updatedStay = await staysRepository.updateStay(stayId, {
    status: nextStatus,
  });

  return toStayResponse(updatedStay);
}

export async function replaceStayGuests(
  stayId: bigint,
  input: ReplaceStayGuestsBodyInput,
): Promise<StayResponseDto> {
  const currentStay = await ensureStayExists(stayId);
  ensureStayIsEditable(currentStay.status);

  const guestIds = await ensureGuestsExist([
    currentStay.primaryGuestId,
    ...input.guestIds,
  ]);

  const updatedStay = await staysRepository.replaceStayGuests(stayId, guestIds);

  return toStayResponse(updatedStay);
}