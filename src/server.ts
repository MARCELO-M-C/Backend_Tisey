import { buildApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { initRealtime } from "./realtime/socket";

async function startServer(): Promise<void> {
  const app = await buildApp();
  const io = initRealtime(app.server);

  app.addHook("onClose", async () => {
    io.close();
    await prisma.$disconnect();
  });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Graceful shutdown");
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT,
    });

    app.log.info(`Swagger disponible en http://localhost:${env.PORT}/docs`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void startServer();
