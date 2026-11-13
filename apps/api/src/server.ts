import path from "node:path";
import dotenv from "dotenv";

// Load .env from workspace root or current directory
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

import cors from "@fastify/cors";
import Fastify from "fastify";
import { initDb } from "./db/index.js";
import { chatRoutes } from "./routes/chat.js";
import { healthRoutes } from "./routes/health.js";

export async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? true,
  });
  await app.register(healthRoutes);
  await app.register(chatRoutes);

  return app;
}

const start = async () => {
  // Automatically initialize database schema and indexes on startup
  if (process.env.DATABASE_URL || process.env.DATABASE_URL_POOLED) {
    try {
      await initDb();
    } catch (err) {
      console.error("[server] Failed to initialize database schema:", err);
    }
  }

  const app = await buildServer();
  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? "0.0.0.0";

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
