import { useCallback, useEffect, useRef, useState } from 'react';
import type { ServerMessage, ClientMessage } from '@party-babel/shared';

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<ConnectionState>('disconnected');
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onMessageRef = useRef<(msg: ServerMessage) => void>(undefined);
  const intentionalClose = useRef(false);

  const connect = useCallback(() => {
    // Don't open a second socket if one is already open or connecting
    const rs = wsRef.current?.readyState;
    if (rs === WebSocket.OPEN || rs === WebSocket.CONNECTING) return;

    intentionalClose.current = false;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);

    setState('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) { ws.close(); return; } // stale socket
      setState('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        onMessageRef.current?.(msg);
      } catch (err) {
        console.warn('[ws] Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
        setState('disconnected');
      }
      // Only auto-reconnect if not an intentional close
      if (!intentionalClose.current && wsRef.current === null) {
        reconnectTimer.current = setTimeout(() => connect(), 2000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [url]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn('[ws] send dropped, readyState:', wsRef.current?.readyState, 'type:', msg.type);
    }
  }, []);

  const disconnect = useCallback(() => {
    intentionalClose.current = true;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    setState('disconnected');
  }, []);

  useEffect(() => {
    return () => {
      intentionalClose.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  return { state, send, connect, disconnect, onMessageRef };
}
