https://youtu.be/uZjVvo-bG3s

# Voxtral Flow 🗣️🌍

**Realtime Speech to Universal Visual Language** — we stream speech into structured intelligence.

Speak in any language. Everyone reads in theirs. Watch the conversation become a **concept graph**, a **Mermaid diagram**, and an **action board** — live.

Supports: English, Español, Français, Deutsch, 日本語, 中文, Português, 한국어, Italiano, Русский, and **Esperanto**.

Built for the **Mistral hackathon**. Runs **100% locally** (no cloud required), or one env var switches to the **Mistral cloud API**.

---

## Why Mistral

Voxtral Flow is built around what's uniquely strong in the Mistral ecosystem:

- **Voxtral Realtime (speech-to-text)** powers live captions and everything downstream.
- **Deploy it your way**: run locally on Apple Silicon / CPU, self-host via vLLM on NVIDIA, or set `MISTRAL_API_KEY` for zero-setup cloud mode.
- **Live now, polish later**: run realtime captions during the session, then optionally run an offline polish pass (speaker diarization, timestamps) for meeting-grade output.

---

## Quick Start

### Prerequisites

- Node.js ≥ 20  
- pnpm ≥ 9  
- Docker (PostgreSQL)  
- Python 3.10+ (local Voxtral STT only — not needed for Cloud or Demo mode)

### 1) Clone & install

```bash
git clone <repo-url> party-babel && cd party-babel
cp .env.example .env
pnpm install
```

### 2) Start database

```bash
cd ops && docker compose up -d && cd ..
```

### 3) Set up database

```bash
pnpm db:generate
pnpm db:migrate -- --name init
pnpm db:seed
```

### 4) Build shared package

```bash
pnpm --filter @party-babel/shared build
```

### 5) Run

```bash
pnpm dev
```

Open http://localhost:5173.  
Click **Simulate** to see the full pipeline without audio/model setup.

---

## 60-Second Demo Script

1. Open http://localhost:5173  
2. Enter:
   - Room ID: `demo`
   - Display Name: `Alice`
   - Speak: English
   - Translate to: Esperanto (or any language)
3. Click **Join Room**
4. Click **Visualize**
5. Click **Simulate**
6. Watch: transcript → translations → concept graph grows → Mermaid diagram updates → action items populate the kanban board
7. Click **Export → Markdown Report** to download the session

Tip: For a live mic demo, join the same room on 2–3 devices and set different target languages.

---

## Runtime Modes

| Mode    | Engine                   | Hardware                | Config |
|---------|--------------------------|-------------------------|--------|
| Default | TransformersVoxtralEngine | Apple Silicon (MPS) / CPU | Default — no config needed |
| GPU     | VLLMRealtimeEngine        | NVIDIA GPU              | `STT_ENGINE=vllm` |
| Cloud   | Mistral API               | Any (internet required) | `MISTRAL_API_KEY=your-key` |
| Demo    | Simulated (no real audio) | Any                     | Click **Simulate** |

> **Engine priority:** if `MISTRAL_API_KEY` is set, the server always uses the Mistral API for both STT and translation, regardless of `STT_ENGINE`. Otherwise `STT_ENGINE` selects the local engine (`transformers` or `vllm`).

---

## Apple Silicon Setup (default local mode)

Default STT runs **local Voxtral inference** via HuggingFace Transformers on **MPS** (Metal Performance Shaders).

```bash
# Set up the Python environment
python3 -m venv .venv && source .venv/bin/activate
pip install -r server/workers/requirements.txt

# First run downloads the Voxtral model (~8 GB)
pnpm dev

### CPU-only tuning (still works, just slower)

- Set `TRANSCRIPTION_DELAY_MS=1000` to `2000` in `.env`
- Use push-to-talk mode (Record → speak → Stop)
- Expect higher latency; the rest of the pipeline (translation → visualize → export) stays the same

---

## NVIDIA / vLLM Setup (local GPU)

For NVIDIA GPUs, use vLLM for faster inference:

```bash
pip install vllm
./ops/start-vllm.sh

# Configure .env
STT_ENGINE=vllm
VLLM_REALTIME_URL=http://localhost:8000/v1/realtime

pnpm dev
```

---

## Cloud Mode (Mistral API)

If you have a hackathon-provided Mistral API key, this is the fastest "it just works" path — no Python, no model download, no GPU.

```bash
# .env
MISTRAL_API_KEY=your-api-key-here
```

That's it. When `MISTRAL_API_KEY` is set, both STT and translation automatically use the Mistral API. The `STT_ENGINE` setting is ignored.

---

## Shared Microphone Mode

Two capture styles:

| Style | Setup | Best for |
|-------|-------|----------|
| **Per-user mic** | Each participant streams their own mic | Clean speaker attribution |
| **Shared mic** | One device captures ambient audio | "Party table" demos |

In shared mic mode, live captions optimize for latency. Speaker labels can be assigned manually via `tag_speaker`, or separated offline in a post-session polish pass.

---

## Architecture

```text
┌────────────┐      WebSocket       ┌──────────────────────┐
│   Browser   │ ◄────────────────► │  Fastify Server       │
│  React+Vite │   audio / events    │  ├─ Room Manager      │
└────────────┘                      │  ├─ Commit Detector   │
                                    │  ├─ Translation       │
                                    │  ├─ World State       │
                                    │  ├─ Exports           │
                                    │  └─ Metering          │
                                    └───┬──────────────┬────┘
                                        │              │
                              stdin/stdout     HTTPS (cloud mode)
                                        │              │
                                  ┌─────┴─────┐  ┌────┴──────────┐
                                  │  Python    │  │  Mistral API  │
                                  │  Voxtral   │  │  (STT + LLM)  │
                                  │  Worker    │  └───────────────┘
                                  └───────────┘
                                  (local mode)    (cloud mode)
