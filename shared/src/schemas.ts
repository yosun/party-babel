import { z } from 'zod';

// ── Input Modes ─────────────────────────────────────────
export const InputMode = z.enum(['per_user_mic', 'shared_mic']);
export type InputMode = z.infer<typeof InputMode>;

// ── Client → Server Messages ────────────────────────────
export const JoinRoomMsg = z.object({
  type: z.literal('join_room'),
  roomId: z.string().min(1).max(64),
  userId: z.string().min(1).max(64),
  displayName: z.string().min(1).max(100),
  speakLang: z.string().min(2).max(10),
  targetLang: z.string().min(2).max(10),
  inputMode: InputMode,
});

export const AudioChunkMsg = z.object({
  type: z.literal('audio_chunk'),
  roomId: z.string(),
  userId: z.string(),
  seq: z.number().int().nonnegative(),
  pcm16_base64: z.string(),
  sampleRate: z.literal(16000),
  channels: z.literal(1),
});

export const SetTargetLangMsg = z.object({
  type: z.literal('set_target_lang'),
  roomId: z.string(),
  userId: z.string(),
  targetLang: z.string().min(2).max(10),
});

export const ToggleVisualizeMsg = z.object({
  type: z.literal('toggle_visualize'),
  roomId: z.string(),
  userId: z.string(),
  enabled: z.boolean(),
});

export const TagSpeakerMsg = z.object({
  type: z.literal('tag_speaker'),
  roomId: z.string(),
  userId: z.string(),
  speakerLabel: z.string().min(1).max(100),
});

export const ClientMessage = z.discriminatedUnion('type', [
  JoinRoomMsg,
  AudioChunkMsg,
  SetTargetLangMsg,
  ToggleVisualizeMsg,
  TagSpeakerMsg,
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ── Server → Client Messages ────────────────────────────
export const RoomUserInfo = z.object({
  userId: z.string(),
  displayName: z.string(),
  speakLang: z.string(),
  targetLang: z.string(),
});

export const RoomStateMsg = z.object({
  type: z.literal('room_state'),
  roomId: z.string(),
  users: z.array(RoomUserInfo),
  inputMode: InputMode,
});

export const TranscriptDeltaMsg = z.object({
  type: z.literal('transcript_delta'),
  roomId: z.string(),
  speakerId: z.string(),
  text: z.string(),
  tMs: z.number(),
});

export const UtteranceCommitMsg = z.object({
  type: z.literal('utterance_commit'),
  roomId: z.string(),
  speakerId: z.string(),
  utteranceId: z.string(),
  text: z.string(),
  tStartMs: z.number(),
  tEndMs: z.number(),
  langGuess: z.string().optional(),
  speakerLabel: z.string().optional(),
});

export const TranslationCommitMsg = z.object({
  type: z.literal('translation_commit'),
  roomId: z.string(),
  speakerId: z.string(),
  utteranceId: z.string(),
  targetLang: z.string(),
  text: z.string(),
});

export const WorldPatchMsg = z.object({
  type: z.literal('world_patch'),
  roomId: z.string(),
  patch: z.any(),
  worldVersion: z.number().int(),
  tMs: z.number(),
});

export const EngineStatusMsg = z.object({
  type: z.literal('engine_status'),
  sttEngine: z.string(),
  translationEngine: z.string(),
  latencyMs: z.number(),
  warnings: z.array(z.string()),
});

export const ErrorMsg = z.object({
  type: z.literal('error'),
  code: z.string(),
  message: z.string(),
});

export const ServerMessage = z.discriminatedUnion('type', [
  RoomStateMsg,
  TranscriptDeltaMsg,
  UtteranceCommitMsg,
  TranslationCommitMsg,
  WorldPatchMsg,
  EngineStatusMsg,
  ErrorMsg,
]);
export type ServerMessage = z.infer<typeof ServerMessage>;
