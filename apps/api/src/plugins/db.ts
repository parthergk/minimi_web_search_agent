import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { client, db } from "@minimi/db";

declare module "fastify" {
  interface FastifyInstance {
    db: typeof db;
  }
}

export const dbPlugin = fp(
  async (app: FastifyInstance): Promise<void> => {
    app.decorate("db", db);

    app.addHook("onClose", async () => {
      await client.end();
    });
  },
  {
    name: "db",
  }
);

