import type { WorldEntity, WorldRelation, WorldTask, DiagramType, WorldDiagram } from '@party-babel/shared';

/**
 * Generate stable Mermaid diagram text from world state components.
 * Updates incrementally — produces consistent output for same input.
 */

export function generateMermaid(
  type: DiagramType,
  entities: Map<string, WorldEntity>,
  relations: WorldRelation[],
  tasks: WorldTask[],
): WorldDiagram {
  switch (type) {
    case 'architecture':
      return { type, mermaidSource: generateArchitecture(entities, relations) };
    case 'journey':
      return { type, mermaidSource: generateJourney(entities, relations) };
    case 'timeline':
      return { type, mermaidSource: generateTimeline(entities, tasks) };
    case 'decision_tree':
      return { type, mermaidSource: generateDecisionTree(entities, relations) };
  }
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30);
}

function escapeLabel(s: string): string {
  return s.replace(/"/g, '#quot;').replace(/[\[\]{}()]/g, '').replace(/[;:#]/g, '').slice(0, 50);
}

function generateArchitecture(entities: Map<string, WorldEntity>, relations: WorldRelation[]): string {
  const lines = ['flowchart LR'];
  const addedNodes = new Set<string>();

  // Add nodes from relations
  for (const rel of relations) {
    if (!addedNodes.has(rel.from)) {
      const entity = entities.get(rel.from);
      const label = entity?.label || rel.from;
      lines.push(`  ${sanitize(rel.from)}["${escapeLabel(label)}"]`);
      addedNodes.add(rel.from);
    }
    if (!addedNodes.has(rel.to)) {
      const entity = entities.get(rel.to);
      const label = entity?.label || rel.to;
      lines.push(`  ${sanitize(rel.to)}["${escapeLabel(label)}"]`);
      addedNodes.add(rel.to);
    }
    lines.push(`  ${sanitize(rel.from)} -->|${escapeLabel(rel.type)}| ${sanitize(rel.to)}`);
  }

  // Add standalone entities
  for (const [id, entity] of entities) {
    if (!addedNodes.has(id)) {
      lines.push(`  ${sanitize(id)}["${escapeLabel(entity.label)}"]`);
      addedNodes.add(id);
    }
  }

  if (lines.length === 1) {
    lines.push('  A["No architecture data yet"]');
  }

  return lines.join('\n');
}

function generateJourney(entities: Map<string, WorldEntity>, relations: WorldRelation[]): string {
  const lines = ['flowchart TD'];
  const addedNodes = new Set<string>();

  for (const rel of relations) {
    if (!addedNodes.has(rel.from)) {
      const entity = entities.get(rel.from);
      lines.push(`  ${sanitize(rel.from)}["${escapeLabel(entity?.label || rel.from)}"]`);
      addedNodes.add(rel.from);
    }
    if (!addedNodes.has(rel.to)) {
      const entity = entities.get(rel.to);
      lines.push(`  ${sanitize(rel.to)}["${escapeLabel(entity?.label || rel.to)}"]`);
      addedNodes.add(rel.to);
    }
    lines.push(`  ${sanitize(rel.from)} --> ${sanitize(rel.to)}`);
  }

  if (lines.length === 1) {
    lines.push('  start["Start"] --> action["Action"] --> result["Result"]');
  }

  return lines.join('\n');
}

function generateTimeline(entities: Map<string, WorldEntity>, tasks: WorldTask[]): string {
  const lines = ['gantt', '  title Timeline', '  dateFormat X'];
  const now = tasks.filter(t => t.bucket === 'Now');
  const next = tasks.filter(t => t.bucket === 'Next');
  const later = tasks.filter(t => t.bucket === 'Later');

  if (now.length) {
    lines.push('  section Now');
    now.forEach((t, i) => lines.push(`    ${escapeLabel(t.title).slice(0, 40)} :t${i}, 0, 1`));
  }
  if (next.length) {
    lines.push('  section Next');
    next.forEach((t, i) => lines.push(`    ${escapeLabel(t.title).slice(0, 40)} :t${100 + i}, 1, 2`));
  }
  if (later.length) {
    lines.push('  section Later');
    later.forEach((t, i) => lines.push(`    ${escapeLabel(t.title).slice(0, 40)} :t${200 + i}, 2, 3`));
  }

  if (lines.length === 3) {
    lines.push('  section Waiting', '    No tasks yet :t0, 0, 1');
  }

  return lines.join('\n');
}

function generateDecisionTree(entities: Map<string, WorldEntity>, relations: WorldRelation[]): string {
  const lines = ['flowchart TD'];
  const addedNodes = new Set<string>();

  for (const rel of relations) {
    if (!addedNodes.has(rel.from)) {
      const entity = entities.get(rel.from);
      lines.push(`  ${sanitize(rel.from)}{"${escapeLabel(entity?.label || rel.from)}"}`);
      addedNodes.add(rel.from);
    }
    if (!addedNodes.has(rel.to)) {
      const entity = entities.get(rel.to);
      lines.push(`  ${sanitize(rel.to)}["${escapeLabel(entity?.label || rel.to)}"]`);
      addedNodes.add(rel.to);
    }
    lines.push(`  ${sanitize(rel.from)} -->|${escapeLabel(rel.type)}| ${sanitize(rel.to)}`);
  }

  if (lines.length === 1) {
    lines.push('  decision{"Decision?"} -->|Yes| optA["Option A"]');
    lines.push('  decision -->|No| optB["Option B"]');
  }

  return lines.join('\n');
}
