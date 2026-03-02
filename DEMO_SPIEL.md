# Voxtral Flow — Live Demo Script

> **Delivery time:** ~5 minutes  
> **Setup:** Browser open at `http://localhost:5173`, app running via `pnpm dev`  
> **Goal:** Show speech → transcription → translation → live visualization in one fluid arc

---

## 🎬 OPENING (30 seconds)

> *[Start on the Join Page — the gradient "Voxtral Flow" title is visible]*

**SAY:**

"Imagine you're in a meeting with people who speak English, Japanese, and Esperanto. Right now, you'd either all switch to one language — or get lost.

Voxtral Flow makes that problem disappear. You **speak in your language**, and everyone **reads in theirs**. But that's just the beginning — everything you say gets turned into a **live knowledge graph, an architecture diagram, and an action board** while you talk.

The entire thing runs on **Mistral AI** — and it works **100% locally**. No data leaves your machine."

---

## 🧩 WHY MISTRAL — THE DIFFERENTIATORS (45 seconds)

> *[Still on the Join Page — point to the language selector showing 11 languages including Esperanto]*

**SAY:**

"Let me explain why we built this on Mistral specifically. Three things set it apart:

**First — Voxtral.** This is Mistral's speech-to-text model. It doesn't just transcribe — it does **multilingual streaming transcription** natively. One model handles English, Japanese, French, all the languages you see here. Most STT systems need a separate model per language. Voxtral handles them all in a single pass.

**Second — deploy it YOUR way.** We built three engine modes. You can run Voxtral locally on Apple Silicon through HuggingFace Transformers, self-host it on a GPU server via vLLM, or just set one environment variable — `MISTRAL_API_KEY` — and it switches to the Mistral cloud API. Same app, zero code changes.

**Third — the intelligence layer.** Mistral's chat models power the real magic: every utterance gets analyzed for **entities, relations, and action items** in a single LLM call. The model extracts a knowledge graph from natural conversation and picks the right visualization — whether that's an architecture diagram, a timeline, a decision tree, or an org hierarchy. No prompt chaining. One shot."

---

## 🚀 JOINING A ROOM (30 seconds)

> *[Fill in the Join form as you speak]*

**SAY:**

"Let me show you. I'll join as Alice — I speak English, and I want my translations in Esperanto."

**DO:**
1. Type **Room ID:** `demo`
2. Type **Display Name:** `Alice`
3. Set **I speak:** `English`
4. Set **Translate to:** `Esperanto`
5. Click **Join Room**

> *[You land on the Room Page — transcript panel on the left, header bar on top]*

"I'm in the room. You can see the connection status is green — we're on a live WebSocket to the server. Up here the engine status badge tells me exactly which engines are active — whether I'm hitting the Mistral API or running locally."

---

## 📡 THE PIPELINE — SIMULATE (2 minutes)

