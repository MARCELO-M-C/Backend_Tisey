import { toStationResponse, type StationResponseDto } from "./mapper";
import * as stationsRepository from "./repository";
import type {
  CreateStationBodyInput,
  ListStationsQueryInput,
  UpdateStationBodyInput,
  UpdateStationStatusBodyInput,
} from "./schemas";

export class StationsServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "StationsServiceError";
  }
}

function normalizeStationCode(code: string): string {
  return code.trim().toUpperCase();
}

async function ensureStationExists(stationId: bigint) {
  const station = await stationsRepository.findStationById(stationId);

  if (!station) {
    throw new StationsServiceError(
      404,
      "STATION_NOT_FOUND",
      "Estación no encontrada.",
    );
  }

  return station;
}

export async function listStations(
  filters: ListStationsQueryInput,
): Promise<StationResponseDto[]> {
  const stations = await stationsRepository.listStations(filters);
  return stations.map(toStationResponse);
}

export async function getStationById(
  stationId: bigint,
): Promise<StationResponseDto> {
  const station = await ensureStationExists(stationId);
  return toStationResponse(station);
}

export async function createStation(
  input: CreateStationBodyInput,
): Promise<StationResponseDto> {
  const normalizedCode = normalizeStationCode(input.code);
  const normalizedName = input.name.trim();

  const existingStation = await stationsRepository.findStationByCode(
    normalizedCode,
  );

  if (existingStation) {
    throw new StationsServiceError(
      409,
      "STATION_CODE_ALREADY_EXISTS",
      "Ya existe una estación con ese código.",
    );
  }

  const createdStation = await stationsRepository.createStation({
    code: normalizedCode,
    name: normalizedName,
    isActive: input.isActive,
  });

  return toStationResponse(createdStation);
}

export async function updateStation(
  stationId: bigint,
  input: UpdateStationBodyInput,
): Promise<StationResponseDto> {
  const currentStation = await ensureStationExists(stationId);

  const nextCode = input.code ? normalizeStationCode(input.code) : undefined;
  const nextName = input.name?.trim();

  if (nextCode && nextCode !== currentStation.code) {
    const duplicatedStation = await stationsRepository.findStationByCode(
      nextCode,
    );

    if (duplicatedStation && duplicatedStation.id !== stationId) {
      throw new StationsServiceError(
        409,
        "STATION_CODE_ALREADY_EXISTS",
        "Ya existe una estación con ese código.",
      );
    }
  }

  const updatedStation = await stationsRepository.updateStation(stationId, {
    ...(nextCode ? { code: nextCode } : {}),
    ...(nextName ? { name: nextName } : {}),
  });

  return toStationResponse(updatedStation);
}

export async function updateStationStatus(
  stationId: bigint,
  input: UpdateStationStatusBodyInput,
): Promise<StationResponseDto> {
  await ensureStationExists(stationId);

  if (!input.isActive) {
    const activeMenuItemsCount =
      await stationsRepository.countActiveMenuItemsByStation(stationId);

    if (activeMenuItemsCount > 0) {
      throw new StationsServiceError(
        409,
        "STATION_HAS_ACTIVE_MENU_ITEMS",
        "No puedes desactivar una estación que todavía tiene ítems activos del menú.",
      );
    }
  }

  const updatedStation = await stationsRepository.updateStation(stationId, {
    isActive: input.isActive,
  });

  return toStationResponse(updatedStation);
}