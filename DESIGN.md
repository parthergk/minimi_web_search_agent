# Minimi Web Search Agent — Architecture & Design

Minimi is a conversational AI agent designed for high accuracy on temporal, factual, and change-detection queries. It adheres to a strict single-tool constraint (`web_search`) and couples it with a high-performance bitemporal memory pipeline.

---

## 1. How It Works

```
User Query
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 1. Pre-Flight Memory Router (Fastify Pipeline)           │
│   • Fetches 4 most recent turns from Postgres timeline   │
│   • Resolves relative dates & entities via gpt-4o-mini   │
│   • Executes Date B-Tree lookup + Postgres GIN FTS       │
│   • Deduplicates & injects [Date: YYYY-MM-DD] snapshots  │
└───────────────────────────┬─────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Core Agent Execution (OpenAI gpt-4o-mini)             │
│   • Single Tool Constraint: ONLY web_search is exposed  │
│   • Parallel Tool Execution: Promise.all for multi-items│
│   • Compares live Tavily facts against memory snapshots │
└───────────────────────────┬─────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Non-Blocking Write Path                              │
│   • Persists { date, userQuestion, agentAnswer } to DB  │
│   • Dispatches HTTP response immediately to user        │
│   • Background async job tags entities & topics in DB   │
└─────────────────────────────────────────────────────────┘
```

1. **Pre-Flight Memory Router (`getMemoryContext`):** Before invoking the primary LLM, the backend fetches the 4 most recent turns and calls a lightweight routing prompt (`gpt-4o-mini`, `temperature: 0`, `json_object`) with today’s reference date and day of week. It extracts intent, resolves relative dates (e.g., *"on Monday"*, *"last Tuesday"*, *"3 November"*), and extracts entity keywords.
2. **Dual Database Retrieval:** 
   - **Exact Date:** Hits a Postgres B-Tree index on `messages.date` (`YYYY-MM-DD`).
   - **Entity/Topic Full-Text Search:** Uses a Postgres GIN index on `to_tsvector('english', user_question || ' ' || agent_answer || ' ' || topics) @@ to_tsquery(...)` if no date was specified or if no records matched.
   - Snapshots are injected into the agent system prompt labeled with `[Date: YYYY-MM-DD]`, mandating `web_search` verification whenever change or validity is queried.
3. **Parallel Tool Execution:** When the agent needs to verify multiple items (e.g., 5 CRM tools at once), tool calls are resolved concurrently via `Promise.all(toolCalls.map(...))`, reducing search latency from $5 \times$ to $1 \times$ Tavily roundtrip time.
4. **Non-Blocking Write Path (`saveTurn`):** The conversation turn is inserted immediately into Postgres. The HTTP reply is returned to the user without waiting for topic tagging. A background `setImmediate` task asynchronously extracts topics and updates the row.

---

## 2. Why We Built It This Way

- **Deterministic Pre-Retrieval vs. Memory-as-a-Tool:** Exposing memory retrieval as a tool to the main LLM causes multi-round tool thrashing, hallucinations, and doubled latency. Handling retrieval deterministically in the pipeline guarantees past context is always present without wasting agent turns.
- **Bitemporal Hybrid Indexing vs. Pure Vector Search:** Vector embeddings struggle with temporal boundaries (e.g., differentiating *"Monday"* from *"last Tuesday"*). B-Tree date indexing gives $O(\log N)$ instantaneous exact-date lookups, while Postgres GIN full-text search captures entities without embedding model network hops.
- **Strict Single Tool Compliance:** The agent's schema only exposes `web_search`. Memory retrieval is strictly a backend infrastructure concern.
- **Zero-Friction Startup:** Schema initialization and index creation run automatically on Fastify startup (`initDb()`), eliminating migration friction for evaluators running `npm install` and `npm run dev`.

---

## 3. What We Considered and Rejected

- **Vector / Embedding RAG for Timeline Recall:** Rejected. Vector similarity is blind to chronological constraints and calendar math. It also adds 200–400ms embedding generation latency to both the read and write paths.
- **Agentic Multi-Step Memory Queries:** Rejected. Letting the LLM decide when and how to search memory often resulted in skipped lookups or malformed search queries.
- **Complex Multi-Table Auth / Thread Schemes:** Rejected. For an evaluation benchmark, multi-tenant tables and thread abstractions introduce unnecessary overhead. A unified timeline table indexed on `date`, `created_at`, and GIN FTS provides superior speed and simpler verification.
- **Synchronous Topic Tagging on Write:** Rejected. Running LLM entity extraction before responding to the user adds 500–800ms of unnecessary latency. Moving it to a non-blocking background queue keeps API response times minimal.

---

## 4. What We’d Do With Another Week

1. **Streaming UI with Real-Time Tool Call Indicators:** Implement Server-Sent Events (SSE) from Fastify to Next.js so the user sees live search query pills and incremental tokens as they stream.
2. **Semantic Diff Engine:** Add a dedicated diffing module that parses retrieved web content and structured historical snapshots, producing side-by-side comparison tables (e.g., Previous Price vs. Current Price).
3. **Query Deduplication & Caching:** Implement an in-memory TTL cache for Tavily search results to prevent duplicate outbound web queries during consecutive conversational turns.
4. **Hybrid Lexical-Semantic Fusion (RRF):** For scaling to thousands of conversation turns per user, combine Postgres GIN FTS with pgvector embeddings using Reciprocal Rank Fusion (RRF).
