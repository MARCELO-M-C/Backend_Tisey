import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

const guestSelect = Prisma.validator<Prisma.GuestDefaultArgs>()({
  select: {
    id: true,
    fullName: true,
    idNumber: true,
    originPlace: true,
    createdAt: true,
    _count: {
      select: {
        stayGuests: true,
        primaryStays: true,
      },
    },
  },
});

export type GuestRecord = Prisma.GuestGetPayload<typeof guestSelect>;

export interface ListGuestsFilters {
  search?: string;
  idNumber?: string;
}

export interface CreateGuestRepositoryInput {
  fullName: string;
  idNumber?: string | null;
  originPlace?: string | null;
}

export interface UpdateGuestRepositoryInput {
  fullName?: string;
  idNumber?: string | null;
  originPlace?: string | null;
}

export async function listGuests(
  filters: ListGuestsFilters,
): Promise<GuestRecord[]> {
  return prisma.guest.findMany({
    where: {
      ...(filters.idNumber
        ? {
            idNumber: {
              contains: filters.idNumber,
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              {
                fullName: {
                  contains: filters.search,
                },
              },
              {
                idNumber: {
                  contains: filters.search,
                },
              },
              {
                originPlace: {
                  contains: filters.search,
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ fullName: "asc" }, { createdAt: "desc" }],
    ...guestSelect,
  });
}

export async function findGuestById(
  guestId: bigint,
): Promise<GuestRecord | null> {
  return prisma.guest.findUnique({
    where: { id: guestId },
    ...guestSelect,
  });
}

export async function createGuest(
  data: CreateGuestRepositoryInput,
): Promise<GuestRecord> {
  return prisma.guest.create({
    data: {
      fullName: data.fullName,
      idNumber: data.idNumber ?? null,
      originPlace: data.originPlace ?? null,
    },
    ...guestSelect,
  });
}

export async function updateGuest(
  guestId: bigint,
  data: UpdateGuestRepositoryInput,
): Promise<GuestRecord> {
  return prisma.guest.update({
    where: { id: guestId },
    data,
    ...guestSelect,
  });
}