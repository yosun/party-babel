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

export type DiagramType = 'architecture' | 'journey' | 'timeline' | 'decision_tree';

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
  text: string;
  delayMs: number;
}

export const DEMO_SCRIPT: SimulatedUtterance[] = [
  { speakerId: 'alice', displayName: 'Alice', speakLang: 'en', text: "Welcome everyone! Let's discuss the architecture for our new real-time translation service.", delayMs: 0 },
  { speakerId: 'bob', displayName: 'Bob', speakLang: 'en', text: "The client captures mic audio and sends PCM frames over WebSocket to the server.", delayMs: 2000 },
  { speakerId: 'carlos', displayName: 'Carlos', speakLang: 'es', text: "El servidor procesa el audio con Voxtral para obtener la transcripción en tiempo real.", delayMs: 4000 },
  { speakerId: 'alice', displayName: 'Alice', speakLang: 'en', text: "Right. Then the server translates each committed utterance into every listener's target language.", delayMs: 6000 },
  { speakerId: 'bob', displayName: 'Bob', speakLang: 'en', text: "We should deploy the STT pipeline on Apple Silicon first, then add NVIDIA vLLM support.", delayMs: 8000 },
  { speakerId: 'carlos', displayName: 'Carlos', speakLang: 'es', text: "También necesitamos un tablero de acciones – cosas que hacer ahora, después, y más tarde.", delayMs: 10000 },
  { speakerId: 'alice', displayName: 'Alice', speakLang: 'en', text: "Let's create a concept graph showing how Client connects to Server, Server uses STT, and STT feeds Translation.", delayMs: 12000 },
  { speakerId: 'bob', displayName: 'Bob', speakLang: 'en', text: "Next we need to integrate the Mermaid diagram generator for architecture visualization.", delayMs: 14000 },
  { speakerId: 'alice', displayName: 'Alice', speakLang: 'en', text: "Todo: first set up the WebSocket pipeline, then add the translation layer, after that build the visualization.", delayMs: 16000 },
  { speakerId: 'carlos', displayName: 'Carlos', speakLang: 'es', text: "Si el usuario prefiere, podemos usar el modo de micrófono compartido con etiquetado manual de hablantes.", delayMs: 18000 },
];
