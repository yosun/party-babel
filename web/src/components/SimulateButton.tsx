import { useState } from 'react';

interface Props {
  roomId: string;
}

export function SimulateButton({ roomId }: Props) {
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    setLoading(true);
    try {
      await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      });
    } catch (err) {
      console.error('Simulate failed:', err);
    }
    // Keep loading for a moment to indicate it's running
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <button
      onClick={handleSimulate}
      disabled={loading}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
        loading
          ? 'bg-green-900 text-green-300 cursor-wait'
          : 'bg-green-800 text-green-200 hover:bg-green-700'
      }`}
    >
      {loading ? '⏳ Running...' : '▶️ Simulate'}
    </button>
  );
}
