import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import type { ServerMessage, InputMode } from '@party-babel/shared';
import type { WorldPatch, WorldTask, WorldEntity, WorldRelation, WorldDiagram } from '@party-babel/shared';

export interface RoomUser {
  userId: string;
  displayName: string;
  speakLang: string;
  targetLang: string;
}

export interface Utterance {
  utteranceId: string;
  speakerId: string;
  text: string;
  tStartMs: number;
  tEndMs: number;
  langGuess?: string;
  translations: Map<string, string>;
}

export interface RoomState {
  users: RoomUser[];
  inputMode: InputMode;
  utterances: Utterance[];
  drafts: Map<string, string>; // speakerId -> draft text
  entities: Map<string, WorldEntity>;
  relations: WorldRelation[];
  tasks: WorldTask[];
  diagram: WorldDiagram | null;
  worldVersion: number;
  engineStatus: { sttEngine: string; translationEngine: string; latencyMs: number; warnings: string[] } | null;
}

const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

export function useRoom(roomId: string) {
  const { state: connState, send, connect, disconnect, onMessageRef } = useWebSocket(wsUrl);
  const pendingJoin = useRef<Parameters<typeof send>[0] | null>(null);

  const [roomState, setRoom] = useState<RoomState>({
    users: [],
    inputMode: 'per_user_mic',
    utterances: [],
    drafts: new Map(),
    entities: new Map(),
    relations: [],
    tasks: [],
    diagram: null,
    worldVersion: 0,
    engineStatus: null,
  });

  // Process incoming messages via callback (no unbounded array)
  useEffect(() => {
    onMessageRef.current = (msg: ServerMessage) => {
      setRoom(prev => {
        switch (msg.type) {
          case 'room_state':
            return { ...prev, users: msg.users, inputMode: msg.inputMode };

          case 'transcript_delta': {
            const newDrafts = new Map(prev.drafts);
            const existing = newDrafts.get(msg.speakerId) || '';
            newDrafts.set(msg.speakerId, existing + (existing ? ' ' : '') + msg.text);
            return { ...prev, drafts: newDrafts };
          }

          case 'utterance_commit': {
            const newDrafts = new Map(prev.drafts);
            newDrafts.delete(msg.speakerId);
            const utt: Utterance = {
              utteranceId: msg.utteranceId,
              speakerId: msg.speakerId,
              text: msg.text,
              tStartMs: msg.tStartMs,
              tEndMs: msg.tEndMs,
              langGuess: msg.langGuess,
              translations: new Map(),
            };
            return { ...prev, utterances: [...prev.utterances, utt], drafts: newDrafts };
          }

          case 'translation_commit': {
            const utts = prev.utterances.map(u => {
              if (u.utteranceId === msg.utteranceId) {
                const newTranslations = new Map(u.translations);
                newTranslations.set(msg.targetLang, msg.text);
                return { ...u, translations: newTranslations };
              }
              return u;
            });
            return { ...prev, utterances: utts };
          }

          case 'world_patch': {
            const patch = msg.patch as WorldPatch;
            const newEntities = new Map(prev.entities);
            for (const e of patch.newEntities || []) {
              newEntities.set(e.id, e);
            }
            const newRelations = [...prev.relations, ...(patch.newRelations || [])];
            const newTasks = [...prev.tasks, ...(patch.newTasks || [])];
            return {
              ...prev,
              entities: newEntities,
              relations: newRelations,
              tasks: newTasks,
              diagram: patch.diagram || prev.diagram,
              worldVersion: patch.version,
            };
          }

          case 'engine_status':
            return { ...prev, engineStatus: msg };

          case 'error':
            console.error(`[server] ${(msg as any).code}: ${(msg as any).message}`);
            return prev;

          default:
            return prev;
        }
      });
    };
  }, [onMessageRef]);

  // Send pending join when connection opens (also handles reconnect)
  useEffect(() => {
    if (connState === 'connected' && pendingJoin.current) {
      send(pendingJoin.current);
    }
  }, [connState, send]);

  const joinRoom = useCallback((opts: {
    userId: string;
    displayName: string;
    speakLang: string;
    targetLang: string;
    inputMode: InputMode;
  }) => {
    pendingJoin.current = { type: 'join_room', roomId, ...opts };
    connect();
  }, [roomId, connect]);

  const toggleVisualize = useCallback((userId: string, enabled: boolean) => {
    send({ type: 'toggle_visualize', roomId, userId, enabled });
  }, [roomId, send]);

  const setTargetLang = useCallback((userId: string, targetLang: string) => {
    send({ type: 'set_target_lang', roomId, userId, targetLang });
  }, [roomId, send]);

  return {
    connState,
    roomState,
    joinRoom,
    send,
    toggleVisualize,
    setTargetLang,
    disconnect,
  };
}
