import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

/** Dev-mode JWT for WebSocket auth — structured for production replacement */

export function signToken(payload: { userId: string; tier?: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  })).toString('base64url');
  const sig = createHmac('sha256', config.JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string): { userId: string; tier?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = createHmac('sha256', config.JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    const sigBuf = Buffer.from(sig, 'base64url');
    const expectedBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
