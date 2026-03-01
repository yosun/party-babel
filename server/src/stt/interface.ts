export interface STTSessionOpts {
  roomId: string;
  speakerId: string;
  speakLang?: string;
}

export interface AudioFrame {
  speakerId: string;
  pcm16: Int16Array;
  tMs: number;
}

export interface STTDeltaEvent {
  speakerId: string;
  text: string;
  tMs: number;
}

export interface STTFinalEvent {
  speakerId: string;
  text: string;
  tStartMs: number;
  tEndMs: number;
  langGuess?: string;
}

export interface STTErrorEvent {
  speakerId: string;
  error: Error;
}

export interface StreamingSTTEngine {
  readonly name: string;
  startSession(opts: STTSessionOpts): Promise<void>;
  pushAudioFrame(frame: AudioFrame): void;
  stopSession(opts: { speakerId: string }): Promise<void>;

  onDelta(cb: (event: STTDeltaEvent) => void): void;
  onFinal(cb: (event: STTFinalEvent) => void): void;
  onError(cb: (event: STTErrorEvent) => void): void;
}
