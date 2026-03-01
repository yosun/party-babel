/**
 * Browser Speech Recognition wrapper.
 * Uses the Web Speech API (Chrome, Safari, Edge) for real-time STT
 * without any server-side ML or API keys.
 */

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SpeechRecognitionResult {
  transcript: string;
  isFinal: boolean;
}

interface SpeechRecognitionCallbacks {
  /** Called for both interim and final results */
  onResult: (result: SpeechRecognitionResult) => void;
  /** Called when recognition ends (whether intentional or not) */
  onEnd?: () => void;
  /** Called on error */
  onError?: (error: string) => void;
}

export function isSpeechRecognitionSupported(): boolean {
  return !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function startSpeechRecognition(
  lang: string,
  callbacks: SpeechRecognitionCallbacks,
): { stop: () => void } {
  const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    callbacks.onError?.('Speech recognition not supported in this browser');
    callbacks.onEnd?.();
    return { stop() {} };
  }

  const recognition = new SpeechRecognition();
  recognition.lang = lang;
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;

  let stopped = false;

  recognition.onresult = (event: any) => {
    // Process from the latest result
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      callbacks.onResult({
        transcript: result[0].transcript.trim(),
        isFinal: result.isFinal,
      });
    }
  };

  recognition.onerror = (event: any) => {
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    callbacks.onError?.(event.error);
  };

  recognition.onend = () => {
    // Auto-restart if not intentionally stopped (browser stops after silence)
    if (!stopped) {
      try { recognition.start(); } catch { /* already running */ }
      return;
    }
    callbacks.onEnd?.();
  };

  recognition.start();

  return {
    stop() {
      stopped = true;
      recognition.stop();
    },
  };
}
