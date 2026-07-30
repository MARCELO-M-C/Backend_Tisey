import { Prisma } from "@prisma/client";
import {
  toLodgingRateResponse,
  type LodgingRateResponseDto,
} from "./mapper";
import * as lodgingRatesRepository from "./repository";
import type {
  CreateLodgingRateBodyInput,
  CurrentLodgingRateQueryInput,
  ListLodgingRatesQueryInput,
} from "./schemas";

export class LodgingRatesServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "LodgingRatesServiceError";
  }
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function listLodgingRates(
  filters: ListLodgingRatesQueryInput,
): Promise<LodgingRateResponseDto[]> {
  const rates = await lodgingRatesRepository.listLodgingRates(filters);
  return rates.map(toLodgingRateResponse);
}

export async function getCurrentLodgingRate(
  input: CurrentLodgingRateQueryInput,
): Promise<LodgingRateResponseDto> {
  const rate = await lodgingRatesRepository.findApplicableLodgingRate(
    input.date ?? todayUtc(),
  );

  if (!rate) {
    throw new LodgingRatesServiceError(
      404,
      "LODGING_RATE_NOT_CONFIGURED",
      "No existe una tarifa de hospedaje vigente para la fecha indicada.",
    );
  }

  return toLodgingRateResponse(rate);
}

export async function createLodgingRate(
  input: CreateLodgingRateBodyInput,
): Promise<LodgingRateResponseDto> {
  const existingRate =
    await lodgingRatesRepository.findLodgingRateByEffectiveFrom(
      input.effectiveFrom,
    );

  if (existingRate) {
    throw new LodgingRatesServiceError(
      409,
      "LODGING_RATE_EFFECTIVE_DATE_EXISTS",
      "Ya existe una tarifa con esa fecha de vigencia.",
    );
  }

  const createdRate = await lodgingRatesRepository.createLodgingRate({
    amountPerPersonPerNight: new Prisma.Decimal(
      input.amountPerPersonPerNight,
    ),
    minimumChargeableAge: input.minimumChargeableAge,
    effectiveFrom: input.effectiveFrom,
  });

  return toLodgingRateResponse(createdRate);
}
