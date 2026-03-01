import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from '../lib/nanoid';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'pt', label: 'Português' },
  { code: 'ko', label: '한국어' },
  { code: 'it', label: 'Italiano' },
  { code: 'ru', label: 'Русский' },
];

export function JoinPage() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [speakLang, setSpeakLang] = useState('en');
  const [targetLang, setTargetLang] = useState('es');
  const [inputMode, setInputMode] = useState<'per_user_mic' | 'shared_mic'>('per_user_mic');

  const handleJoin = () => {
    const rid = roomId.trim() || nanoid(8);
    const name = displayName.trim() || 'Guest';
    const userId = nanoid(8);

    // Store join params in sessionStorage for the room page
    sessionStorage.setItem('pb:userId', userId);
    sessionStorage.setItem('pb:displayName', name);
    sessionStorage.setItem('pb:speakLang', speakLang);
    sessionStorage.setItem('pb:targetLang', targetLang);
    sessionStorage.setItem('pb:inputMode', inputMode);

    navigate(`/room/${rid}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo area */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
            Party Babel
          </h1>
          <p className="text-gray-400 mt-2">Multilingual conversations, visualized.</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          {/* Room ID */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Room ID</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Leave empty for random room"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Languages */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">I speak</label>
              <select
                value={speakLang}
                onChange={(e) => setSpeakLang(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Translate to</label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Input Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Mic Mode</label>
            <div className="flex gap-3">
              <button
                onClick={() => setInputMode('per_user_mic')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                  inputMode === 'per_user_mic'
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                🎤 Per User
              </button>
              <button
                onClick={() => setInputMode('shared_mic')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                  inputMode === 'shared_mic'
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                📡 Shared Mic
              </button>
            </div>
          </div>

          {/* Join Button */}
          <button
            onClick={handleJoin}
            className="w-full py-3 bg-gradient-to-r from-brand-600 to-purple-600 text-white font-semibold rounded-lg hover:from-brand-500 hover:to-purple-500 transition shadow-lg shadow-brand-500/25"
          >
            Join Room →
          </button>
        </div>

        <p className="text-center text-gray-600 text-xs mt-4">
          100% local — no data leaves your machine
        </p>
      </div>
    </div>
  );
}
