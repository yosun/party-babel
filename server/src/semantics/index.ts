import type { WorldState, WorldPatch, WorldEntity } from '@party-babel/shared';
import {
  extractEntities,
  extractRelations,
  extractTasks,
  detectDiagramType,
} from './heuristic-extractor.js';
import { generateMermaid } from './mermaid-generator.js';
import { broadcastToRoom } from '../ws/rooms.js';

// Per-room world state
const roomStates = new Map<string, WorldState>();

export function clearWorldState(roomId: string): void {
  roomStates.delete(roomId);
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

  // Extract new data from the utterance
  const newEntities = extractEntities(text, utteranceId);
  const newRelations = extractRelations(text, utteranceId);
  const newTasks = extractTasks(text, utteranceId);

  // Merge entities (avoid duplicates)
  const addedEntities: WorldEntity[] = [];
  for (const entity of newEntities) {
    if (!state.entities.has(entity.id)) {
      state.entities.set(entity.id, entity);
      addedEntities.push(entity);
    }
  }

  // Add relations (avoid exact duplicates)
  const addedRelations = newRelations.filter(
    nr => !state.relations.some(
      er => er.from === nr.from && er.to === nr.to && er.type === nr.type
    )
  );
  state.relations.push(...addedRelations);

  // Add tasks
  state.tasks.push(...newTasks);

  // Only broadcast if something changed
  if (addedEntities.length === 0 && addedRelations.length === 0 && newTasks.length === 0) {
    return;
  }

  // Detect diagram type from accumulated text
  const allText = Array.from(state.entities.values()).map(e => e.label).join(' ') +
    ' ' + state.relations.map(r => r.type).join(' ');
  const diagramType = detectDiagramType(allText + ' ' + text);

  // Generate updated diagram
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
