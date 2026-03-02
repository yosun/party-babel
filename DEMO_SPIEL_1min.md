# Voxtral Flow — 1-Minute Hackathon Demo

> **Solo presenter. Click Simulate, read the acts live. The app visualizes itself as you speak.**
>
> **Setup:** Join room `demo`, name `You`, speak `en`, translate `eo`. Toggle **Visualize**, then click **Simulate**.

---

## Intro — What & Why (~0s, before clicking Simulate)

> "This is Voxtral Flow — it streams speech into structured intelligence. You talk, and it builds a live knowledge graph, architecture diagram, and action board from what you say — all in real time.
>
> The entire pipeline runs on Mistral. Voxtral handles speech-to-text for 11 languages in a single model — no per-language swapping. Mistral chat powers translation, entity extraction, and diagram generation in single-shot calls.
>
> And here's the key: it runs 100% offline. No cloud, no data leaving your machine. Set one env var and it switches to the Mistral API — same app, zero code changes. Let me show you."

**DO:** Click **Simulate**.

---

## Act 1 — The Pipeline Builds Itself (~5s)

> "The Browser captures audio from the Microphone and sends it to our React frontend. React opens a persistent WebSocket connection to the Server."

**Visualization cues:** Nodes appear: Browser, Microphone, React, WebSocket, Server. Edges: `captures`, `connects_to`.

---

## Act 2 — Speech Pipeline (~15s)

> "The Server feeds audio to Voxtral, our speech-to-text engine. Voxtral calls the Mistral model for transcription. Each transcript feeds into the TranslationEngine."

**Visualization cues:** Voxtral, Mistral, TranslationEngine join the graph. Architecture subgroups start clustering — Services vs Intelligence.

---

## Act 3 — Translation + Caching (~25s)

> "TranslationEngine uses Mistral for neural machine translation. TranslationEngine connects to Redis for caching repeated phrases."

**Visualization cues:** Redis appears in the Data Layer cluster. Translation edges link across subgroups.

---

## Act 4 — Intelligence (~35s)

> "ConceptExtractor analyzes every utterance. ConceptExtractor feeds entities and relations into the KnowledgeGraph. KnowledgeGraph feeds MermaidGenerator to produce live diagrams."

**Visualization cues:** Intelligence subgraph fills out — ConceptExtractor, KnowledgeGraph, MermaidGenerator form a chain. The Mermaid diagram now shows a rich architecture flowchart with labeled subgroups.

---

## Act 5 — Persistence (~45s)

> "Server uses Prisma as the ORM. Prisma depends on Postgres for storing transcripts and world state."

**Visualization cues:** Prisma, Postgres appear in Data Layer. Dependency edges complete the persistence chain.

---

## Act 6 — Tasks (~55s)

> "First write integration tests for WebSocket. Next build the audio preprocessing pipeline. Later add end-to-end encryption."

**Visualization cues:** Kanban board populates — "Now" gets integration tests, "Next" gets audio pipeline, "Later" gets encryption. Each card links back to this utterance.

---

What you just saw is

Voxtral Flow: Realtime Speech to Universal Visual Language

---

## Why Mistral — cheat sheet for judges

| Capability | How Voxtral Flow uses it |
|---|---|
| **Voxtral** (speech-to-text) | Single model handles 11 languages — no per-language model swapping |
| **Mistral chat** (translation) | Neural MT via chat completion — one API for all language pairs |
| **Mistral chat** (extraction) | Single-shot entity/relation/task/diagram-type extraction from natural speech |
| **Deploy flexibility** | `MISTRAL_API_KEY` → cloud. Remove it → runs 100% local on Apple Silicon via HuggingFace Transformers, or GPU via vLLM |
| **Esperanto support** | Voxtral is one of the few models that handles Esperanto natively |

---

## After the simulation ends

- Point to the **Concept Graph** — neon D3 force graph built from speech
- Point to the **Mermaid Diagram** — auto-clustered architecture with subgroups (Frontend, Services, Intelligence, Data Layer)
- Point to the **Kanban Board** — Now / Next / Later extracted from "First... Next... Later..." in natural speech
- Click **Export → Markdown** — full transcript + diagram + action items as one portable doc

---

## Autocorrect for live mic demos

The server auto-fixes common STT misspellings — "box trail" → "Voxtral", "mist trail" → "Mistral", etc. — so you can speak naturally and the transcript shows the correct terms.

To add your own corrections, set the env var before starting:

```bash
AUTOCORRECT_EXTRA="box trail=Voxtral,miss trail=Mistral" pnpm dev
```

Format: comma-separated `wrong=right` pairs. Case-insensitive matching.
