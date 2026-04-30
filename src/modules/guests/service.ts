import { toGuestResponse, type GuestResponseDto } from "./mapper";
import * as guestsRepository from "./repository";
import type {
  CreateGuestBodyInput,
  ListGuestsQueryInput,
  UpdateGuestBodyInput,
} from "./schemas";

export class GuestsServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GuestsServiceError";
  }
}

function normalizeOptionalText(value?: string | null): string | null | undefined {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

async function ensureGuestExists(guestId: bigint) {
  const guest = await guestsRepository.findGuestById(guestId);

  if (!guest) {
    throw new GuestsServiceError(
      404,
      "GUEST_NOT_FOUND",
      "Huésped no encontrado.",
    );
  }

  return guest;
}

export async function listGuests(
  filters: ListGuestsQueryInput,
): Promise<GuestResponseDto[]> {
  const guests = await guestsRepository.listGuests(filters);
  return guests.map(toGuestResponse);
}

export async function getGuestById(
  guestId: bigint,
): Promise<GuestResponseDto> {
  const guest = await ensureGuestExists(guestId);
  return toGuestResponse(guest);
}

export async function createGuest(
  input: CreateGuestBodyInput,
): Promise<GuestResponseDto> {
  const createdGuest = await guestsRepository.createGuest({
    fullName: input.fullName.trim(),
    idNumber: normalizeOptionalText(input.idNumber) ?? null,
    originPlace: normalizeOptionalText(input.originPlace) ?? null,
  });

  return toGuestResponse(createdGuest);
}

export async function updateGuest(
  guestId: bigint,
  input: UpdateGuestBodyInput,
): Promise<GuestResponseDto> {
  await ensureGuestExists(guestId);

  const updatedGuest = await guestsRepository.updateGuest(guestId, {
    ...(typeof input.fullName === "string"
      ? { fullName: input.fullName.trim() }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(input, "idNumber")
      ? { idNumber: normalizeOptionalText(input.idNumber) ?? null }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(input, "originPlace")
      ? { originPlace: normalizeOptionalText(input.originPlace) ?? null }
      : {}),
  });

  return toGuestResponse(updatedGuest);
}