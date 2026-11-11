import type { FastifyInstance } from 'fastify';
import { sql } from "drizzle-orm";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    const result = await app.db.execute(sql`SELECT NOW() AS current_time`);

    return {
      status: "connected",
      database: "neon-postgresql",
      time: result[0]?.current_time,
    };
  });
}