```

### Tech Stack

| Layer | Technology |
|------|------------|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Fastify + WebSocket |
| STT | Voxtral Realtime (local: Transformers/vLLM) or Mistral API (cloud) |
| Translation | Heuristic (default), local LLM, or Mistral API |
| Database | PostgreSQL + Prisma |
| Visualization | D3.js (force graph) + Mermaid |
| Monorepo | pnpm workspaces |

---

## Project Structure

```text
party-babel/
├── shared/           # Shared TS types + Zod schemas
│   └── src/
│       ├── schemas.ts        # WS message schemas
│       ├── types.ts          # WorldState, tiers, demo script
│       └── index.ts
├── server/           # Fastify backend
│   ├── src/
│   │   ├── app.ts            # Fastify app setup
│   │   ├── config.ts         # Env config with Zod
│   │   ├── ws/               # WebSocket handlers
│   │   ├── stt/              # STT engines (Transformers, vLLM, Mistral API)
│   │   ├── translation/      # Translation engines (heuristic, local LLM, Mistral API)
│   │   ├── semantics/        # World state + heuristic extractor
│   │   ├── auth/             # JWT auth scaffolding
│   │   ├── metering/         # Usage tracking hooks
│   │   └── simulate.ts       # Demo conversation driver
│   ├── workers/
│   │   └── voxtral_worker.py # Voxtral local inference worker
│   ├── prisma/
│   │   └── schema.prisma     # DB schema
│   └── __tests__/            # Unit + integration tests
├── web/              # React frontend
│   └── src/
│       ├── pages/            # Join + Room pages
│       ├── components/       # UI components
│       ├── hooks/            # WS + Room hooks
│       └── lib/              # Audio capture, export utils
├── ops/              # DevOps
│   ├── docker-compose.yml
│   ├── start-voxtral.sh
│   └── start-vllm.sh
└── .github/workflows/ci.yml
```

---

## Monetization Architecture

### Product tiers (in code)

| Feature | Free | Pro | Team |
|---------|------|-----|------|
| Participants | 4 | 12 | 50 |
| Session length | 30 min | 2 hr | 8 hr |
| Languages | 2 | 10 | 50 |
| Visualize Mode | ❌ | ✅ | ✅ |
| Exports | ❌ | ✅ | ✅ |
| Diarization (post-session) | ❌ | ✅ | ✅ |

Feature flags are defined in `shared/src/types.ts` (`TIER_LIMITS`). Payment integration slots are ready.

### Usage metering

Per-room tracking of:

- Audio seconds processed
- Translations generated

Stored in-memory in dev (production: persist to DB via metering hooks).

---

## Event Schema

All WS messages are validated with Zod schemas (see `shared/src/schemas.ts`).

### Client → Server

- `join_room` — join/create a room
- `audio_chunk` — PCM16 audio frame (base64)
- `set_target_lang` — change translation language
- `toggle_visualize` — enable/disable visualize mode
- `tag_speaker` — label speaker (shared mic mode)

### Server → Client

- `room_state` — current room + users
- `transcript_delta` — live draft text
- `utterance_commit` — finalized utterance
- `translation_commit` — translated utterance
- `world_patch` — entities/relations/tasks/diagram update
- `engine_status` — STT + translation engine info

---

## Tests

```bash
pnpm test            # run once
pnpm test -- --watch # re-run on changes
```

32 tests across 3 suites:

- **Commit detector** — punctuation, idle timeout, buffer overflow, multi-speaker
- **Heuristic extractor** — entity / relation / task extraction, diagram type detection
- **WS event flow** — join_room / room_state, Zod validation errors, simulate pipeline

---

## Troubleshooting

### Visualization goes blank

- Clear browser cache and hard-refresh (`Cmd+Shift+R` / `Ctrl+Shift+R`)
- If running a dev build, restart `pnpm dev` to pick up fixes

### Mic permission denied

- Chrome: click the lock icon in the address bar → allow microphone
- Safari: Preferences → Websites → Microphone

### Port conflicts

- Server: change `PORT` in `.env` (default: 3001)
- Web: change port in `web/vite.config.ts` (default: 5173)
- Postgres: change port mapping in `ops/docker-compose.yml`

### Model download slow

- First Voxtral download is ~8 GB — use a fast connection.
- Cached at `~/.cache/huggingface/` for subsequent runs.
- To skip entirely, use Cloud mode (`MISTRAL_API_KEY`).

### Python worker not starting

- Ensure Python 3.10+ and dependencies are installed
- Check `server/workers/requirements.txt`
- Run manually: `python3 server/workers/voxtral_worker.py`
- Not needed in Cloud mode — set `MISTRAL_API_KEY` instead

---

## License

MIT
