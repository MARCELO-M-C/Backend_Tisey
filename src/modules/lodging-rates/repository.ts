import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

const lodgingRateSelect = Prisma.validator<Prisma.LodgingRateDefaultArgs>()({
  select: {
    id: true,
    amountPerPersonPerNight: true,
    minimumChargeableAge: true,
    effectiveFrom: true,
    createdAt: true,
  },
});

export type LodgingRateRecord = Prisma.LodgingRateGetPayload<
  typeof lodgingRateSelect
>;

export interface ListLodgingRatesFilters {
  effectiveFrom?: Date;
  effectiveTo?: Date;
}

export interface CreateLodgingRateRepositoryInput {
  amountPerPersonPerNight: Prisma.Decimal;
  minimumChargeableAge: number;
  effectiveFrom: Date;
}

export async function listLodgingRates(
  filters: ListLodgingRatesFilters,
): Promise<LodgingRateRecord[]> {
  return prisma.lodgingRate.findMany({
    where: {
      ...(filters.effectiveFrom || filters.effectiveTo
        ? {
            effectiveFrom: {
              ...(filters.effectiveFrom ? { gte: filters.effectiveFrom } : {}),
              ...(filters.effectiveTo ? { lte: filters.effectiveTo } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    ...lodgingRateSelect,
  });
}

export async function findLodgingRateByEffectiveFrom(
  effectiveFrom: Date,
): Promise<LodgingRateRecord | null> {
  return prisma.lodgingRate.findUnique({
    where: { effectiveFrom },
    ...lodgingRateSelect,
  });
}

export async function findApplicableLodgingRate(
  date: Date,
): Promise<LodgingRateRecord | null> {
  return prisma.lodgingRate.findFirst({
    where: {
      effectiveFrom: {
        lte: date,
      },
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    ...lodgingRateSelect,
  });
}

export async function createLodgingRate(
  data: CreateLodgingRateRepositoryInput,
): Promise<LodgingRateRecord> {
  return prisma.lodgingRate.create({
    data,
    ...lodgingRateSelect,
  });
}
