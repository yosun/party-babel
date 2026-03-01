import type { WorldEntity, WorldRelation, WorldTask, WorldDiagram } from '@party-babel/shared';
import type { Utterance } from '../hooks/useRoom';
import { ConceptGraph } from './ConceptGraph';
import { MermaidDiagram } from './MermaidDiagram';
import { KanbanBoard } from './KanbanBoard';

interface Props {
  entities: Map<string, WorldEntity>;
  relations: WorldRelation[];
  tasks: WorldTask[];
  diagram: WorldDiagram | null;
  utterances: Utterance[];
}

export function VisualizePanel({ entities, relations, tasks, diagram, utterances }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Top half: graph + diagram */}
      <div className="flex-1 flex border-b border-gray-800 min-h-0">
        {/* Concept Graph */}
        <div className="w-1/2 border-r border-gray-800 flex flex-col">
          <div className="px-3 py-2 border-b border-gray-800 text-xs font-medium text-gray-400 uppercase tracking-wider">
            Concept Graph
          </div>
          <div className="flex-1 min-h-0">
            <ConceptGraph entities={entities} relations={relations} />
          </div>
        </div>

        {/* Mermaid Diagram */}
        <div className="w-1/2 flex flex-col">
          <div className="px-3 py-2 border-b border-gray-800 text-xs font-medium text-gray-400 uppercase tracking-wider">
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
          <KanbanBoard tasks={tasks} utterances={utterances} />
        </div>
      </div>
    </div>
  );
}
