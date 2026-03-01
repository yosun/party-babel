import type { UsageRecord } from '@party-babel/shared';

/** In-memory usage metering (production would persist to DB) */
const usageRecords: UsageRecord[] = [];
const MAX_USAGE_RECORDS = 50_000;

export function recordUsage(roomId: string, userId: string, audioSeconds: number): void {
  if (usageRecords.length >= MAX_USAGE_RECORDS) {
    usageRecords.splice(0, MAX_USAGE_RECORDS / 4);
  }
  usageRecords.push({
    roomId,
    userId,
    audioSecondsProcessed: audioSeconds,
    translationsGenerated: 0,
    timestamp: Date.now(),
  });
}

export function recordTranslation(roomId: string, userId: string): void {
  if (usageRecords.length >= MAX_USAGE_RECORDS) {
    usageRecords.splice(0, MAX_USAGE_RECORDS / 4);
  }
  usageRecords.push({
    roomId,
    userId,
    audioSecondsProcessed: 0,
    translationsGenerated: 1,
    timestamp: Date.now(),
  });
}

export function getUsageForRoom(roomId: string): { audioSeconds: number; translations: number } {
  let audio = 0;
  let translations = 0;
  for (const r of usageRecords) {
    if (r.roomId === roomId) {
      audio += r.audioSecondsProcessed;
      translations += r.translationsGenerated;
    }
  }
  return { audioSeconds: Math.round(audio * 100) / 100, translations };
}

export function getAllUsage(): UsageRecord[] {
  return usageRecords;
}
