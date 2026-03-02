import type { WorldEntity, WorldRelation, WorldTask, DiagramType, WorldDiagram } from '@voxtral-flow/shared';

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
    case 'hierarchy':
      return { type, mermaidSource: generateHierarchy(entities, relations) };
  }
}

// Mermaid reserved keywords that cannot be used as bare node IDs
const MERMAID_RESERVED = new Set([
  'end', 'graph', 'subgraph', 'direction', 'click', 'style', 'classDef',
  'class', 'linkStyle', 'default', 'flowchart', 'sequenceDiagram', 'gantt',
]);

function sanitize(s: string): string {
  const id = s.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30);
  // Prefix to avoid collisions with Mermaid reserved words
  return MERMAID_RESERVED.has(id.toLowerCase()) ? `n_${id}` : id;
}

function escapeLabel(s: string): string {
  return s.replace(/"/g, '#quot;').replace(/[\[\]{}()]/g, '').replace(/[;:#]/g, '').slice(0, 50);
}

// Heuristic subgraph clustering
const SUBGROUP_HINTS: Array<{ name: string; keywords: string[] }> = [
  { name: 'Frontend', keywords: ['client', 'browser', 'app', 'frontend', 'react', 'microphone', 'audio', 'ui', 'mobile', 'desktop', 'd3'] },
  { name: 'Gateway', keywords: ['websocket', 'socket', 'messagebroker', 'notification', 'eventbus', 'gateway', 'proxy', 'loadbalancer', 'nginx'] },
  { name: 'Services', keywords: ['server', 'backend', 'api', 'service', 'worker', 'scheduler', 'fastify', 'express', 'translation', 'stt', 'voxtral', 'transcri'] },
  { name: 'Intelligence', keywords: ['mistral', 'concept', 'knowledge', 'mermaid', 'extract', 'llm', 'model', 'ai', 'analytic', 'generator'] },
  { name: 'Data Layer', keywords: ['redis', 'postgres', 'database', 'db', 'cache', 'storage', 'elastic', 'prisma', 'mongo', 'queue', 'kafka'] },
  { name: 'Infrastructure', keywords: ['docker', 'kubernetes', 'k8s', 'prometheus', 'grafana', 'monitor', 'dashboard', 'terraform', 'deploy', 'cdn'] },
];

function classifyEntity(id: string): string {
  const lower = id.toLowerCase();
  for (const sg of SUBGROUP_HINTS) {
    if (sg.keywords.some(k => lower.includes(k))) return sg.name;
  }
  return 'Other';
}

function generateArchitecture(entities: Map<string, WorldEntity>, relations: WorldRelation[]): string {
  const lines = ['flowchart LR'];
  const addedNodes = new Set<string>();

  // Collect only connected entities
  const connectedIds = new Set<string>();
  for (const rel of relations) { connectedIds.add(rel.from); connectedIds.add(rel.to); }

  // Group connected entities into subgraphs
  const groups = new Map<string, string[]>();
  for (const id of connectedIds) {
    const group = classifyEntity(id);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(id);
  }

  // Emit subgraphs
  for (const [groupName, ids] of groups) {
    if (ids.length < 2 && groups.size > 1) continue; // skip tiny groups
    lines.push(`  subgraph sg_${sanitize(groupName)}["${escapeLabel(groupName)}"]`);
    for (const id of ids) {
      const entity = entities.get(id);
      const label = entity?.label || id;
      lines.push(`    ${sanitize(id)}["${escapeLabel(label)}"]`);
      addedNodes.add(id);
    }
    lines.push('  end');
  }

  // Add any remaining connected nodes not in a subgraph
  for (const id of connectedIds) {
    if (!addedNodes.has(id)) {
      const entity = entities.get(id);
      const label = entity?.label || id;
      lines.push(`  ${sanitize(id)}["${escapeLabel(label)}"]`);
      addedNodes.add(id);
    }
  }

  // Add relation edges
  for (const rel of relations) {
    lines.push(`  ${sanitize(rel.from)} -->|${escapeLabel(rel.type)}| ${sanitize(rel.to)}`);
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

// ── Hierarchy relations that imply parent→child direction ──
const HIERARCHY_PARENT_TYPES = new Set([
  'parent_of', 'contains', 'leads', 'created', 'married',
]);
const HIERARCHY_CHILD_TYPES = new Set([
  'belongs_to', 'reports_to',
]);

function generateHierarchy(entities: Map<string, WorldEntity>, relations: WorldRelation[]): string {
  const lines = ['flowchart TD'];
  const addedNodes = new Set<string>();

  // Determine roots: nodes that appear as 'from' in parent-type rels but not as 'to'
  const childSet = new Set<string>();
  const parentSet = new Set<string>();
  for (const rel of relations) {
    if (HIERARCHY_PARENT_TYPES.has(rel.type)) {
      parentSet.add(rel.from);
      childSet.add(rel.to);
    } else if (HIERARCHY_CHILD_TYPES.has(rel.type)) {
      parentSet.add(rel.to);
      childSet.add(rel.from);
    } else {
      parentSet.add(rel.from);
      childSet.add(rel.to);
    }
  }

  const addNode = (id: string, shape: 'round' | 'rect' = 'rect') => {
    if (addedNodes.has(id)) return;
    addedNodes.add(id);
    const entity = entities.get(id);
    const label = escapeLabel(entity?.label || id);
    if (shape === 'round') {
      lines.push(`  ${sanitize(id)}(["${label}"])`)
    } else {
      lines.push(`  ${sanitize(id)}["${label}"]`);
    }
  };

  for (const rel of relations) {
    let from = rel.from;
    let to = rel.to;
    // Flip child→parent relations so tree flows top-down
    if (HIERARCHY_CHILD_TYPES.has(rel.type)) {
      from = rel.to;
      to = rel.from;
    }
    // Roots get rounded shape
    const fromIsRoot = parentSet.has(from) && !childSet.has(from);
    addNode(from, fromIsRoot ? 'round' : 'rect');
    addNode(to);
    lines.push(`  ${sanitize(from)} -->|${escapeLabel(rel.type)}| ${sanitize(to)}`);
  }

  // Show orphan entities that aren't in any relation
  if (lines.length === 1) {
    for (const [id] of entities) {
      addNode(id);
    }
  }

  if (lines.length === 1) {
    lines.push('  root["Hierarchy"]');
  }

  return lines.join('\n');
}
