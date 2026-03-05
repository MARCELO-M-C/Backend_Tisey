import { buildApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

async function start() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Shutting down gracefully...`);

    try {
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      app.log.error(error, "Error during shutdown");
      process.exit(1);
    }
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

    app.log.info(`Server running at http://${env.HOST}:${env.PORT}`);
    app.log.info(`Swagger docs available at http://${env.HOST}:${env.PORT}/docs`);
  } catch (error) {
    app.log.error(error, "Failed to start server");
    await prisma.$disconnect();
    process.exit(1);
  }
}

void start();
