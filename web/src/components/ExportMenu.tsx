import { useState } from 'react';
import type { RoomState } from '../hooks/useRoom';
import { exportMarkdown, exportJSON, downloadBlob } from '../lib/export';

interface Props {
  roomState: RoomState;
  roomId: string;
}

export function ExportMenu({ roomState, roomId }: Props) {
  const [open, setOpen] = useState(false);

  const handleExportMd = () => {
    const md = exportMarkdown(roomState, roomId);
    downloadBlob(md, `party-babel-${roomId}.md`, 'text/markdown');
    setOpen(false);
  };

  const handleExportJson = () => {
    const json = exportJSON(roomState, roomId);
    downloadBlob(json, `party-babel-${roomId}.json`, 'application/json');
    setOpen(false);
  };

  const handleExportSvg = () => {
    const svg = document.querySelector('.mermaid-container svg');
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      downloadBlob(svgData, `party-babel-${roomId}-diagram.svg`, 'image/svg+xml');
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 transition"
      >
        📥 Export
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]">
            <button onClick={handleExportMd} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
              📝 Markdown Report
            </button>
            <button onClick={handleExportJson} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
              📋 JSON Export
            </button>
            <button onClick={handleExportSvg} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
              🖼️ Diagram SVG
            </button>
          </div>
        </>
      )}
    </div>
  );
}
