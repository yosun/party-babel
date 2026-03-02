// ── World State Types ────────────────────────────────────
export interface WorldEntity {
  id: string;
  label: string;
  firstSeenUtteranceId: string;
}

export interface WorldRelation {
  from: string;
  to: string;
  type: string;
  sourceUtteranceId: string;
}

export type TaskBucket = 'Now' | 'Next' | 'Later';

export interface WorldTask {
  id: string;
  title: string;
  bucket: TaskBucket;
  sourceUtteranceId: string;
}

export type DiagramType = 'architecture' | 'journey' | 'timeline' | 'decision_tree' | 'hierarchy';

export interface WorldDiagram {
  type: DiagramType;
  mermaidSource: string;
}

export interface WorldState {
  entities: Map<string, WorldEntity>;
  relations: WorldRelation[];
  tasks: WorldTask[];
  diagram: WorldDiagram;
  version: number;
}

export interface WorldPatch {
  newEntities?: WorldEntity[];
  newRelations?: WorldRelation[];
  newTasks?: WorldTask[];
  diagram?: WorldDiagram;
  version: number;
}

// ── Serializable WorldState (for JSON transport) ────────
export interface WorldStateJSON {
  entities: Record<string, WorldEntity>;
  relations: WorldRelation[];
  tasks: WorldTask[];
  diagram: WorldDiagram;
  version: number;
}

// ── Product Tiers ───────────────────────────────────────
export type Tier = 'free' | 'pro' | 'team';

export interface TierLimits {
  maxRoomParticipants: number;
  maxSessionMinutes: number;
  maxLanguages: number;
  visualizeMode: boolean;
  exports: boolean;
  diarization: boolean;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    maxRoomParticipants: 4,
    maxSessionMinutes: 30,
    maxLanguages: 2,
    visualizeMode: false,
    exports: false,
    diarization: false,
  },
  pro: {
    maxRoomParticipants: 12,
    maxSessionMinutes: 120,
    maxLanguages: 10,
    visualizeMode: true,
    exports: true,
    diarization: true,
  },
  team: {
    maxRoomParticipants: 50,
    maxSessionMinutes: 480,
    maxLanguages: 50,
    visualizeMode: true,
    exports: true,
    diarization: true,
  },
};

// ── Usage Metering ──────────────────────────────────────
export interface UsageRecord {
  roomId: string;
  userId: string;
  audioSecondsProcessed: number;
  translationsGenerated: number;
  timestamp: number;
}

// ── Simulation Script ───────────────────────────────────
export interface SimulatedUtterance {
  speakerId: string;
  displayName: string;
  speakLang: string;
  targetLang?: string;
  text: string;
  delayMs: number;
}

export const DEMO_SCRIPT: SimulatedUtterance[] = [
  // ── Solo-hacker 1-minute demo ──────────────────────────
  // Single speaker walks through the full architecture.
  // Each utterance is crafted to trigger heuristic entity/relation/task extraction
  // so the app literally visualizes itself as the presenter speaks.

  // ── Act 1: Frontend ──
  { speakerId: 'presenter', displayName: 'You', speakLang: 'en', targetLang: 'eo',
    text: "The Browser captures audio from the Microphone and sends it to our React frontend. React opens a persistent WebSocket connection to the Server.",
    delayMs: 0 },

  // ── Act 2: Speech Pipeline ──
  { speakerId: 'presenter', displayName: 'You', speakLang: 'en', targetLang: 'eo',
    text: "The Server feeds audio to Voxtral, our speech-to-text engine. Voxtral calls the Mistral model for transcription. Each transcript feeds into the TranslationEngine.",
    delayMs: 10000 },

  // ── Act 3: Translation + Caching ──
  { speakerId: 'presenter', displayName: 'You', speakLang: 'en', targetLang: 'eo',
    text: "TranslationEngine uses Mistral for neural machine translation. TranslationEngine connects to Redis for caching repeated phrases.",
    delayMs: 20000 },

  // ── Act 4: Intelligence ──
  { speakerId: 'presenter', displayName: 'You', speakLang: 'en', targetLang: 'eo',
    text: "ConceptExtractor analyzes every utterance. ConceptExtractor feeds entities and relations into the KnowledgeGraph. KnowledgeGraph feeds MermaidGenerator to produce live diagrams.",
    delayMs: 30000 },

  // ── Act 5: Persistence ──
  { speakerId: 'presenter', displayName: 'You', speakLang: 'en', targetLang: 'eo',
    text: "Server uses Prisma as the ORM. Prisma depends on Postgres for storing transcripts and world state.",
    delayMs: 40000 },

  // ── Act 6: Tasks ──
  { speakerId: 'presenter', displayName: 'You', speakLang: 'en', targetLang: 'eo',
    text: "First write integration tests for WebSocket. Next build the audio preprocessing pipeline. Later add end-to-end encryption.",
    delayMs: 50000 },
];