> *[This is the demo's visual climax]*

**SAY:**

"Now the best part. I'm going to simulate a multilingual conversation where three engineers — Alice in English, Kenji in Japanese, and Lidia in Esperanto — explain how this very system works. **The app will visualize itself** as they speak."

**DO:**
1. Click **Visualize** (the toggle button) — the right panel opens, showing the empty Concept Graph, Mermaid Diagram, and Action Board
2. Click **▶ Simulate**

> *[Narrate over the simulation as it unfolds for ~60 seconds]*

**SAY (while watching the simulation):**

"Watch the transcript on the left — three people are speaking in three different languages. Each utterance gets translated into the other participants' languages — see the italic translations appearing under each message. That's Mistral's translation engine working in real time.

*[~10 seconds in, first nodes appear in the Concept Graph]*

Now look at the Concept Graph — it's building a **D3 force-directed graph** from what people are saying. Every technical term — Browser, Microphone, WebSocket, Voxtral — becomes a node. The relationships between them — 'uses', 'connects to', 'feeds' — become the edges. This is **zero configuration** — the system extracts meaning from natural speech.

*[~20 seconds in, the Mermaid diagram starts showing architecture with subgraph clusters]*

The Mermaid diagram is organizing everything into architecture layers — Frontend, Gateway, Services, Intelligence, Data Layer. These subgraph clusters aren't hardcoded — they're inferred from the conversation. If you were talking about a family tree instead of software, it would switch to a hierarchy diagram. If you're making decisions, it becomes a decision tree.

*[~40 seconds in, tasks appear in the Kanban board]*

Now the Action Board is populating. When someone says 'First write integration tests', 'Next build the audio preprocessing pipeline', 'Later add encryption' — those trigger patterns become Now / Next / Later kanban cards. Click any card and it **scrolls to the exact utterance** it came from."

---

## 🔍 ANATOMY OF THE VISUALIZATION (45 seconds)

> *[Simulation is complete — rich graph, diagram, and kanban are visible]*

**SAY:**

"Let me walk through what we're looking at.

**Concept Graph** — this is a live D3 force simulation. Node size scales with connection degree. Colors shift along a neon palette from blue to coral as nodes get more connected. You can drag nodes around. The glow effects and dot-grid background are all SVG — no canvas, no WebGL, pure DOM.

**Mermaid Diagram** — auto-generated Mermaid flowchart with smart subgroup clustering. See the labeled edges — 'uses', 'calls', 'depends_on'. Click **Edit Source** and you can modify the Mermaid code directly — it re-renders live. That means you can use this as a starting point and refine it into a real architecture doc.

**Action Board** — three-column kanban: Now, Next, Later. Every card links back to its source utterance with a smooth scroll highlight. This is how a conversation becomes a backlog — automatically.

*[Point to the stats bar]*

The stats bar shows you the graph growing in real time — node count, edge count, task count — and which diagram type was detected."

---

## 📤 EXPORT (20 seconds)

**SAY:**

"When your meeting is done, click **Export**. You get three options:

- **Markdown Report** — full transcript with translations, action items as checkboxes, and the Mermaid diagram embedded as a code block. Drop it into GitHub and the diagram just renders.
- **JSON Export** — structured data: every entity, relation, task, utterance, and translation. Feed it into your project management tool.
- **Diagram SVG** — the Mermaid diagram as a vector graphic. Put it in a slide deck, a wiki, wherever."

**DO:** Click **Export → Markdown Report** to demonstrate the download.

---

## 🎙️ LIVE MIC (optional — 30 seconds)

> *[Only if you have a working mic and browser speech recognition]*

**SAY:**

"And if you want to see it live — not simulated — I'll click **Listen**."

**DO:** Click **Listen**, speak a few sentences:

> "The authentication service connects to Redis for session storage. Redis depends on the database for persistence. We should deploy this with Docker next week."

"See? New nodes appeared — Authentication, Redis, Database, Docker. New edges — 'connects to', 'depends on'. A new task in the kanban — 'deploy this with Docker next week' goes into the **Next** column. All from one paragraph of natural speech."

---

## 🔒 CLOSING (30 seconds)

**SAY:**

"To recap — Voxtral Flow is a **realtime speech-to-visual-language platform** built entirely on Mistral AI:

- **Voxtral** handles speech-to-text for 11+ languages in one model
- **Mistral chat models** power translation, entity extraction, and diagram generation — all in single-shot LLM calls
- **Three deployment modes** — local on Apple Silicon, GPU via vLLM, or Mistral cloud with one env var
- **Everything visualized** — concept graphs, auto-diagramming, and kanban extraction happen live as you speak
- **100% local capable** — your conversation data never has to leave your machine

Speech becomes graph. Graph becomes diagram. Diagram becomes action. That's Voxtral Flow."

---

## Tips for Maximum Visual Impact

| Tip | Why |
|-----|-----|
| **Use a dark-themed display / projector** | The neon graph glow effects pop on dark backgrounds |
| **Make the browser window full-width** | The 60/40 split between Concept Graph and Mermaid is designed for widescreen |
| **Run Simulate with Visualize ON** | The graph building in real-time is the most impressive moment |
| **Let the simulation run fully before talking over it** | The kanban population at the end is a strong "aha!" moment |
| **Have 2 browser tabs for multi-user demo** | Join as Alice (EN→EO) and Bob (ES→EN) to show cross-language translation |
| **Use Esperanto as a target language** | It's exotic enough to impress and the heuristic translator handles it well offline |

---

## Quick Setup Checklist

```bash
# 1. Database running
cd ops && docker compose up -d && cd ..

# 2. Deps installed & DB migrated
pnpm install
pnpm db:generate && pnpm db:migrate -- --name init && pnpm db:seed
pnpm --filter @party-babel/shared build

# 3. Run
pnpm dev
# Open http://localhost:5173
```

For cloud mode (best for hackathon demos):
```bash
echo "MISTRAL_API_KEY=your-key-here" >> .env
pnpm dev
```
