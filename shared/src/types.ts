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
  // Scene-setting → few entities
  { speakerId: 'alice', displayName: 'Alice', speakLang: 'en',
    text: "Let's design our multiplayer game backend — GameClient, GameServer, and the full infrastructure.",
    delayMs: 0 },

  // R1  GameClient connects_to LoadBalancer
  { speakerId: 'bob', displayName: 'Bob', speakLang: 'en',
    text: "GameClient connects to LoadBalancer which routes traffic to the right GameServer instance.",
    delayMs: 2500 },

  // R2  GameServer uses Redis
  { speakerId: 'carlos', displayName: 'Carlos', speakLang: 'es',
    text: "GameServer uses Redis para estado de sesión y sincronización entre instancias.",
    delayMs: 5000 },

  // R3  PlayerService depends_on Postgres
  { speakerId: 'alice', displayName: 'Alice', speakLang: 'en',
    text: "PlayerService depends on Postgres for profiles, inventories, and matchmaking records.",
    delayMs: 7500 },

  // R4  MatchMaker calls PlayerService
  { speakerId: 'bob', displayName: 'Bob', speakLang: 'en',
    text: "MatchMaker calls PlayerService to fetch rankings and skill ratings before pairing.",
    delayMs: 10000 },

  // R5  GameServer sends_to EventBus
  { speakerId: 'alice', displayName: 'Alice', speakLang: 'en',
    text: "GameServer sends to EventBus for async event processing and audit logging.",
    delayMs: 12500 },

  // R6  integrate Analytics with EventBus  +  task (we should)
  { speakerId: 'bob', displayName: 'Bob', speakLang: 'en',
    text: "We should integrate Analytics with EventBus to track player behavior and retention.",
    delayMs: 15000 },

  // R7  Leaderboard calls Redis
  { speakerId: 'carlos', displayName: 'Carlos', speakLang: 'es',
    text: "Leaderboard calls Redis para rankings en tiempo real con latencia mínima.",
    delayMs: 17500 },

  // Tasks: Now + Next
  { speakerId: 'alice', displayName: 'Alice', speakLang: 'en',
    text: "First deploy the GameServer cluster. Then configure LoadBalancer health checks.",
    delayMs: 20000 },

  // R8  CDN connects_to AssetStore
  { speakerId: 'bob', displayName: 'Bob', speakLang: 'en',
    text: "CDN connects to AssetStore for distributing game textures, models, and audio.",
    delayMs: 22500 },

  // R9  Monitor feeds Dashboard
  { speakerId: 'carlos', displayName: 'Carlos', speakLang: 'es',
    text: "Monitor feeds Dashboard para métricas de rendimiento y alertas del sistema.",
    delayMs: 25000 },

  // R10  AntiCheat depends_on Analytics
  { speakerId: 'alice', displayName: 'Alice', speakLang: 'en',
    text: "AntiCheat depends on Analytics to detect suspicious patterns and flag accounts.",
    delayMs: 27500 },

  // R11  ChatService uses WebSocket
  { speakerId: 'bob', displayName: 'Bob', speakLang: 'en',
    text: "ChatService uses WebSocket for real-time messaging between players in lobbies.",
    delayMs: 30000 },

  // R12  integrate Streaming with CDN  +  Later task
  { speakerId: 'alice', displayName: 'Alice', speakLang: 'en',
    text: "Later we can integrate Streaming with CDN for live tournament broadcasting.",
    delayMs: 32500 },
];
