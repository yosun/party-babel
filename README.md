# Party Babel 🗣️

**Multilingual party room** — realtime captions, translation, and conversation visualization.

Speak in any language. Everyone reads in theirs. Watch the conversation become a concept graph, a Mermaid diagram, and an action board — live.

Built for the Mistral hackathon. Runs 100% locally on your machine (no cloud APIs).

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **Docker** (for PostgreSQL)
- **Python 3.10+** (for Voxtral STT, optional for demo mode)

### 1. Clone & install

```bash
git clone <repo-url> party-babel && cd party-babel
cp .env.example .env
pnpm install
```

### 2. Start database

```bash
cd ops && docker compose up -d && cd ..
```

### 3. Set up database

```bash
pnpm db:generate
pnpm db:migrate -- --name init
pnpm db:seed
```

### 4. Build shared package

```bash
pnpm --filter @party-babel/shared build
```

### 5. Run

```bash
pnpm dev
```

Open **http://localhost:5173**. Click "Simulate" to see the full pipeline in action.

---

## 60-Second Demo Script

1. Open http://localhost:5173
2. Enter Room ID: `demo`, Display Name: `Alice`, Speak: English, Translate to: Spanish
3. Click **Join Room**
4. Click **✨ Visualize** to enable the visualization panel
5. Click **▶️ Simulate** to run the demo conversation
6. Watch: transcript appears → translations show up → concept graph grows → Mermaid diagram updates → action items populate the kanban board
7. Click **📥 Export** → Markdown Report to download the session

---

## Apple Silicon Setup (default)

The default engine uses local Voxtral inference via HuggingFace Transformers on MPS (Metal Performance Shaders).

```bash
# Set up Python environment
cd server/workers
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# First run downloads the model (~8GB)
cd ../..
pnpm --filter @party-babel/server stt:transformers
```

The Python worker communicates with Node via stdin/stdout JSON-LD IPC. It starts automatically when the server runs.

### CPU Mode Advice

On CPU-only machines:
- Increase `TRANSCRIPTION_DELAY_MS` to 1000–2000 in `.env`
- Use push-to-talk mode (click Record → speak → click Stop)
- Quality/latency will degrade but the full pipeline works

---

## NVIDIA / vLLM Setup

For NVIDIA GPUs, use vLLM for faster inference:

```bash
# Install vLLM
pip install vllm

# Start vLLM server
./ops/start-vllm.sh

# Configure .env
STT_ENGINE=vllm
VLLM_REALTIME_URL=http://localhost:8000/v1/realtime

# Start the app
pnpm dev
```

---

## Architecture

```
┌────────────┐     WebSocket      ┌──────────────────────┐
│   Browser   │ ◄──────────────► │  Fastify Server       │
│  React+Vite │  audio/events     │  ├─ Room Manager      │
└────────────┘                    │  ├─ Commit Detector   │
                                  │  ├─ Translation       │
                                  │  ├─ World State       │
                                  │  └─ Metering          │
                                  └──────┬───────────────┘
                                         │ stdin/stdout IPC
                                  ┌──────┴───────────────┐
                                  │  Python Voxtral Worker │
                                  │  (or vLLM HTTP)       │
                                  └──────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS |
| Backend | Fastify 5 + WebSocket |
| STT | Voxtral Mini 4B Realtime (local) |
| Translation | Heuristic (default) or local LLM |
| Database | PostgreSQL + Prisma |
| Visualization | D3.js (force graph) + Mermaid |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
party-babel/
├── shared/           # Shared TS types + zod schemas
│   └── src/
│       ├── schemas.ts  # All WS message schemas
│       ├── types.ts    # WorldState, tiers, demo script
│       └── index.ts
├── server/           # Fastify backend
│   ├── src/
│   │   ├── app.ts          # Fastify app setup
│   │   ├── config.ts       # Env config with zod
│   │   ├── ws/             # WebSocket handlers
│   │   ├── stt/            # STT engines (Transformers, vLLM)
│   │   ├── translation/    # Translation pipeline
│   │   ├── semantics/      # World state + heuristic extractor
│   │   ├── auth/           # JWT auth scaffolding
│   │   ├── metering/       # Usage tracking
│   │   └── simulate.ts     # Demo conversation driver
│   ├── workers/
│   │   └── voxtral_worker.py  # Real Voxtral inference
│   ├── prisma/
│   │   └── schema.prisma   # Full DB schema
│   └── __tests__/          # Unit + integration tests
├── web/              # React frontend
│   └── src/
│       ├── pages/          # Join + Room pages
│       ├── components/     # UI components
│       ├── hooks/          # WS + Room hooks
│       └── lib/            # Audio capture, export utils
├── ops/              # DevOps
│   ├── docker-compose.yml
│   ├── start-voxtral.sh
│   └── start-vllm.sh
└── .github/workflows/ci.yml
```

---

## Runtime Modes

| Mode | Engine | Hardware | Config |
|------|--------|----------|--------|
| Default | TransformersVoxtralEngine | Apple Silicon (MPS) / CPU | `STT_ENGINE=transformers` |
| GPU | VLLMRealtimeEngine | NVIDIA GPU | `STT_ENGINE=vllm` |
| Demo | Simulated (no real audio) | Any | Click "Simulate" button |

---

## Monetization Architecture

### Product Tiers (in code)

| Feature | Free | Pro | Team |
|---------|------|-----|------|
| Participants | 4 | 12 | 50 |
| Session length | 30 min | 2 hr | 8 hr |
| Languages | 2 | 10 | 50 |
| Visualize Mode | ❌ | ✅ | ✅ |
| Exports | ❌ | ✅ | ✅ |
| Diarization | ❌ | ✅ | ✅ |

Feature flags are defined in `shared/src/types.ts` (`TIER_LIMITS`). Payment integration slots ready.

### Usage Metering

Per-room tracking of:
- Audio seconds processed
- Translations generated
- Stored in-memory (production: persist to DB via metering hooks)

---

## Event Schema

All WS messages are validated with Zod schemas (see `shared/src/schemas.ts`).

### Client → Server
- `join_room` — join/create a room
- `audio_chunk` — PCM16 audio frame (base64)
- `set_target_lang` — change translation language
- `toggle_visualize` — enable/disable visualize mode
- `tag_speaker` — label speaker (shared_mic mode)

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
pnpm test          # Run all tests
pnpm test -- --watch  # Watch mode
```

Tests include:
- **Commit detector**: punctuation, idle timeout, buffer overflow, multi-speaker
- **Heuristic extractor**: entity, relation, task extraction; diagram type detection
- **WS event flow**: health check, join_room/room_state, validation errors, simulate endpoint

---

## Troubleshooting

### Mic permission denied
- Chrome: click lock icon in address bar → allow microphone
- Safari: Preferences → Websites → Microphone

### Port conflicts
- Server: change `PORT` in `.env` (default: 3001)
- Web: change port in `web/vite.config.ts` (default: 5173)
- Postgres: change port mapping in `ops/docker-compose.yml`

### Model download slow
- First Voxtral download is ~8GB. Use a fast connection.
- Model is cached in `~/.cache/huggingface/` for subsequent runs.

### Python worker not starting
- Ensure Python 3.10+ and pip dependencies installed
- Check `server/workers/requirements.txt`
- Run manually: `python3 server/workers/voxtral_worker.py`

---

## License

MIT
