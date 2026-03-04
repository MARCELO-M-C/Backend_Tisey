import { OrderStatus } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { toApiValue } from "../../lib/serialization";
import {
  ROLE_GROUPS,
  authenticate,
  requireAnyRole,
} from "../auth/auth.guards";

type MonthlySalesRow = {
  yearMonth: string;
  invoicesCount: number;
  totalSales: number;
};

type OverdueRow = {
  id: bigint;
  order_code: string;
  status: string;
  channel: string;
  service_mode: string;
  created_at: Date;
  sent_at: Date;
  minutes_since_sent: number;
};

const SALES_GUARDS = [authenticate, requireAnyRole([...ROLE_GROUPS.CASHIER])];
const OVERDUE_GUARDS = [
  authenticate,
  requireAnyRole([...ROLE_GROUPS.WAITER, ...ROLE_GROUPS.KITCHEN, ...ROLE_GROUPS.CASHIER]),
];

export const reportsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/monthly-sales",
    {
      preHandler: SALES_GUARDS,
      schema: {
        tags: ["Reports"],
        summary: "Ventas mensuales (equivalente a v_monthly_sales)",
        security: [{ bearerAuth: [] }],
      },
    },
    async () => {
      const invoices = await prisma.invoice.findMany({
        where: {
          status: "ISSUED",
        },
        select: {
          issuedAt: true,
          total: true,
        },
        orderBy: {
          issuedAt: "desc",
        },
      });

      const byMonthMap = new Map<string, MonthlySalesRow>();

      for (const invoice of invoices) {
        const yearMonth = `${invoice.issuedAt.getUTCFullYear()}-${`${invoice.issuedAt.getUTCMonth() + 1}`.padStart(2, "0")}`;
        const existingMonth = byMonthMap.get(yearMonth);
        const totalValue = Number(invoice.total.toString());

        if (!existingMonth) {
          byMonthMap.set(yearMonth, {
            yearMonth,
            invoicesCount: 1,
            totalSales: totalValue,
          });
          continue;
        }

        existingMonth.invoicesCount += 1;
        existingMonth.totalSales += totalValue;
      }

      const data = [...byMonthMap.values()].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));

      return {
        data,
      };
    },
  );

  app.get(
    "/overdue-orders",
    {
      preHandler: OVERDUE_GUARDS,
      schema: {
        tags: ["Reports"],
        summary: "Pedidos atrasados (equivalente a v_overdue_orders)",
        security: [{ bearerAuth: [] }],
      },
    },
    async () => {
      const now = Date.now();
      const rows = await prisma.order.findMany({
        where: {
          status: {
            in: [OrderStatus.SENT, OrderStatus.IN_PROGRESS],
          },
          sentAt: {
            not: null,
          },
        },
        select: {
          id: true,
          orderCode: true,
          status: true,
          channel: true,
          serviceMode: true,
          createdAt: true,
          sentAt: true,
        },
        orderBy: {
          sentAt: "asc",
        },
      });

      const overdueRows: OverdueRow[] = rows
        .filter((row) => row.sentAt !== null)
        .map((row) => {
          const sentAt = row.sentAt as Date;
          const minutesSinceSent = Math.floor((now - sentAt.getTime()) / 60000);

          return {
            id: row.id,
            order_code: row.orderCode,
            status: row.status,
            channel: row.channel,
            service_mode: row.serviceMode,
            created_at: row.createdAt,
            sent_at: sentAt,
            minutes_since_sent: minutesSinceSent,
          };
        })
        .filter((row) => row.minutes_since_sent >= env.ORDER_ALERT_MINUTES);

      return {
        thresholds: {
          early: env.ORDER_ALERT_MINUTES,
          red: env.ORDER_RED_ALERT_MINUTES,
        },
        data: toApiValue(overdueRows),
      };
    },
  );
};
