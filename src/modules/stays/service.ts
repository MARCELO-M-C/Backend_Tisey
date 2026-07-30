import { StayStatus, cabins_status } from "@prisma/client";
import { toStayResponse, type StayResponseDto } from "./mapper";
import * as staysRepository from "./repository";
import type {
  GuestSummaryRecord,
  StayGuestSnapshotRepositoryInput,
  StayRecord,
} from "./repository";
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

function sameBigInt(left: bigint, right: bigint): boolean {
  return left.toString() === right.toString();
}

function calculateAgeAtDate(birthDate: Date, targetDate: Date): number {
  if (birthDate > targetDate) {
    throw new StaysServiceError(
      400,
      "GUEST_BIRTH_DATE_AFTER_CHECK_IN",
      "La fecha de nacimiento de un huésped no puede ser posterior a la fecha de entrada.",
    );
  }

  let age = targetDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const targetMonth = targetDate.getUTCMonth();
  const birthMonth = birthDate.getUTCMonth();
  const targetDay = targetDate.getUTCDate();
  const birthDay = birthDate.getUTCDate();

  if (
    targetMonth < birthMonth ||
    (targetMonth === birthMonth && targetDay < birthDay)
  ) {
    age -= 1;
  }

  return age;
}

function calculateSnapshot(
  guest: GuestSummaryRecord,
  checkInDate: Date,
  minimumChargeableAge: number,
): StayGuestSnapshotRepositoryInput {
  if (!guest.birthDate) {
    return {
      guestId: guest.id,
      ageAtCheckIn: null,
      isChargeable: true,
    };
  }

  const ageAtCheckIn = calculateAgeAtDate(guest.birthDate, checkInDate);
  return {
    guestId: guest.id,
    ageAtCheckIn,
    isChargeable: ageAtCheckIn >= minimumChargeableAge,
  };
}

function buildGuestSnapshots(
  guests: GuestSummaryRecord[],
  checkInDate: Date,
  minimumChargeableAge: number,
  preservedSnapshots?: Map<string, StayGuestSnapshotRepositoryInput>,
): StayGuestSnapshotRepositoryInput[] {
  return guests.map((guest) => {
    const preserved = preservedSnapshots?.get(guest.id.toString());
    return preserved ?? calculateSnapshot(guest, checkInDate, minimumChargeableAge);
  });
}

function currentSnapshotMap(
  stay: StayRecord,
): Map<string, StayGuestSnapshotRepositoryInput> {
  return new Map(
    stay.stayGuests.map((stayGuest) => [
      stayGuest.guest.id.toString(),
      {
        guestId: stayGuest.guest.id,
        ageAtCheckIn: stayGuest.ageAtCheckIn,
        isChargeable: stayGuest.isChargeable,
      },
    ]),
  );
}

