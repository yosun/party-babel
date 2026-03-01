#!/usr/bin/env python3
"""
Voxtral Realtime Worker — real local inference via HuggingFace Transformers.

IPC: newline-delimited JSON over stdin/stdout.

Input messages:
  {"type":"start_session","speakerId":"...","speakLang":"en"}
  {"type":"audio","speakerId":"...","pcm16_base64":"...","sample_rate":16000,"tMs":...}
  {"type":"stop_session","speakerId":"..."}

Output messages:
  {"type":"delta","speakerId":"...","text":"...","tMs":...}
  {"type":"final","speakerId":"...","text":"...","tStartMs":...,"tEndMs":...,"langGuess":"..."}
  {"type":"error","speakerId":"...","text":"..."}
"""

import sys
import os
import json
import base64
import time
import threading
import queue
import numpy as np

VOXTRAL_MODEL_ID = os.environ.get("VOXTRAL_MODEL_ID", "mistralai/Voxtral-Mini-4B-Realtime-2602")
TRANSCRIPTION_DELAY_MS = int(os.environ.get("TRANSCRIPTION_DELAY_MS", "480"))
SAMPLE_RATE = 16000


def emit(msg: dict):
    """Send a JSON message to Node via stdout."""
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def emit_error(speaker_id: str, text: str):
    emit({"type": "error", "speakerId": speaker_id, "text": text})


class SpeakerSession:
    def __init__(self, speaker_id: str, speak_lang: str = ""):
        self.speaker_id = speaker_id
        self.speak_lang = speak_lang
        self.audio_buffer = np.array([], dtype=np.float32)
        self.t_start_ms = 0
        self.last_append_ms = 0
        self.active = True


class VoxtralWorker:
    def __init__(self):
        self.sessions: dict[str, SpeakerSession] = {}
        self.model = None
        self.processor = None
        self.device = "cpu"
        self.model_loaded = False
        self._load_model()

    def _load_model(self):
        """Load the Voxtral model. May take time on first run (downloads weights)."""
        try:
            import torch
            from transformers import AutoProcessor, VoxtralRealtimeForConditionalGeneration

            print("WORKER_READY_LOADING", file=sys.stderr, flush=True)

            # Determine device
            if torch.backends.mps.is_available():
                self.device = "mps"
            elif torch.cuda.is_available():
                self.device = "cuda"
            else:
                self.device = "cpu"

            self.processor = AutoProcessor.from_pretrained(VOXTRAL_MODEL_ID)
            self.model = VoxtralRealtimeForConditionalGeneration.from_pretrained(
                VOXTRAL_MODEL_ID,
                device_map="auto" if self.device != "cpu" else None,
                torch_dtype=torch.float16 if self.device != "cpu" else torch.float32,
            )
            if self.device == "cpu":
                self.model = self.model.to("cpu")

            self.model_loaded = True
            print("WORKER_READY", file=sys.stderr, flush=True)

        except ImportError as e:
            print(f"WORKER_READY", file=sys.stderr, flush=True)
            print(f"Model loading failed (missing deps): {e}", file=sys.stderr, flush=True)
            # Worker still runs — will return errors on audio
        except Exception as e:
            print(f"WORKER_READY", file=sys.stderr, flush=True)
            print(f"Model loading failed: {e}", file=sys.stderr, flush=True)

    def start_session(self, speaker_id: str, speak_lang: str = ""):
        self.sessions[speaker_id] = SpeakerSession(speaker_id, speak_lang)

    def stop_session(self, speaker_id: str):
        session = self.sessions.pop(speaker_id, None)
        if session and len(session.audio_buffer) > 0:
            self._process_buffer(session, final=True)

    def push_audio(self, speaker_id: str, pcm16_base64: str, sample_rate: int, t_ms: int):
        session = self.sessions.get(speaker_id)
        if not session:
            return

        # Decode PCM16 to float32
        pcm_bytes = base64.b64decode(pcm16_base64)
        pcm_int16 = np.frombuffer(pcm_bytes, dtype=np.int16)
        pcm_float = pcm_int16.astype(np.float32) / 32768.0

        if session.t_start_ms == 0:
            session.t_start_ms = t_ms
        session.last_append_ms = t_ms

        session.audio_buffer = np.concatenate([session.audio_buffer, pcm_float])

        # Process when we have enough audio (TRANSCRIPTION_DELAY_MS worth)
        samples_needed = int(SAMPLE_RATE * TRANSCRIPTION_DELAY_MS / 1000)
        if len(session.audio_buffer) >= samples_needed:
            self._process_buffer(session, final=False)

    def _process_buffer(self, session: SpeakerSession, final: bool = False):
        """Run inference on buffered audio and emit results."""
        if not self.model_loaded:
            emit_error(session.speaker_id, "Model not loaded")
            return

        if len(session.audio_buffer) < 160:  # minimum ~10ms
            return

        try:
            import torch

            audio = session.audio_buffer.copy()

            # Keep a small overlap for context, clear the rest
            overlap_samples = int(SAMPLE_RATE * 0.1)  # 100ms overlap
            if not final and len(session.audio_buffer) > overlap_samples:
                session.audio_buffer = session.audio_buffer[-overlap_samples:]
            else:
                session.audio_buffer = np.array([], dtype=np.float32)

            # Process with Voxtral
            inputs = self.processor(
                audios=[audio],
                sampling_rate=SAMPLE_RATE,
                return_tensors="pt",
            )

            # Move to device
            inputs = {k: v.to(self.model.device) if hasattr(v, 'to') else v for k, v in inputs.items()}

            with torch.no_grad():
                output_ids = self.model.generate(
                    **inputs,
                    max_new_tokens=128,
                    do_sample=False,
                )

            text = self.processor.batch_decode(output_ids, skip_special_tokens=True)[0].strip()

            if not text:
                return

            t_now = int(time.time() * 1000)

            if final:
                emit({
                    "type": "final",
                    "speakerId": session.speaker_id,
                    "text": text,
                    "tStartMs": session.t_start_ms,
                    "tEndMs": t_now,
                    "langGuess": session.speak_lang or None,
                })
                session.t_start_ms = t_now
            else:
                emit({
                    "type": "delta",
                    "speakerId": session.speaker_id,
                    "text": text,
                    "tMs": t_now,
                })

        except Exception as e:
            emit_error(session.speaker_id, str(e))


def main():
    worker = VoxtralWorker()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue

        msg_type = msg.get("type")
        speaker_id = msg.get("speakerId", "")

        if msg_type == "start_session":
            worker.start_session(speaker_id, msg.get("speakLang", ""))
        elif msg_type == "audio":
            worker.push_audio(
                speaker_id,
                msg.get("pcm16_base64", ""),
                msg.get("sample_rate", SAMPLE_RATE),
                msg.get("tMs", int(time.time() * 1000)),
            )
        elif msg_type == "stop_session":
            worker.stop_session(speaker_id)
        else:
            emit_error(speaker_id, f"Unknown message type: {msg_type}")


if __name__ == "__main__":
    main()
