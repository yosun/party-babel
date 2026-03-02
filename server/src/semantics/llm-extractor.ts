import type {
  DiagramType, WorldEntity, WorldRelation, WorldTask,
  TaskBucket,
} from '@voxtral-flow/shared';
import { config } from '../config.js';
import { isMistralApiValid } from '../stt/index.js';

const VALID_DIAGRAM_TYPES: DiagramType[] = ['architecture', 'journey', 'timeline', 'decision_tree', 'hierarchy'];
const VALID_BUCKETS: TaskBucket[] = ['Now', 'Next', 'Later'];

export interface LLMExtractionResult {
  entities: WorldEntity[];
  relations: WorldRelation[];
  tasks: WorldTask[];
  diagramType: DiagramType;
}

export function canUseLLM(): boolean {
  if (config.MISTRAL_API_KEY && isMistralApiValid()) return true;
  if (config.LOCAL_LLM_URL) return true;
  return false;
}

/**
 * Single LLM call that extracts entities, relations, tasks, picks the best
 * diagram type, and generates Mermaid source — all in one shot.
 * Throws on failure so the caller can fall back to heuristics.
 */
export async function llmExtractAll(
  utteranceText: string,
  conversationContext: string,
  existingEntities: Map<string, WorldEntity>,
  existingRelations: WorldRelation[],
  utteranceId: string,
): Promise<LLMExtractionResult> {
  const { url, headers, model } = getLLMEndpoint();
  const prompt = buildPrompt(utteranceText, conversationContext, existingEntities, existingRelations);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      throw new Error(`LLM extraction failed: ${resp.status}`);
    }

    const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
    const raw = data.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error('Empty LLM response');

    return parseResponse(raw, utteranceId);
  } finally {
    clearTimeout(timeout);
  }
}

function getLLMEndpoint(): { url: string; headers: Record<string, string>; model: string } {
  if (config.MISTRAL_API_KEY && isMistralApiValid()) {
    return {
      url: `${config.MISTRAL_API_URL}/v1/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.MISTRAL_API_KEY}`,
      },
      model: 'mistral-small-latest',
    };
  }
  return {
    url: `${config.LOCAL_LLM_URL}/v1/chat/completions`,
    headers: { 'Content-Type': 'application/json' },
    model: 'default',
  };
}

const SYSTEM_PROMPT = `You are an expert at analyzing conversation transcripts and extracting structured visual intelligence. You respond only with valid JSON. No markdown fences, no explanation.`;

function buildPrompt(
  utteranceText: string,
  conversationContext: string,
  existingEntities: Map<string, WorldEntity>,
  existingRelations: WorldRelation[],
): string {
  const existingEntityList = Array.from(existingEntities.values())
    .map(e => e.label).slice(0, 30).join(', ');
  const existingRelList = existingRelations
    .slice(-15).map(r => `${r.from} --${r.type}--> ${r.to}`).join('; ');

  return `Analyze this new utterance in the context of the ongoing conversation.

CONVERSATION SO FAR (last ~1500 chars):
${conversationContext.slice(-1500)}

NEW UTTERANCE TO PROCESS:
"${utteranceText}"

ALREADY EXTRACTED (for context, avoid duplicates):
Entities: ${existingEntityList || 'none yet'}
Relations: ${existingRelList || 'none yet'}

INSTRUCTIONS:
1. Extract NEW entities from the utterance — people, places, systems, components, concepts, organizations, anything worth putting on a diagram. Use lowercase IDs. Skip filler words.
2. Extract NEW relations — how things connect, who belongs to what, what uses what, what created what. Be creative with relation types — use whatever verb naturally describes the relationship (e.g. "uses", "parent_of", "married", "contains", "deployed_on", "chose"). Don't limit yourself to a fixed set.
3. Extract any action items / tasks with priority bucket (Now, Next, Later).
4. Choose the BEST diagram type for the ENTIRE conversation so far:
   - "architecture": systems, services, APIs, infrastructure, data flow
   - "journey": step-by-step processes, sequential narratives, workflows
   - "timeline": scheduling, phases, milestones, chronological events
   - "decision_tree": choices, comparisons, if/else, trade-offs
   - "hierarchy": trees, org charts, family trees, taxonomies, containment
Respond with EXACTLY this JSON (no other text):
{
  "entities": [{"id": "lowercase_id", "label": "Display Label"}],
  "relations": [{"from": "id1", "to": "id2", "type": "verb_describing_relation"}],
  "tasks": [{"title": "task description", "bucket": "Now|Next|Later"}],
  "diagramType": "architecture|journey|timeline|decision_tree|hierarchy"
}`;
}

function parseResponse(raw: string, utteranceId: string): LLMExtractionResult {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed: {
    entities?: Array<{ id?: string; label?: string }>;
    relations?: Array<{ from?: string; to?: string; type?: string }>;
    tasks?: Array<{ title?: string; bucket?: string }>;
    diagramType?: string;
  };

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in LLM response');
    parsed = JSON.parse(jsonMatch[0]);
  }

  // Validate entities
  const entities: WorldEntity[] = [];
  if (Array.isArray(parsed.entities)) {
    for (const e of parsed.entities) {
      if (e.id && typeof e.id === 'string' && e.label && typeof e.label === 'string') {
        const id = e.id.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
        if (id.length >= 2) {
          entities.push({ id, label: e.label.slice(0, 60), firstSeenUtteranceId: utteranceId });
        }
      }
    }
  }

  // Validate relations
  const relations: WorldRelation[] = [];
  if (Array.isArray(parsed.relations)) {
    for (const r of parsed.relations) {
      if (r.from && r.to && r.type &&
          typeof r.from === 'string' && typeof r.to === 'string' && typeof r.type === 'string') {
        const from = r.from.toLowerCase().replace(/[^a-z0-9_-]/g, '');
        const to = r.to.toLowerCase().replace(/[^a-z0-9_-]/g, '');
        const type = r.type.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30);
        if (from && to && from !== to && type) {
          relations.push({ from, to, type, sourceUtteranceId: utteranceId });
        }
      }
    }
  }

  // Validate tasks
  const tasks: WorldTask[] = [];
  if (Array.isArray(parsed.tasks)) {
    for (const t of parsed.tasks) {
      if (t.title && typeof t.title === 'string' && t.title.length >= 3) {
        const bucket: TaskBucket = VALID_BUCKETS.includes(t.bucket as TaskBucket)
          ? (t.bucket as TaskBucket)
          : 'Now';
        tasks.push({
          id: `llm_${Date.now()}_${tasks.length}`,
          title: t.title.slice(0, 120),
          bucket,
          sourceUtteranceId: utteranceId,
        });
      }
    }
  }

  // Validate diagram type
  const diagramType: DiagramType = VALID_DIAGRAM_TYPES.includes(parsed.diagramType as DiagramType)
    ? (parsed.diagramType as DiagramType)
    : 'architecture';

  return { entities, relations, tasks, diagramType };
}
