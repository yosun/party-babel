import type { WorldState, WorldPatch, WorldEntity } from '@voxtral-flow/shared';
import {
  extractEntities,
  extractRelations,
  extractTasks,
  detectDiagramType,
} from './heuristic-extractor.js';
import { canUseLLM, llmExtractAll } from './llm-extractor.js';
import { generateMermaid } from './mermaid-generator.js';
import { broadcastToRoom } from '../ws/rooms.js';

// Per-room accumulated conversation text for LLM context
const roomConversationText = new Map<string, string>();

// Per-room world state
const roomStates = new Map<string, WorldState>();

export function clearWorldState(roomId: string): void {
  roomStates.delete(roomId);
  roomConversationText.delete(roomId);
}

function getWorldState(roomId: string): WorldState {
  let state = roomStates.get(roomId);
  if (!state) {
    state = {
      entities: new Map(),
      relations: [],
      tasks: [],
      diagram: { type: 'architecture', mermaidSource: '' },
      version: 0,
    };
    roomStates.set(roomId, state);
  }
  return state;
}

export async function extractAndPatch(roomId: string, utteranceId: string, text: string): Promise<void> {
  const state = getWorldState(roomId);

  // Accumulate conversation text
  const prevText = roomConversationText.get(roomId) || '';
  const conversationText = (prevText + ' ' + text).slice(-2000);
  roomConversationText.set(roomId, conversationText);

  let addedEntities: WorldEntity[];
  let addedRelations: typeof state.relations;
  let newTasks: typeof state.tasks;

  if (canUseLLM()) {
    // ── LLM path: single call extracts everything ──
    try {
      const result = await llmExtractAll(
        text, conversationText, state.entities, state.relations, utteranceId,
      );

      // Merge entities (avoid duplicates)
      addedEntities = [];
      for (const entity of result.entities) {
        if (!state.entities.has(entity.id)) {
          state.entities.set(entity.id, entity);
          addedEntities.push(entity);
        }
      }

      // Add relations (avoid exact duplicates)
      addedRelations = result.relations.filter(
        nr => !state.relations.some(
          er => er.from === nr.from && er.to === nr.to && er.type === nr.type
        )
      );
      state.relations.push(...addedRelations);

      // Add tasks
      newTasks = result.tasks;
      state.tasks.push(...newTasks);

      // Always use template generator for reliable, structured mermaid output
      state.diagram = generateMermaid(
        result.diagramType, state.entities, state.relations, state.tasks,
      );
    } catch {
      // LLM failed — fall through to heuristic path
      return extractAndPatchHeuristic(roomId, utteranceId, text, state);
    }
  } else {
    // ── Heuristic fallback path ──
    return extractAndPatchHeuristic(roomId, utteranceId, text, state);
  }

  // Only broadcast if something changed
  if (addedEntities.length === 0 && addedRelations.length === 0 && newTasks.length === 0) {
    return;
  }

  state.version++;

  const patch: WorldPatch = {
    newEntities: addedEntities.length > 0 ? addedEntities : undefined,
    newRelations: addedRelations.length > 0 ? addedRelations : undefined,
    newTasks: newTasks.length > 0 ? newTasks : undefined,
    diagram: state.diagram,
    version: state.version,
  };

  broadcastToRoom(roomId, {
    type: 'world_patch',
    roomId,
    patch,
    worldVersion: state.version,
    tMs: Date.now(),
  });
}

/** Heuristic-only extraction (offline fallback) */
function extractAndPatchHeuristic(
  roomId: string,
  utteranceId: string,
  text: string,
  state: WorldState,
): void {
  const newEntities = extractEntities(text, utteranceId);
  const newRelations = extractRelations(text, utteranceId);
  const newTasks = extractTasks(text, utteranceId);

  console.log(`[semantics] heuristic input: "${text.slice(0, 80)}..."`);
  console.log(`[semantics] extracted: ${newEntities.length} entities, ${newRelations.length} relations, ${newTasks.length} tasks`);
  if (newEntities.length) console.log(`[semantics]   entities: ${newEntities.map(e => e.id).join(', ')}`);
  if (newRelations.length) console.log(`[semantics]   relations: ${newRelations.map(r => `${r.from} --${r.type}--> ${r.to}`).join(', ')}`);

  const addedEntities: WorldEntity[] = [];
  for (const entity of newEntities) {
    if (!state.entities.has(entity.id)) {
      state.entities.set(entity.id, entity);
      addedEntities.push(entity);
    }
  }

  const addedRelations = newRelations.filter(
    nr => !state.relations.some(
      er => er.from === nr.from && er.to === nr.to && er.type === nr.type
    )
  );
  state.relations.push(...addedRelations);
  state.tasks.push(...newTasks);

  if (addedEntities.length === 0 && addedRelations.length === 0 && newTasks.length === 0) {
    return;
  }

  const allText = Array.from(state.entities.values()).map(e => e.label).join(' ') +
    ' ' + state.relations.map(r => r.type).join(' ');
  const diagramType = detectDiagramType(allText + ' ' + text);
  state.diagram = generateMermaid(diagramType, state.entities, state.relations, state.tasks);
  state.version++;

  const patch: WorldPatch = {
    newEntities: addedEntities.length > 0 ? addedEntities : undefined,
    newRelations: addedRelations.length > 0 ? addedRelations : undefined,
    newTasks: newTasks.length > 0 ? newTasks : undefined,
    diagram: state.diagram,
    version: state.version,
  };

  broadcastToRoom(roomId, {
    type: 'world_patch',
    roomId,
    patch,
    worldVersion: state.version,
    tMs: Date.now(),
  });
}

export function getWorldStateForRoom(roomId: string): WorldState {
  return getWorldState(roomId);
}
