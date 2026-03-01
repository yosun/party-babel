import { useCallback, useEffect, useRef, useState } from 'react';
import type { ServerMessage, ClientMessage } from '@party-babel/shared';

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [messages, setMessages] = useState<ServerMessage[]>([]);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setState('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setState('connected');

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        setMessages(prev => [...prev, msg]);
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setState('disconnected');
      // Auto-reconnect after 2s
      reconnectTimer.current = setTimeout(() => connect(), 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [url]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    setState('disconnected');
  }, []);

  useEffect(() => {
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  return { state, messages, send, connect, disconnect };
}
