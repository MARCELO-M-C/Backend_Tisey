import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

export type OrderRealtimeEvent = "orders:new" | "orders:update";

let io: SocketIOServer | null = null;

export function initRealtime(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("orders:subscribe", (stationId?: string) => {
      if (!stationId) {
        return;
      }

      socket.join(`station:${stationId}`);
    });
  });

  return io;
}

export function emitOrderRealtime(
  event: OrderRealtimeEvent,
  payload: Record<string, unknown>,
  stationId?: string,
): void {
  if (!io) {
    return;
  }

  if (stationId) {
    io.to(`station:${stationId}`).emit(event, payload);
    return;
  }

  io.emit(event, payload);
}
