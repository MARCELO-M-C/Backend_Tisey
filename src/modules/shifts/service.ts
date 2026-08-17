import type { AuthTokenPayload } from "../auth/mapper";
import {
  isAdminRequestUser,
  requestUserHasPermission,
} from "../auth/service";
import { toShiftResponse, type ShiftResponseDto } from "./mapper";
import * as shiftsRepository from "./repository";
import type {
  CreateShiftBodyInput,
  EndShiftBodyInput,
  ListShiftsQueryInput,
  UpdateShiftBodyInput,
} from "./schemas";

const SHIFTS_MANAGE_PERMISSION = "ADMIN_SHIFTS_&_STATIONS_MANAGE";
const ORDERS_MANAGE_PERMISSION = "ADMIN_ORDERS_MANAGE";

export class ShiftsServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ShiftsServiceError";
  }
}

function parseUserId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new ShiftsServiceError(
      400,
      "INVALID_USER_ID",
      "Id de usuario inválido.",
    );
  }
}

function normalizeNotes(value?: string | null): string | null | undefined {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function actorCanManageShifts(actor: AuthTokenPayload): boolean {
  return (
    isAdminRequestUser(actor) ||
    requestUserHasPermission(actor, SHIFTS_MANAGE_PERMISSION)
  );
}

function actorCanReadAllShifts(actor: AuthTokenPayload): boolean {
  return (
    actorCanManageShifts(actor) ||
    requestUserHasPermission(actor, ORDERS_MANAGE_PERMISSION)
  );
}

function assertActorCanReadShift(
  actor: AuthTokenPayload,
  shiftUserId: bigint,
): void {
  if (actorCanReadAllShifts(actor)) return;

  const actorId = parseUserId(actor.sub);
  if (shiftUserId !== actorId) {
    throw new ShiftsServiceError(
      403,
      "SHIFT_ACCESS_FORBIDDEN",
      "No puedes consultar el turno de otro usuario.",
    );
  }
}

function assertActorCanManageShift(actor: AuthTokenPayload): void {
  if (actorCanManageShifts(actor)) return;

  throw new ShiftsServiceError(
    403,
    "SHIFT_MANAGEMENT_FORBIDDEN",
    "No tienes autorización para administrar turnos de otros usuarios.",
  );
}

async function ensureShiftExists(shiftId: bigint) {
  const shift = await shiftsRepository.findShiftById(shiftId);

  if (!shift) {
    throw new ShiftsServiceError(
      404,
      "SHIFT_NOT_FOUND",
      "Turno no encontrado.",
    );
  }

  return shift;
}

async function ensureUserCanHaveShift(userId: bigint) {
  const user = await shiftsRepository.findUserById(userId);

  if (!user) {
    throw new ShiftsServiceError(
      404,
      "USER_NOT_FOUND",
      "Usuario no encontrado.",
    );
  }

  if (!user.isActive) {
    throw new ShiftsServiceError(
      403,
      "USER_INACTIVE",
      "El usuario está inactivo.",
    );
  }

  return user;
}

export async function listShifts(
  filters: ListShiftsQueryInput,
  actor: AuthTokenPayload,
): Promise<ShiftResponseDto[]> {
  const actorId = parseUserId(actor.sub);

  if (!actorCanReadAllShifts(actor)) {
    if (filters.userId && filters.userId !== actorId) {
      throw new ShiftsServiceError(
        403,
        "SHIFT_ACCESS_FORBIDDEN",
        "No puedes consultar turnos de otro usuario.",
      );
    }

    const shifts = await shiftsRepository.listShifts({
      ...filters,
      userId: actorId,
    });

    return shifts.map(toShiftResponse);
  }

  const shifts = await shiftsRepository.listShifts(filters);
  return shifts.map(toShiftResponse);
}

export async function getShiftById(
  shiftId: bigint,
  actor: AuthTokenPayload,
): Promise<ShiftResponseDto> {
  const shift = await ensureShiftExists(shiftId);
  assertActorCanReadShift(actor, shift.userId);

  return toShiftResponse(shift);
}

export async function createShift(
  input: CreateShiftBodyInput,
  actor: AuthTokenPayload,
): Promise<ShiftResponseDto> {
  const actorId = parseUserId(actor.sub);
  const targetUserId = input.userId ?? actorId;

  if (targetUserId !== actorId && !actorCanManageShifts(actor)) {
    throw new ShiftsServiceError(
      403,
      "SHIFT_CREATE_FOR_OTHER_USER_FORBIDDEN",
      "Solo puedes abrir tu propio turno.",
    );
  }

  await ensureUserCanHaveShift(targetUserId);
  const openShift = await shiftsRepository.findOpenShiftByUserId(targetUserId);

  if (openShift) {
    throw new ShiftsServiceError(
      409,
      "USER_ALREADY_HAS_OPEN_SHIFT",
      "El usuario ya tiene un turno abierto.",
    );
  }

  const startedAt = input.startedAt ?? new Date();
  const createdShift = await shiftsRepository.createShift({
    userId: targetUserId,
    startedAt,
    notes: normalizeNotes(input.notes) ?? null,
  });

  return toShiftResponse(createdShift);
}

export async function updateShift(
  shiftId: bigint,
  input: UpdateShiftBodyInput,
  actor: AuthTokenPayload,
): Promise<ShiftResponseDto> {
  assertActorCanManageShift(actor);

  const currentShift = await ensureShiftExists(shiftId);

  if (currentShift.endedAt) {
    throw new ShiftsServiceError(
      409,
      "SHIFT_ALREADY_CLOSED",
      "No puedes editar un turno que ya fue cerrado.",
    );
  }

  const updatedShift = await shiftsRepository.updateShift(shiftId, {
    ...(input.startedAt ? { startedAt: input.startedAt } : {}),
    ...(Object.prototype.hasOwnProperty.call(input, "notes")
      ? { notes: normalizeNotes(input.notes) ?? null }
      : {}),
  });

  return toShiftResponse(updatedShift);
}

export async function endShift(
  shiftId: bigint,
  input: EndShiftBodyInput,
  actor: AuthTokenPayload,
): Promise<ShiftResponseDto> {
  const currentShift = await ensureShiftExists(shiftId);

  if (!actorCanManageShifts(actor)) {
    const actorId = parseUserId(actor.sub);
    if (currentShift.userId !== actorId) {
      throw new ShiftsServiceError(
        403,
        "SHIFT_END_FOR_OTHER_USER_FORBIDDEN",
        "Solo puedes cerrar tu propio turno.",
      );
    }
  }

  if (currentShift.endedAt) {
    throw new ShiftsServiceError(
      409,
      "SHIFT_ALREADY_CLOSED",
      "El turno ya está cerrado.",
    );
  }

  const openOrdersCount = await shiftsRepository.countOpenOrdersByShift(shiftId);

  if (openOrdersCount > 0) {
    throw new ShiftsServiceError(
      409,
      "SHIFT_HAS_OPEN_ORDERS",
      "No puedes cerrar un turno que todavía tiene órdenes abiertas.",
    );
  }

  const endedAt = input.endedAt ?? new Date();
  if (endedAt < currentShift.startedAt) {
    throw new ShiftsServiceError(
      400,
      "INVALID_END_DATE",
      "La fecha de cierre no puede ser menor que la fecha de inicio.",
    );
  }

  const endedShift = await shiftsRepository.updateShift(shiftId, {
    endedAt,
    ...(Object.prototype.hasOwnProperty.call(input, "notes")
      ? { notes: normalizeNotes(input.notes) ?? null }
      : {}),
  });

  return toShiftResponse(endedShift);
}
