import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import type { WorldDiagram } from '@voxtral-flow/shared';

interface Props {
  diagram: WorldDiagram | null;
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'strict',
  fontFamily: 'ui-monospace, monospace',
  themeVariables: {
    primaryColor: '#1a1a3e',
    primaryTextColor: '#e0e0ff',
    primaryBorderColor: '#4c6ef5',
    lineColor: '#4c6ef5',
    secondaryColor: '#0d0d20',
    tertiaryColor: '#111133',
    edgeLabelBackground: '#0d0d20',
    clusterBkg: '#0d0d2a',
    clusterBorder: '#333366',
    titleColor: '#aaaadd',
    nodeTextColor: '#e0e0ff',
  },
});

export function MermaidDiagram({ diagram }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [editSource, setEditSource] = useState('');
  const [renderError, setRenderError] = useState('');
  const [overrideSource, setOverrideSource] = useState<string | null>(null);

  useEffect(() => {
    const source = overrideSource ?? diagram?.mermaidSource;
    if (source && !editMode) {
      renderDiagram(source);
    }
  }, [diagram, editMode, overrideSource]);

  const renderIdRef = useRef(0);

  const renderDiagram = async (source: string) => {
    if (!containerRef.current) return;
    setRenderError('');
    // Use unique ID per render to avoid Mermaid duplicate-id errors
    const id = `mermaid-svg-${++renderIdRef.current}`;
    try {
      const { svg } = await mermaid.render(id, source);
      containerRef.current.innerHTML = svg;
    } catch (err) {
      setRenderError(String(err));
      // Keep the last successfully rendered diagram visible
    }
  };

  const handleEdit = () => {
    setEditMode(true);
    setEditSource(overrideSource ?? diagram?.mermaidSource ?? '');
  };

  const handleApply = () => {
    setOverrideSource(editSource);
    setEditMode(false);
  };

  if (!diagram) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        Diagram will appear here...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{diagram.type}</span>
        <button
          onClick={editMode ? handleApply : handleEdit}
          className="text-xs text-brand-400 hover:text-brand-300"
        >
          {editMode ? 'Apply' : 'Edit Source'}
        </button>
      </div>

      {editMode && (
        <textarea
          value={editSource}
          onChange={(e) => setEditSource(e.target.value)}
          className="w-full h-32 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 p-2 font-mono resize-y focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      )}

      <div ref={containerRef} className="mermaid-container" />

      {renderError && (
        <p className="text-xs text-red-400">{renderError}</p>
      )}
    </div>
  );
}
