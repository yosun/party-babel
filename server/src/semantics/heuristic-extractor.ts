import type { WorldEntity, WorldRelation, WorldTask, DiagramType, TaskBucket } from '@voxtral-flow/shared';
import { nanoid } from 'nanoid';

/**
 * DeterministicHeuristicExtractor: extracts entities, relations, tasks
 * from committed utterance text without requiring any LLM.
 * Designed to handle real STT output (lowercase, no punctuation, mangled names).
 */

// ── Entity extraction ───────────────────────────────────

// Single-word tech keywords recognized anywhere in text
const TECH_KEYWORDS = new Set([
  'api', 'server', 'client', 'database', 'redis', 'postgres', 'websocket',
  'docker', 'kubernetes', 'react', 'node', 'python', 'fastify', 'prisma',
  'vllm', 'voxtral', 'stt', 'tts', 'llm', 'gpu', 'cpu', 'pipeline',
  'microservice', 'gateway', 'frontend', 'backend', 'model', 'endpoint',
  'translation', 'transcription', 'audio', 'mermaid', 'graph', 'kanban',
  'webhook', 'middleware', 'router', 'controller', 'service', 'repository',
  'schema', 'migration', 'deployment', 'ci', 'cd', 'npm', 'pnpm', 'yarn',
  'mistral', 'prometheus', 'grafana', 'terraform', 'observability',
  'browser', 'microphone', 'diagram', 'engine', 'extractor', 'cache',
  'monitor', 'proxy', 'queue', 'worker', 'scheduler', 'orm', 'd3',
  'kafka', 'elasticsearch', 'nginx', 'typescript', 'javascript',
]);

// Multi-word compound entities: pattern → { id, label }
const COMPOUND_ENTITIES: Array<{ re: RegExp; id: string; label: string }> = [
  { re: /\btranslation\s*engine\b/gi, id: 'translation_engine', label: 'TranslationEngine' },
  { re: /\bconcept\s*extract(?:or|ion)\b/gi, id: 'concept_extractor', label: 'ConceptExtractor' },
  { re: /\bknowledge\s*graph\b/gi, id: 'knowledge_graph', label: 'KnowledgeGraph' },
  { re: /\bmermaid\s*generat(?:or|e|ion)\b/gi, id: 'mermaid_generator', label: 'MermaidGenerator' },
  { re: /\bforce\s*graph\b/gi, id: 'force_graph', label: 'ForceGraph' },
  { re: /\bspeech\s*to\s*text\b/gi, id: 'stt', label: 'STT' },
  { re: /\btext\s*to\s*speech\b/gi, id: 'tts', label: 'TTS' },
  { re: /\bweb\s*socket\b/gi, id: 'websocket', label: 'WebSocket' },
  { re: /\bapi\s*gateway\b/gi, id: 'api_gateway', label: 'APIGateway' },
  { re: /\bdata\s*(?:base|store)\b/gi, id: 'database', label: 'Database' },
  { re: /\bfront\s*end\b/gi, id: 'frontend', label: 'Frontend' },
  { re: /\bback\s*end\b/gi, id: 'backend', label: 'Backend' },
  { re: /\baudio\s*(?:stream|pipeline|processor)\b/gi, id: 'audio_pipeline', label: 'AudioPipeline' },
  { re: /\baction\s*(?:board|items?)\b/gi, id: 'action_board', label: 'ActionBoard' },
];

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
  // Conversational noise
  'welcome', 'everyone', 'today', 'hello', 'hey', 'hi', 'ok', 'okay',
  'yeah', 'yes', 'sure', 'great', 'good', 'well', 'really', 'already',
  'now', 'much', 'thing', 'things', 'new', 'going', 'first', 'second',
  'design', 'full', 'back', 'end', 'right', 'set', 'add', 'run',
  'start', 'make', 'build', 'take', 'use', 'look', 'work', 'still',
  'every', 'want', 'give', 'know', 'see', 'come', 'say', 'put',
]);

