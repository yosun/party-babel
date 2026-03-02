import type { WorldEntity, WorldRelation, WorldTask, WorldDiagram } from '@voxtral-flow/shared';
import { ConceptGraph } from './ConceptGraph';
import { MermaidDiagram } from './MermaidDiagram';
import { KanbanBoard } from './KanbanBoard';

interface Props {
  entities: Map<string, WorldEntity>;
  relations: WorldRelation[];
  tasks: WorldTask[];
  diagram: WorldDiagram | null;
  langCount?: number;
}

export function VisualizePanel({ entities, relations, tasks, diagram, langCount }: Props) {
  // Count only entities that appear in at least one relation
  const connectedCount = new Set([...relations.map(r => r.from), ...relations.map(r => r.to)]).size;

  return (
    <div className="flex flex-col h-full">
      {/* Live stats bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800/60 bg-gray-950/50">
        <div className="stat-pill px-2.5 py-1 rounded-full text-xs font-mono">
          <span className="text-brand-400 font-bold">{connectedCount}</span>
          <span className="text-gray-500 ml-1">nodes</span>
        </div>
        <div className="stat-pill px-2.5 py-1 rounded-full text-xs font-mono">
          <span className="text-cyan-400 font-bold">{relations.length}</span>
          <span className="text-gray-500 ml-1">edges</span>
        </div>
        <div className="stat-pill px-2.5 py-1 rounded-full text-xs font-mono">
          <span className="text-amber-400 font-bold">{tasks.length}</span>
          <span className="text-gray-500 ml-1">tasks</span>
        </div>
        {diagram && (
          <span className="ml-auto text-[10px] text-gray-600 uppercase tracking-widest">{diagram.type}</span>
        )}
      </div>

      {/* Top: graph (large) + diagram */}
      <div className="flex-1 flex border-b border-gray-800 min-h-0">
        {/* Concept Graph — takes 60% for visual impact */}
        <div className="w-3/5 border-r border-gray-800 flex flex-col">
          <div className="px-3 py-1.5 border-b border-gray-800 text-[10px] font-semibold text-gray-500 uppercase tracking-[0.2em]">
            Concept Graph
          </div>
          <div className="flex-1 min-h-0">
            <ConceptGraph entities={entities} relations={relations} />
          </div>
        </div>

        {/* Mermaid Diagram — 40% */}
        <div className="w-2/5 flex flex-col">
          <div className="px-3 py-1.5 border-b border-gray-800 text-[10px] font-semibold text-gray-500 uppercase tracking-[0.2em]">
            Diagram {diagram ? `(${diagram.type})` : ''}
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-3">
            <MermaidDiagram diagram={diagram} />
          </div>
        </div>
      </div>

      {/* Bottom: Kanban */}
      <div className="h-1/3 min-h-[200px] flex flex-col">
        <div className="px-3 py-2 border-b border-gray-800 text-xs font-medium text-gray-400 uppercase tracking-wider">
          Action Board
        </div>
        <div className="flex-1 overflow-auto">
          <KanbanBoard tasks={tasks} />
        </div>
      </div>
    </div>
  );
}
