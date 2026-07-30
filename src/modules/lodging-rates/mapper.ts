import type { LodgingRateRecord } from "./repository";

export interface LodgingRateResponseDto {
  id: string;
  amountPerPersonPerNight: string;
  minimumChargeableAge: number;
  effectiveFrom: string;
  createdAt: string;
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function toLodgingRateResponse(
  record: LodgingRateRecord,
): LodgingRateResponseDto {
  return {
    id: record.id.toString(),
    amountPerPersonPerNight: record.amountPerPersonPerNight.toFixed(2),
    minimumChargeableAge: record.minimumChargeableAge,
    effectiveFrom: toDateOnly(record.effectiveFrom),
    createdAt: record.createdAt.toISOString(),
  };
}
