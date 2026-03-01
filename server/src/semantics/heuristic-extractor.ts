import type { WorldEntity, WorldRelation, WorldTask, DiagramType, TaskBucket } from '@party-babel/shared';
import { nanoid } from 'nanoid';

/**
 * DeterministicHeuristicExtractor: extracts entities, relations, tasks
 * from committed utterance text without requiring any LLM.
 */

// ── Entity extraction ───────────────────────────────────
const TECH_KEYWORDS = new Set([
  'api', 'server', 'client', 'database', 'redis', 'postgres', 'websocket',
  'docker', 'kubernetes', 'react', 'node', 'python', 'fastify', 'prisma',
  'vllm', 'voxtral', 'stt', 'tts', 'llm', 'gpu', 'cpu', 'pipeline',
  'microservice', 'gateway', 'frontend', 'backend', 'model', 'endpoint',
  'translation', 'transcription', 'audio', 'mermaid', 'graph', 'kanban',
  'webhook', 'middleware', 'router', 'controller', 'service', 'repository',
  'schema', 'migration', 'deployment', 'ci', 'cd', 'npm', 'pnpm', 'yarn',
]);

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'and', 'but', 'or', 'if', 'this', 'that', 'these', 'those', 'i', 'we',
  'you', 'he', 'she', 'it', 'they', 'me', 'us', 'him', 'her', 'them',
  'my', 'our', 'your', 'his', 'its', 'their', 'what', 'which', 'who',
  'whom', 'also', 'right', 'let', 'lets', "let's", 'get', 'got',
]);

export function extractEntities(text: string, utteranceId: string): WorldEntity[] {
  const entities: WorldEntity[] = [];
  const seen = new Set<string>();
  const words = text.split(/\s+/);

  for (const word of words) {
    const clean = word.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!clean || clean.length < 2) continue;
    const lower = clean.toLowerCase();

    // Capitalized words (potential proper nouns/entities)
    const isCapitalized = clean[0] === clean[0].toUpperCase() && clean[0] !== clean[0].toLowerCase();
    const isTechKeyword = TECH_KEYWORDS.has(lower);

    if ((isCapitalized || isTechKeyword) && !STOP_WORDS.has(lower) && !seen.has(lower)) {
      seen.add(lower);
      entities.push({
        id: lower,
        label: isTechKeyword ? clean.toUpperCase() : clean,
        firstSeenUtteranceId: utteranceId,
      });
    }
  }

  return entities;
}

// ── Relation extraction ─────────────────────────────────
const RELATION_PATTERNS: Array<{ re: RegExp; type: string }> = [
  { re: /(\w+)\s+(?:uses?|using)\s+(\w+)/gi, type: 'uses' },
  { re: /(\w+)\s+(?:depends?\s+on|depending\s+on)\s+(\w+)/gi, type: 'depends_on' },
  { re: /(\w+)\s*(?:->|→|connects?\s+to|sends?\s+to)\s*(\w+)/gi, type: 'connects_to' },
  { re: /(?:integrate|integrating)\s+(\w+)\s+(?:with|into|and)\s+(\w+)/gi, type: 'integrates' },
  { re: /(\w+)\s+(?:pipeline|feeds?|feeds?\s+into)\s+(\w+)/gi, type: 'feeds' },
  { re: /(\w+)\s+(?:calls?|invokes?)\s+(\w+)/gi, type: 'calls' },
];

export function extractRelations(text: string, utteranceId: string): WorldRelation[] {
  const relations: WorldRelation[] = [];
  const seen = new Set<string>();

  for (const pattern of RELATION_PATTERNS) {
    const re = new RegExp(pattern.re.source, pattern.re.flags);
    let match;
    while ((match = re.exec(text)) !== null) {
      const from = match[1].toLowerCase();
      const to = match[2].toLowerCase();
      const key = `${from}:${to}:${pattern.type}`;
      if (!seen.has(key) && from !== to && !STOP_WORDS.has(from) && !STOP_WORDS.has(to)) {
        seen.add(key);
        relations.push({ from, to, type: pattern.type, sourceUtteranceId: utteranceId });
      }
    }
  }

  return relations;
}

// ── Task extraction ─────────────────────────────────────
const TASK_PATTERNS: Array<{ re: RegExp; bucket: TaskBucket }> = [
  { re: /(?:todo|need to|must|have to|should)\s*:?\s*(.+?)(?:\.|$)/gi, bucket: 'Now' },
  { re: /(?:let's|let us|we should)\s+(.+?)(?:\.|$)/gi, bucket: 'Now' },
  { re: /(?:first|immediately|right now|asap)\s+(.+?)(?:\.|$)/gi, bucket: 'Now' },
  { re: /(?:next|then|after that|afterwards)\s+(.+?)(?:\.|$)/gi, bucket: 'Next' },
  { re: /(?:later|eventually|someday|future|down the road)\s+(.+?)(?:\.|$)/gi, bucket: 'Later' },
];

export function extractTasks(text: string, utteranceId: string): WorldTask[] {
  const tasks: WorldTask[] = [];
  const seen = new Set<string>();

  for (const pattern of TASK_PATTERNS) {
    const re = new RegExp(pattern.re.source, pattern.re.flags);
    let match;
    while ((match = re.exec(text)) !== null) {
      const title = match[1].trim().slice(0, 120);
      if (title.length < 3 || seen.has(title.toLowerCase())) continue;
      seen.add(title.toLowerCase());
      tasks.push({
        id: nanoid(8),
        title,
        bucket: pattern.bucket,
        sourceUtteranceId: utteranceId,
      });
    }
  }

  return tasks;
}

// ── Diagram type detection ──────────────────────────────
const DIAGRAM_HINTS: Array<{ keywords: string[]; type: DiagramType }> = [
  { keywords: ['server', 'client', 'ws', 'pipeline', 'model', 'endpoint', 'api', 'gateway', 'service'], type: 'architecture' },
  { keywords: ['user', 'screen', 'flow', 'onboarding', 'step', 'page', 'navigate'], type: 'journey' },
  { keywords: ['today', 'tomorrow', 'first', 'then', 'after', 'before', 'schedule', 'timeline'], type: 'timeline' },
  { keywords: ['if', 'else', 'either', 'should we', 'option', 'decide', 'choice'], type: 'decision_tree' },
];

export function detectDiagramType(text: string): DiagramType {
  const lower = text.toLowerCase();
  const scores: Record<DiagramType, number> = { architecture: 0, journey: 0, timeline: 0, decision_tree: 0 };

  for (const hint of DIAGRAM_HINTS) {
    for (const kw of hint.keywords) {
      if (lower.includes(kw)) scores[hint.type]++;
    }
  }

  let best: DiagramType = 'architecture';
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = type as DiagramType;
    }
  }
  return best;
}
