interface Props {
  status: {
    sttEngine: string;
    translationEngine: string;
    latencyMs: number;
    warnings: string[];
  } | null;
}

export function EngineStatus({ status }: Props) {
  if (!status) {
    return (
      <div className="text-xs text-gray-600 px-2 py-1">
        Engine: connecting...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-400 px-2 py-1 bg-gray-800/50 rounded">
      <span title="STT Engine">🧠 {status.sttEngine}</span>
      <span className="text-gray-600">|</span>
      <span title="Translation Engine">🌐 {status.translationEngine}</span>
      <span className="text-gray-600">|</span>
      <span title="Latency">⚡ {status.latencyMs}ms</span>
      {status.warnings.length > 0 && (
        <span className="text-yellow-400" title={status.warnings.join(', ')}>⚠️</span>
      )}
    </div>
  );
}
