import { z } from 'zod';

const envSchema = z.object({
  STT_ENGINE: z.enum(['transformers', 'vllm']).default('transformers'),
  VOXTRAL_MODEL_ID: z.string().default('mistralai/Voxtral-Mini-4B-Realtime-2602'),
  TRANSCRIPTION_DELAY_MS: z.coerce.number().int().positive().default(480),
  VLLM_REALTIME_URL: z.string().default('http://localhost:8000/v1/realtime'),
  LOCAL_LLM_URL: z.string().default(''),
  DATABASE_URL: z.string().default('postgresql://party:party@localhost:5432/party_babel'),
  JWT_SECRET: z.string().default('dev-secret-change-me'),
  PORT: z.coerce.number().int().default(3001),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  REDIS_URL: z.string().default(''),
});

export const config = envSchema.parse(process.env);
export type Config = typeof config;
