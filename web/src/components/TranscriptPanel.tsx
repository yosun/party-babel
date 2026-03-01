import { useEffect, useRef } from 'react';
import type { Utterance, RoomUser } from '../hooks/useRoom';

interface Props {
  utterances: Utterance[];
  drafts: Map<string, string>;
  users: RoomUser[];
  targetLang: string;
}

const SPEAKER_COLORS = [
  'text-blue-400', 'text-green-400', 'text-yellow-400',
  'text-pink-400', 'text-purple-400', 'text-orange-400',
  'text-cyan-400', 'text-rose-400',
];

export function TranscriptPanel({ utterances, drafts, users, targetLang }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [utterances, drafts]);

  const getColor = (speakerId: string) => {
    const idx = users.findIndex(u => u.userId === speakerId);
    return SPEAKER_COLORS[Math.max(0, idx) % SPEAKER_COLORS.length];
  };

  const getName = (speakerId: string) => {
    return users.find(u => u.userId === speakerId)?.displayName || speakerId;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-gray-800 text-sm font-medium text-gray-300">
        Transcript
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto transcript-scroll p-4 space-y-3">
        {utterances.length === 0 && drafts.size === 0 && (
          <div className="text-center text-gray-600 mt-12">
            <p className="text-4xl mb-3">🎙️</p>
            <p>Click "Listen" to start speaking, or "Simulate conversation"</p>
          </div>
        )}

        {utterances.map((u) => (
          <div key={u.utteranceId} className="group" id={`utt-${u.utteranceId}`}>
            <div className="flex items-start gap-2">
              <span className={`font-semibold text-sm ${getColor(u.speakerId)}`}>
                {getName(u.speakerId)}
              </span>
              <span className="text-xs text-gray-600 mt-0.5">
                {new Date(u.tStartMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <p className="text-white text-sm mt-0.5">{u.text}</p>
            {/* Translations */}
            {u.translations.size > 0 && (
              <div className="mt-1 space-y-0.5">
                {Array.from(u.translations.entries()).map(([lang, translation]) => (
                  <p key={lang} className="text-xs text-gray-400 italic pl-3 border-l-2 border-gray-700">
                    <span className="text-gray-500">[{lang}]</span> {translation}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Draft transcripts (live) */}
        {Array.from(drafts.entries()).map(([speakerId, text]) => (
          <div key={`draft-${speakerId}`} className="opacity-60">
            <span className={`font-semibold text-sm ${getColor(speakerId)}`}>
              {getName(speakerId)}
            </span>
            <p className="text-white text-sm mt-0.5 italic">{text}
              <span className="inline-block w-1.5 h-4 bg-brand-400 animate-pulse ml-0.5 align-text-bottom" />
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
