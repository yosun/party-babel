import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';

describe('WebSocket Event Flow', () => {
  let app: FastifyInstance;
  let baseUrl: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const addr = app.server.address();
    if (typeof addr === 'object' && addr) {
      baseUrl = `ws://127.0.0.1:${addr.port}`;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns health check', async () => {
    const addr = app.server.address();
    if (typeof addr !== 'object' || !addr) throw new Error('No address');
    const resp = await fetch(`http://127.0.0.1:${addr.port}/health`);
    const body = await resp.json();
    expect(body.status).toBe('ok');
  });

  it('returns engine status', async () => {
    const addr = app.server.address();
    if (typeof addr !== 'object' || !addr) throw new Error('No address');
    const resp = await fetch(`http://127.0.0.1:${addr.port}/engine-status`);
    const body = await resp.json();
    expect(body.sttEngine).toBeDefined();
    expect(body.translationEngine).toBeDefined();
  });

  it('handles join_room and returns room_state', async () => {
    const ws = new WebSocket(`${baseUrl}/ws`);

    const messages: unknown[] = [];

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'join_room',
          roomId: 'test-room-1',
          userId: 'user-1',
          displayName: 'Test User',
          speakLang: 'en',
          targetLang: 'es',
          inputMode: 'per_user_mic',
        }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(String(data));
        messages.push(msg);

        if (msg.type === 'room_state') {
          clearTimeout(timeout);
          resolve();
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    ws.close();

    const roomState = messages.find((m: any) => m.type === 'room_state') as any;
    expect(roomState).toBeDefined();
    expect(roomState.roomId).toBe('test-room-1');
    expect(roomState.users).toHaveLength(1);
    expect(roomState.users[0].userId).toBe('user-1');
    expect(roomState.inputMode).toBe('per_user_mic');
  });

  it('rejects invalid messages with error', async () => {
    const ws = new WebSocket(`${baseUrl}/ws`);

    const error = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'invalid_type', foo: 'bar' }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(String(data));
        if (msg.type === 'error') {
          clearTimeout(timeout);
          resolve(msg);
        }
      });
    });

    ws.close();

    expect(error.type).toBe('error');
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('handles simulate conversation endpoint', async () => {
    const addr = app.server.address();
    if (typeof addr !== 'object' || !addr) throw new Error('No address');
    const resp = await fetch(`http://127.0.0.1:${addr.port}/api/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: 'sim-test' }),
    });
    const body = await resp.json();
    expect(body.status).toBe('started');
    expect(body.roomId).toBe('sim-test');
  });
});
