import type { WorldTask } from '@voxtral-flow/shared';

interface Props {
  tasks: WorldTask[];
}

const BUCKET_COLORS = {
  Now: 'border-red-500/30 bg-red-500/5',
  Next: 'border-yellow-500/30 bg-yellow-500/5',
  Later: 'border-blue-500/30 bg-blue-500/5',
};

const BUCKET_HEADERS = {
  Now: { label: 'Now', icon: '🔴', color: 'text-red-400' },
  Next: { label: 'Next', icon: '🟡', color: 'text-yellow-400' },
  Later: { label: 'Later', icon: '🔵', color: 'text-blue-400' },
};

export function KanbanBoard({ tasks }: Props) {
  const scrollToUtterance = (utteranceId: string) => {
    const el = document.getElementById(`utt-${utteranceId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-brand-900/30');
      setTimeout(() => el.classList.remove('bg-brand-900/30'), 2000);
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        Action items will appear here...
      </div>
    );
  }

  return (
    <div className="flex gap-3 p-3 h-full">
      {(['Now', 'Next', 'Later'] as const).map(bucket => {
        const items = tasks.filter(t => t.bucket === bucket);
        const header = BUCKET_HEADERS[bucket];

        return (
          <div key={bucket} className="flex-1 flex flex-col">
            <div className={`flex items-center gap-1.5 mb-2 ${header.color}`}>
              <span>{header.icon}</span>
              <span className="text-xs font-bold uppercase tracking-wider">{header.label}</span>
              <span className="text-xs text-gray-600 ml-auto">{items.length}</span>
            </div>

            <div className="flex-1 space-y-1.5 overflow-y-auto">
              {items.map(task => (
                <button
                  key={task.id}
                  onClick={() => scrollToUtterance(task.sourceUtteranceId)}
                  className={`kanban-card w-full text-left px-3 py-2 rounded-lg border ${BUCKET_COLORS[bucket]} text-sm text-gray-200 hover:text-white`}
                >
                  {task.title}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
