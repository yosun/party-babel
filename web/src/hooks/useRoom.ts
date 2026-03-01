import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const { state: connState, messages, send, connect, disconnect } = useWebSocket(wsUrl);

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

  // Process incoming messages
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];

    setRoom(prev => {
      switch (lastMsg.type) {
        case 'room_state':
          return { ...prev, users: lastMsg.users, inputMode: lastMsg.inputMode };

        case 'transcript_delta': {
          const newDrafts = new Map(prev.drafts);
          const existing = newDrafts.get(lastMsg.speakerId) || '';
          newDrafts.set(lastMsg.speakerId, existing + (existing ? ' ' : '') + lastMsg.text);
          return { ...prev, drafts: newDrafts };
        }

        case 'utterance_commit': {
          const newDrafts = new Map(prev.drafts);
          newDrafts.delete(lastMsg.speakerId);
          const utt: Utterance = {
            utteranceId: lastMsg.utteranceId,
            speakerId: lastMsg.speakerId,
            text: lastMsg.text,
            tStartMs: lastMsg.tStartMs,
            tEndMs: lastMsg.tEndMs,
            langGuess: lastMsg.langGuess,
            translations: new Map(),
          };
          return { ...prev, utterances: [...prev.utterances, utt], drafts: newDrafts };
        }

        case 'translation_commit': {
          const utts = prev.utterances.map(u => {
            if (u.utteranceId === lastMsg.utteranceId) {
              const newTranslations = new Map(u.translations);
              newTranslations.set(lastMsg.targetLang, lastMsg.text);
              return { ...u, translations: newTranslations };
            }
            return u;
          });
          return { ...prev, utterances: utts };
        }

        case 'world_patch': {
          const patch = lastMsg.patch as WorldPatch;
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
          return { ...prev, engineStatus: lastMsg };

        default:
          return prev;
      }
    });
  }, [messages]);

  const joinRoom = useCallback((opts: {
    userId: string;
    displayName: string;
    speakLang: string;
    targetLang: string;
    inputMode: InputMode;
  }) => {
    connect();
    // Small delay to let WS connect
    setTimeout(() => {
      send({
        type: 'join_room',
        roomId,
        ...opts,
      });
    }, 500);
  }, [roomId, connect, send]);

  const sendAudio = useCallback((pcm16_base64: string, seq: number) => {
    send({
      type: 'audio_chunk',
      roomId,
      userId: '', // will be set by the caller
      seq,
      pcm16_base64,
      sampleRate: 16000,
      channels: 1,
    });
  }, [roomId, send]);

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
    sendAudio,
    send,
    toggleVisualize,
    setTargetLang,
    disconnect,
  };
}
