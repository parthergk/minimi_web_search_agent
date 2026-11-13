import cors from '@fastify/cors';
import Fastify from 'fastify';
import { chatRoutes } from './routes/chat.js';
import { healthRoutes } from './routes/health.js';

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
  const app = await buildServer();
  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? '0.0.0.0';

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