async function ensureStayExists(stayId: bigint): Promise<StayRecord> {
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
    throw new StaysServiceError(400, "CABIN_INACTIVE", "La cabaña está inactiva.");
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

async function ensureGuestRecords(
  guestIds: bigint[],
): Promise<GuestSummaryRecord[]> {
  const uniqueGuestIds = uniqueBigIntValues(guestIds);
  if (uniqueGuestIds.length === 0) return [];

  const records = await staysRepository.findGuestsByIds(uniqueGuestIds);
  if (records.length !== uniqueGuestIds.length) {
    throw new StaysServiceError(
      400,
      "INVALID_GUEST_IDS",
      "Uno o más huéspedes no existen.",
    );
  }

  const byId = new Map(records.map((record) => [record.id.toString(), record]));
  return uniqueGuestIds.map((guestId) => {
    const record = byId.get(guestId.toString());
    if (!record) {
      throw new StaysServiceError(
        400,
        "INVALID_GUEST_IDS",
        "Uno o más huéspedes no existen.",
      );
    }
    return record;
  });
}

function ensureCabinCapacity(guestCount: number, cabinCapacity: number): void {
  if (guestCount > cabinCapacity) {
    throw new StaysServiceError(
      409,
      "CABIN_CAPACITY_EXCEEDED",
      `La cabaña admite un máximo de ${cabinCapacity} huéspedes.`,
    );
  }
}

async function resolveApplicableRate(checkInDate: Date) {
  const rate = await staysRepository.findApplicableLodgingRate(checkInDate);
  if (!rate) {
    throw new StaysServiceError(
      409,
      "LODGING_RATE_NOT_CONFIGURED",
      "No existe una tarifa de hospedaje vigente para la fecha de entrada.",
    );
  }
  return rate;
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
  const checkedInStaysCount =
    await staysRepository.countCheckedInStaysByCabin(
      cabinId,
      excludeStayId,
    );
  if (checkedInStaysCount === 0) {
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

function ensureStayHasNoIssuedLodgingInvoice(stay: StayRecord): void {
  if (staysRepository.hasIssuedLodgingInvoice(stay)) {
    throw new StaysServiceError(
      409,
      "STAY_ALREADY_INVOICED_NOT_EDITABLE",
      "No puedes cambiar cabaña, fechas o huéspedes porque la estadía ya tiene una factura de hospedaje emitida.",
    );
  }
}

function ensureStatusTransitionAllowed(
  currentStatus: StayStatus,
  nextStatus: StayStatus,
): void {
  const allowedTransitions: Record<StayStatus, StayStatus[]> = {
    [StayStatus.BOOKED]: [StayStatus.CHECKED_IN, StayStatus.CANCELLED],
    [StayStatus.CHECKED_IN]: [
      StayStatus.CHECKED_OUT,
      StayStatus.CANCELLED,
    ],
    [StayStatus.CHECKED_OUT]: [],
    [StayStatus.CANCELLED]: [],
  };

  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    throw new StaysServiceError(
      409,
      "INVALID_STAY_STATUS_TRANSITION",
      `No puedes cambiar una estadía de ${currentStatus} a ${nextStatus}.`,
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
  return toStayResponse(await ensureStayExists(stayId));
}

export async function createStay(
  input: CreateStayBodyInput,
  actorUserId: string,
): Promise<StayResponseDto> {
  const createdBy = parseUserId(actorUserId);
  const status = input.status as StayStatus;
  if (status !== StayStatus.BOOKED && status !== StayStatus.CHECKED_IN) {
    throw new StaysServiceError(
      400,
      "INVALID_INITIAL_STAY_STATUS",
      "Una estadía nueva solo puede iniciar como reservada o con check-in realizado.",
    );
  }

  const cabin = await ensureCabinCanBeUsed(input.cabinId, status);

  await ensureCabinHasNoDateConflict(
    input.cabinId,
    input.checkInDate,
    input.checkOutDate,
  );

  const guestRecords = await ensureGuestRecords([
    input.primaryGuestId,
    ...input.guestIds,
  ]);
  ensureCabinCapacity(guestRecords.length, cabin.capacity);

  const rate = await resolveApplicableRate(input.checkInDate);
  const guestSnapshots = buildGuestSnapshots(
    guestRecords,
    input.checkInDate,
    rate.minimumChargeableAge,
  );

  const createdStay = await staysRepository.createStay({
    cabinId: input.cabinId,
    primaryGuestId: input.primaryGuestId,
    lodgingRateId: rate.id,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    ratePerPersonPerNight: rate.amountPerPersonPerNight,
    minimumChargeableAge: rate.minimumChargeableAge,
    status,
    createdBy,
    guests: guestSnapshots,
  });

  return toStayResponse(createdStay);
}

export async function updateStay(
  stayId: bigint,
  input: UpdateStayBodyInput,
): Promise<StayResponseDto> {
  const currentStay = await ensureStayExists(stayId);
  ensureStayIsEditable(currentStay.status);
  ensureStayHasNoIssuedLodgingInvoice(currentStay);

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

  const cabinChanged = !sameBigInt(nextCabinId, currentStay.cabinId);
  const checkInChanged =
    nextCheckInDate.getTime() !== currentStay.checkInDate.getTime();

  const targetCabin = cabinChanged
    ? await ensureCabinCanBeUsed(nextCabinId, currentStay.status)
    : currentStay.cabin;

  await ensureCabinHasNoDateConflict(
    nextCabinId,
    nextCheckInDate,
    nextCheckOutDate,
    stayId,
  );

  const currentGuestIds = currentStay.stayGuests.map(
    (stayGuest) => stayGuest.guest.id,
  );
  const primaryChanged = !sameBigInt(
    nextPrimaryGuestId,
    currentStay.primaryGuestId,
  );
  const nextGuestIds =
    primaryChanged &&
    !currentGuestIds.some((guestId) => sameBigInt(guestId, nextPrimaryGuestId))
      ? [
          nextPrimaryGuestId,
          ...currentGuestIds.filter(
            (guestId) => !sameBigInt(guestId, currentStay.primaryGuestId),
          ),
        ]
      : [nextPrimaryGuestId, ...currentGuestIds];
  const guestRecords = await ensureGuestRecords(nextGuestIds);
  ensureCabinCapacity(guestRecords.length, targetCabin.capacity);

  const rate = checkInChanged
    ? await resolveApplicableRate(nextCheckInDate)
    : {
        id: currentStay.lodgingRateId,
        amountPerPersonPerNight: currentStay.ratePerPersonPerNight,
        minimumChargeableAge: currentStay.minimumChargeableAge,
      };

  const preservedSnapshots = checkInChanged
    ? undefined
    : currentSnapshotMap(currentStay);
  const guestSnapshots = buildGuestSnapshots(
    guestRecords,
    nextCheckInDate,
    rate.minimumChargeableAge,
    preservedSnapshots,
  );

  const updatedStay = await staysRepository.updateStayAndGuests(
    stayId,
    {
      ...(cabinChanged ? { cabinId: nextCabinId } : {}),
      ...(primaryChanged ? { primaryGuestId: nextPrimaryGuestId } : {}),
      ...(input.checkInDate ? { checkInDate: nextCheckInDate } : {}),
      ...(input.checkOutDate ? { checkOutDate: nextCheckOutDate } : {}),
      ...(checkInChanged
        ? {
            lodgingRateId: rate.id,
            ratePerPersonPerNight: rate.amountPerPersonPerNight,
            minimumChargeableAge: rate.minimumChargeableAge,
          }
        : {}),
    },
    guestSnapshots,
  );

  if (currentStay.status === StayStatus.CHECKED_IN && cabinChanged) {
    await releaseCabinIfPossible(currentStay.cabinId, stayId);
    await staysRepository.updateCabinStatus(nextCabinId, cabins_status.OCCUPIED);
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

  ensureStatusTransitionAllowed(currentStay.status, nextStatus);

  if (
    nextStatus === StayStatus.CANCELLED &&
    staysRepository.hasIssuedLodgingInvoice(currentStay)
  ) {
    throw new StaysServiceError(
      409,
      "STAY_HAS_ISSUED_INVOICE",
      "Debes anular la factura de hospedaje antes de cancelar la estadía.",
    );
  }

  if (nextStatus === StayStatus.CHECKED_IN) {
    const cabin = await ensureCabinCanBeUsed(
      currentStay.cabinId,
      StayStatus.CHECKED_IN,
    );
    ensureCabinCapacity(currentStay._count.stayGuests, cabin.capacity);
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

  return toStayResponse(
    await staysRepository.updateStay(stayId, { status: nextStatus }),
  );
}

export async function replaceStayGuests(
  stayId: bigint,
  input: ReplaceStayGuestsBodyInput,
): Promise<StayResponseDto> {
  const currentStay = await ensureStayExists(stayId);
  ensureStayIsEditable(currentStay.status);
  ensureStayHasNoIssuedLodgingInvoice(currentStay);

  const guestRecords = await ensureGuestRecords([
    currentStay.primaryGuestId,
    ...input.guestIds,
  ]);
  ensureCabinCapacity(guestRecords.length, currentStay.cabin.capacity);

  const guestSnapshots = buildGuestSnapshots(
    guestRecords,
    currentStay.checkInDate,
    currentStay.minimumChargeableAge,
    currentSnapshotMap(currentStay),
  );

  return toStayResponse(
    await staysRepository.replaceStayGuests(stayId, guestSnapshots),
  );
}
