import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import Fastify from 'fastify';
import { dbPlugin } from './plugins/db.js';
import { chatRoutes } from './routes/chat.js';
import { conversationRoutes } from './routes/conversations.js';
import { healthRoutes } from './routes/health.js';
import { userRoutes } from './routes/users.js';

export async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  await app.register(dbPlugin);
  await app.register(healthRoutes);
  await app.register(userRoutes);
  await app.register(conversationRoutes);
  await app.register(chatRoutes);

  return app;
}

const start = async () => {
  const app = await buildServer();
  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? '0.0.0.0';

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();