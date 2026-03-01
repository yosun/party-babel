import { useParams } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRoom } from '../hooks/useRoom';
import { TranscriptPanel } from '../components/TranscriptPanel';
import { VisualizePanel } from '../components/VisualizePanel';
import { EngineStatus } from '../components/EngineStatus';
import { ExportMenu } from '../components/ExportMenu';
import { SimulateButton } from '../components/SimulateButton';
import { startAudioCapture } from '../lib/audio';
import type { InputMode } from '@party-babel/shared';

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [joined, setJoined] = useState(false);
  const [recording, setRecording] = useState(false);
  const [visualize, setVisualize] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  // Read session params once on mount
  const [userId] = useState(() => sessionStorage.getItem('pb:userId') || 'guest');
  const [displayName] = useState(() => sessionStorage.getItem('pb:displayName') || 'Guest');
  const [speakLang] = useState(() => sessionStorage.getItem('pb:speakLang') || 'en');
  const [targetLang] = useState(() => sessionStorage.getItem('pb:targetLang') || 'es');
  const [inputMode] = useState<InputMode>(() => (sessionStorage.getItem('pb:inputMode') || 'per_user_mic') as InputMode);

  const { connState, roomState, joinRoom, send, toggleVisualize, disconnect } = useRoom(roomId!);

  // Join room on mount, cleanup mic + ws on unmount
  useEffect(() => {
    if (!joined && roomId) {
      joinRoom({ userId, displayName, speakLang, targetLang, inputMode });
      setJoined(true);
    }
    return () => {
      stopRef.current?.();
      stopRef.current = null;
      disconnect();
    };
  }, [roomId, joined, joinRoom, userId, displayName, speakLang, targetLang, inputMode, disconnect]);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      stopRef.current?.();
      stopRef.current = null;
      setRecording(false);
    } else {
      try {
        const { stop } = await startAudioCapture((pcm16_base64, seq) => {
          send({
            type: 'audio_chunk',
            roomId: roomId!,
            userId,
            seq,
            pcm16_base64,
            sampleRate: 16000,
            channels: 1,
          });
        });
        stopRef.current = stop;
        setRecording(true);
      } catch (err) {
        console.error('Mic access denied:', err);
      }
    }
  }, [recording, roomId, userId, send]);

  const handleToggleVisualize = useCallback(() => {
    const next = !visualize;
    setVisualize(next);
    toggleVisualize(userId, next);
  }, [visualize, userId, toggleVisualize]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-800 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
            Party Babel
          </h1>
          <span className="text-gray-500 text-sm">/ {roomId}</span>
          <span className={`inline-block w-2 h-2 rounded-full ${
            connState === 'connected' ? 'bg-green-400' : connState === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
          }`} />
        </div>

        <div className="flex items-center gap-2">
          <EngineStatus status={roomState.engineStatus} />
          <SimulateButton roomId={roomId!} />
          <ExportMenu roomState={roomState} roomId={roomId!} />

          <button
            onClick={handleToggleVisualize}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              visualize
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {visualize ? '✨ Visualize ON' : '📊 Visualize'}
          </button>

          <button
            onClick={toggleRecording}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              recording
                ? 'bg-red-600 text-white'
                : 'bg-brand-600 text-white hover:bg-brand-500'
            }`}
          >
            {recording && <span className="w-2 h-2 rounded-full bg-white recording-dot" />}
            {recording ? 'Stop' : '🎤 Record'}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Transcript Panel (always visible) */}
        <div className={`${visualize ? 'w-1/3' : 'w-full'} flex flex-col border-r border-gray-800 transition-all duration-300`}>
          <TranscriptPanel
            utterances={roomState.utterances}
            drafts={roomState.drafts}
            users={roomState.users}
            targetLang={targetLang}
          />
        </div>

        {/* Visualize Panel (conditionally visible) */}
        {visualize && (
          <div className="w-2/3 flex flex-col overflow-hidden">
            <VisualizePanel
              entities={roomState.entities}
              relations={roomState.relations}
              tasks={roomState.tasks}
              diagram={roomState.diagram}
            />
          </div>
        )}
      </main>

      {/* Footer bar: users in room */}
      <footer className="px-4 py-2 bg-gray-900/80 border-t border-gray-800 flex items-center gap-4 text-sm text-gray-400">
        <span>{roomState.users.length} participant{roomState.users.length !== 1 ? 's' : ''}</span>
        <div className="flex gap-2">
          {roomState.users.map(u => (
            <span key={u.userId} className="px-2 py-0.5 bg-gray-800 rounded text-xs">
              {u.displayName} ({u.speakLang}→{u.targetLang})
            </span>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-600">
          {roomState.utterances.length} utterances · v{roomState.worldVersion}
        </span>
      </footer>
    </div>
  );
}