export function extractEntities(text: string, utteranceId: string): WorldEntity[] {
  const entities: WorldEntity[] = [];
  const seen = new Set<string>();

  // 1) Extract multi-word compound entities first
  for (const compound of COMPOUND_ENTITIES) {
    if (compound.re.test(text) && !seen.has(compound.id)) {
      seen.add(compound.id);
      // Also mark the collapsed form as seen to prevent CamelCase duplicates
      seen.add(compound.id.replace(/_/g, ''));
      entities.push({
        id: compound.id,
        label: compound.label,
        firstSeenUtteranceId: utteranceId,
      });
    }
    compound.re.lastIndex = 0; // reset regex
  }

  // Also detect CamelCase words that match compound entity patterns
  // e.g. "TranslationEngine" → "translation_engine"
  const camelWords = text.match(/[A-Z][a-z]+(?:[A-Z][a-z]+)+/g) || [];
  for (const cw of camelWords) {
    const underscored = cw.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    for (const compound of COMPOUND_ENTITIES) {
      if (compound.id === underscored && !seen.has(compound.id)) {
        seen.add(compound.id);
        seen.add(compound.id.replace(/_/g, ''));
        entities.push({
          id: compound.id,
          label: compound.label,
          firstSeenUtteranceId: utteranceId,
        });
      }
    }
  }

  // 2) Extract single-word entities (tech keywords + capitalized words)
  const words = text.split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!clean || clean.length < 2) continue;
    const lower = clean.toLowerCase();

    // Skip if this CamelCase word matches an already-extracted compound
    // e.g. "TranslationEngine" → check if "translation_engine" is already seen
    const camelSplit = clean.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    if (camelSplit !== lower && seen.has(camelSplit)) continue;
    // Also check if the collapsed form matches any compound ID
    let skipAsCompoundDupe = false;
    for (const compound of COMPOUND_ENTITIES) {
      if (compound.id.replace(/_/g, '') === lower && seen.has(compound.id)) {
        skipAsCompoundDupe = true;
        break;
      }
    }
    if (skipAsCompoundDupe) continue;

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

  // 3) Extract ASCII tech terms embedded in CJK / non-Latin text
  const asciiTokens = text.match(/[a-zA-Z][a-zA-Z0-9_-]{2,}/g) || [];
  for (const token of asciiTokens) {
    const lower = token.toLowerCase();
    if (seen.has(lower)) continue;
    const isCapitalized = token[0] === token[0].toUpperCase() && token[0] !== token[0].toLowerCase();
    const isTechKeyword = TECH_KEYWORDS.has(lower);
    if ((isCapitalized || isTechKeyword) && !STOP_WORDS.has(lower)) {
      seen.add(lower);
      entities.push({
        id: lower,
        label: isTechKeyword ? token.toUpperCase() : token,
        firstSeenUtteranceId: utteranceId,
      });
    }
  }

  return entities;
}

// ── Relation extraction ─────────────────────────────────
// Entity capture: 1-2 non-stop words.
const E = '([a-zA-Z][a-zA-Z0-9]*(?:\\s+[a-zA-Z][a-zA-Z0-9]*)?)';

// Preposition/filler boundary — many relation patterns need to stop before these
const BOUNDARY_WORDS = new Set([
  'for', 'from', 'with', 'into', 'and', 'or', 'the', 'a', 'an', 'our', 'their',
  'every', 'each', 'all', 'that', 'this', 'those', 'in', 'on', 'at', 'by', 'as',
  'to', 'of', 'through', 'via',
]);

// Verb → relation type mapping for the generic "Subject verb Object" scanner
const VERB_RELATION_MAP: Array<{ verbs: RegExp; type: string }> = [
  { verbs: /\b(?:uses?|using)\b/i, type: 'uses' },
  { verbs: /\b(?:depends?\s+on|depending\s+on)\b/i, type: 'depends_on' },
  { verbs: /\b(?:connects?\s+to|sends?\s+to)\b/i, type: 'connects_to' },
  { verbs: /\b(?:feeds?\s+into|feeds?\s+to|feeds?)\b/i, type: 'feeds' },
  { verbs: /\b(?:calls?|invokes?)\b/i, type: 'calls' },
  { verbs: /\b(?:captures?)\b/i, type: 'captures' },
  { verbs: /\b(?:opens?|creates?)\b/i, type: 'connects_to' },
  { verbs: /\b(?:powers?|drives?)\b/i, type: 'powers' },
  { verbs: /\b(?:renders?|displays?|shows?)\b/i, type: 'renders' },
  { verbs: /\b(?:converts?|transforms?)\b/i, type: 'converts' },
  { verbs: /\b(?:produces?|generates?)\b/i, type: 'produces' },
  { verbs: /\b(?:stores?|persists?|saves?)\b/i, type: 'stores' },
  { verbs: /\b(?:broadcasts?|publishes?|emits?)\b/i, type: 'broadcasts' },
  { verbs: /\b(?:analyzes?|processes?)\b/i, type: 'analyzes' },
  { verbs: /\b(?:monitors?|observes?|watches?)\b/i, type: 'monitors' },
  { verbs: /\b(?:integrates?\s+with|integrates?)\b/i, type: 'integrates' },
];

