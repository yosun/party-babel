import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { config } from './config.js';
import { handleWsConnection } from './ws/handler.js';
import { getEngineStatus } from './stt/index.js';
import { simulateConversation } from './simulate.js';
import { nanoid } from 'nanoid';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss' },
      },
    },
    genReqId: () => nanoid(12),
  });

  await app.register(cors, { origin: true });
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });
  await app.register(websocket);

  // ── Health ────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', ts: Date.now() }));

  // ── Engine status ─────────────────────────────────────
  app.get('/engine-status', async () => getEngineStatus());

  // ── Simulate conversation ─────────────────────────────
  const SimulateBody = z.object({ roomId: z.string().min(1).max(64).optional() });
  app.post('/api/simulate', async (req, reply) => {
    const parsed = SimulateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.issues });
    }
    const id = parsed.data.roomId || `demo-${nanoid(6)}`;
    simulateConversation(id);
    return { roomId: id, status: 'started' };
  });

  // ── WebSocket ─────────────────────────────────────────
  app.get('/ws', { websocket: true }, (socket, req) => {
    const connId = nanoid(12);
    req.log.info({ connId }, 'WS connected');
    handleWsConnection(socket, connId, req.log);
  });

  return app;
}
