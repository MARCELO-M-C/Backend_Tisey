import type { Prisma } from "@prisma/client";

const ORDER_CODE_PREFIX = "ORD";

function buildDatePart(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}${month}${day}`;
}

export async function getNextOrderCode(
  tx: Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<string> {
  const datePart = buildDatePart(now);
  const prefix = `${ORDER_CODE_PREFIX}-${datePart}-`;

  const lastOrder = await tx.order.findFirst({
    where: {
      orderCode: {
        startsWith: prefix,
      },
    },
    orderBy: {
      orderCode: "desc",
    },
    select: {
      orderCode: true,
    },
  });

  let nextSequence = 1;

  if (lastOrder?.orderCode) {
    const match = lastOrder.orderCode.match(/-(\d+)$/);
    if (match) {
      nextSequence = Number(match[1]) + 1;
    }
  }

  return `${prefix}${`${nextSequence}`.padStart(4, "0")}`;
}