export function extractRelations(text: string, utteranceId: string): WorldRelation[] {
  const relations: WorldRelation[] = [];
  const seen = new Set<string>();

  // Handle arrow syntax: "A -> B", "A --> B", "A → B"
  const arrowRe = /([a-zA-Z][a-zA-Z0-9_]*)\s*(?:->|-->|→)\s*([a-zA-Z][a-zA-Z0-9_]*)/g;
  let arrowMatch;
  while ((arrowMatch = arrowRe.exec(text)) !== null) {
    const from = arrowMatch[1].toLowerCase();
    const to = arrowMatch[2].toLowerCase();
    const key = `${from}:${to}:connects_to`;
    if (!seen.has(key) && from !== to) {
      seen.add(key);
      relations.push({ from, to, type: 'connects_to', sourceUtteranceId: utteranceId });
    }
  }

  // Split text into clauses at conjunctions, periods, commas
  const clauses = text.split(/[.,;!?]|\band\b|\bbut\b|\bthen\b/i).filter(c => c.trim().length > 3);

  for (const clause of clauses) {
    const trimmed = clause.trim();
    // For each clause, try to find a verb and extract subject + object
    for (const { verbs, type } of VERB_RELATION_MAP) {
      const verbMatch = verbs.exec(trimmed);
      if (!verbMatch) continue;

      const verbStart = verbMatch.index;
      const verbEnd = verbStart + verbMatch[0].length;

      // Subject: last meaningful word(s) before the verb
      const beforeVerb = trimmed.slice(0, verbStart).trim();
      const subjectId = extractLastEntity(beforeVerb);

      // Object: first meaningful word(s) after the verb (skip articles/prepositions)
      const afterVerb = trimmed.slice(verbEnd).trim();
      const objectId = extractFirstEntity(afterVerb);

      if (!subjectId || !objectId || subjectId === objectId) continue;
      if (subjectId.length < 2 || objectId.length < 2) continue;

      const key = `${subjectId}:${objectId}:${type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      relations.push({ from: subjectId, to: objectId, type, sourceUtteranceId: utteranceId });
      break; // One relation per clause per verb match
    }
  }

  return relations;
}

/** Extract the last meaningful entity from text before a verb */
function extractLastEntity(text: string): string {
  // Check compound entities first
  for (const compound of COMPOUND_ENTITIES) {
    if (compound.re.test(text)) {
      compound.re.lastIndex = 0;
      return compound.id;
    }
    compound.re.lastIndex = 0;
  }

  const words = text.split(/\s+/).filter(w => w.length >= 2);
  // Walk backwards, skip stop/boundary words
  const meaningful: string[] = [];
  for (let i = words.length - 1; i >= 0 && meaningful.length < 2; i--) {
    const w = words[i].toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!w || STOP_WORDS.has(w) || BOUNDARY_WORDS.has(w)) {
      if (meaningful.length > 0) break;
      continue;
    }
    meaningful.unshift(w);
  }

  if (meaningful.length === 0) return '';
  const joined = meaningful.join('_');
  // Check if it maps to a known tech keyword
  if (meaningful.length === 1 && TECH_KEYWORDS.has(meaningful[0])) return meaningful[0];
  return joined;
}

/** Extract the first meaningful entity from text after a verb */
function extractFirstEntity(text: string): string {
  // Check compound entities first
  for (const compound of COMPOUND_ENTITIES) {
    if (compound.re.test(text)) {
      compound.re.lastIndex = 0;
      return compound.id;
    }
    compound.re.lastIndex = 0;
  }

  const words = text.split(/\s+/).filter(w => w.length >= 2);
  // Walk forward, skip stop/boundary words
  const meaningful: string[] = [];
  for (let i = 0; i < words.length && meaningful.length < 2; i++) {
    const w = words[i].toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!w || STOP_WORDS.has(w) || BOUNDARY_WORDS.has(w)) {
      if (meaningful.length > 0) break;
      continue;
    }
    meaningful.push(w);
  }

  if (meaningful.length === 0) return '';
  const joined = meaningful.join('_');
  if (meaningful.length === 1 && TECH_KEYWORDS.has(meaningful[0])) return meaningful[0];
  return joined;
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
  { keywords: ['child', 'children', 'kids', 'parent', 'family', 'son', 'daughter', 'married', 'tree', 'org', 'hierarchy', 'ancestor', 'descendant', 'inherited', 'reports to', 'manages', 'team', 'department', 'boss', 'subordinate', 'heir'], type: 'hierarchy' },
];

export function detectDiagramType(text: string): DiagramType {
  const lower = text.toLowerCase();
  const scores: Record<DiagramType, number> = { architecture: 0, journey: 0, timeline: 0, decision_tree: 0, hierarchy: 0 };

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
