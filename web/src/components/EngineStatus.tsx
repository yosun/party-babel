interface Props {
  status: {
    sttEngine: string;
    translationEngine: string;
    latencyMs: number;
    warnings: string[];
  } | null;
  connState: 'connecting' | 'connected' | 'disconnected';
}

export function EngineStatus({ status, connState }: Props) {
  if (connState === 'disconnected') {
    return (
      <div className="text-xs text-red-400 px-2 py-1">
        Disconnected
      </div>
    );
  }
  if (connState === 'connecting' || !status) {
    return (
      <div className="text-xs text-yellow-400 px-2 py-1 animate-pulse">
        Connecting...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-400 px-2 py-1 bg-gray-800/50 rounded">
      <span title="STT Engine">🧠 {status.sttEngine}</span>
      <span className="text-gray-600">|</span>
      <span title="Translation Engine">🌐 {status.translationEngine}</span>
      <span className="text-gray-600">|</span>
      <span title="Latency">⚡ {status.latencyMs > 0 ? `${status.latencyMs}ms` : '—'}</span>
      {status.warnings.length > 0 && (
        <span className="text-yellow-400 max-w-[280px] truncate" title={status.warnings.join('\n')}>
          ⚠️ {status.warnings[0]}
        </span>
      )}
    </div>
  );
}
