# DocNexus AI — Physician Intelligence Platform

An LLM-powered multi-agent orchestration system that accepts natural language queries about NSCLC physician data and returns real downloadable artifacts — PowerPoint decks, Excel workbooks, written reports, and executed code analysis with charts — without any manual steps.

Built for the DocNexus Engineering Internship Take-Home Assignment.

---

## Live Demo

> **Loom walkthrough:** *(link to be added before submission)*

---

## Architecture

### System Overview

```
Browser (React + Vite)
        │
        │  POST /query  (query + preferences JSON)
        ▼
FastAPI Backend  ──────────────────────────────────────────────
        │
        │  SSE stream (Server-Sent Events)
        ▼
Orchestrator Agent  [Gemini + custom tool_use loop]
        │
        ├── tool: get_physician_data(specialty, state, icd10_codes, volume_threshold)
        │         └── Pure Python filter over physicians.json (no LLM)
        │             Returns {"physicians": [...35 records...]}
        │
        ├── tool: call_ppt_agent(topic, physician_list, icd10_codes, slide_count)
        │         └── Gemini generates slide JSON → python-pptx builds 4-slide .pptx
        │
        ├── tool: call_excel_agent(analysis_type, physician_list, icd10_codes)
        │         └── openpyxl builds 3-sheet workbook (raw, pivot, ICD-10 breakdown)
        │
        ├── tool: call_report_agent(report_type, physician_list, sections, icd10_context)
        │         └── Gemini writes multi-section markdown → python-docx exports .docx
        │
        └── tool: call_sandbox_agent(code_goal, dataset, chart_type)
                  └── Gemini writes Python code → E2B executes in cloud sandbox
                      → returns stdout + base64 PNG chart
        │
        ▼
SSE stream emits events as they happen:
  { type: "orchestrator_thinking" }
  { type: "tool_called",  tool: "get_physician_data", args: {...} }
  { type: "tool_done",    tool: "get_physician_data", count: 12 }
  { type: "tool_called",  tool: "call_ppt_agent",     args: {...} }
  { type: "tool_done",    tool: "call_ppt_agent",     artifact_id: "uuid" }
  { type: "done",         text: "I generated a deck for 12 physicians..." }
        │
        ▼
React UI renders in real time:
  AgentTrace  →  timeline of every tool call with status badges
  ResultsPanel →  download buttons, inline chart, code block, markdown report
```

### Agent Routing Logic

The Orchestrator reads the user's query and preferences, then calls Gemini with five `FunctionDeclaration` tools. Gemini decides which tools to invoke based on the query text:

| Query contains | Agent called |
|---|---|
| "PowerPoint", "slide deck", "presentation" | `call_ppt_agent` |
| "Excel", "spreadsheet", "breakdown table" | `call_excel_agent` |
| "report", "write-up", "market access" | `call_report_agent` |
| "analysis", "chart", "plot", "compute" | `call_sandbox_agent` |
| Multiple artifact types requested | Multiple agents (sequential) |

`get_physician_data` is **always called first** — this is enforced both in the tool description text and in the orchestrator system prompt.

### Key Design Decisions

- **Custom agentic loop** — no LangChain or abstractions. The loop lives in ~80 lines of `orchestrator.py` and is fully transparent.
- **`asyncio.to_thread`** — all blocking Gemini gRPC calls run in a thread pool, keeping the FastAPI event loop free to stream SSE events in real time.
- **Retry with backoff** — the orchestrator automatically retries on 429 rate-limit errors with the suggested retry delay from the API response.
- **Robust JSON parsing** — all Gemini responses are parsed with `json.JSONDecoder().raw_decode()` starting from the first `{` or `[`, tolerating any prose the model prepends.

---

## Tech Stack

| Layer | Technology |
|---|---|
| LLM provider | Google Gemini (`gemini-2.5-flash` or `gemini-flash-lite-latest`) |
| LLM SDK | `google-generativeai` 0.8.3 (native function calling) |
| Agent framework | **Custom loop** — no LangChain |
| Backend | FastAPI + uvicorn (Python 3.13) |
| Frontend | React 18 + Vite 5 |
| PPT generation | `python-pptx` |
| Excel generation | `openpyxl` |
| Word export | `python-docx` |
| Sandbox execution | E2B Code Interpreter (`e2b-code-interpreter`) |
| Live trace | SSE via FastAPI `StreamingResponse` + browser `fetch` ReadableStream |
| Mock data | 35-record `physicians.json` loaded in-memory at startup |

---

## Setup Instructions

### Prerequisites

- Python 3.10+
- Node.js 18+
- A Google AI Studio API key — [aistudio.google.com](https://aistudio.google.com) (free)
- An E2B API key — [e2b.dev](https://e2b.dev) (free tier)

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/DocNexus-Assignment.git
cd DocNexus-Assignment
```

### 2. Backend setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create your .env file
cp ../.env.example .env
```

Edit `backend/.env` and fill in your keys:

```env
GOOGLE_API_KEY=your_key_from_aistudio_google_com
E2B_API_KEY=your_key_from_e2b_dev
GEMINI_MODEL=gemini-2.5-flash
```

> **Model note:** `gemini-2.5-flash` is preferred. If you hit quota errors (`limit: 0`), switch to `gemini-flash-lite-latest` — both support native function calling.

Start the backend:

```bash
uvicorn main:app --port 8000 --reload
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Vite starts on `http://localhost:5173` (or 5174 if that port is taken). The proxy in `vite.config.js` forwards all API calls to the backend automatically.

### 4. Verify the setup

```bash
# Health check
curl http://localhost:8000/health
# → {"status":"ok"}

# Physician data endpoint
curl "http://localhost:8000/physicians?state=CA&volume_threshold=high"
# → {"physicians": [...4 records...]}
```

Open `http://localhost:5173` in your browser and run one of the sample queries.

### Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_API_KEY` | ✅ | Google AI Studio API key |
| `E2B_API_KEY` | ✅ | E2B sandbox API key |
| `GEMINI_MODEL` | Optional | Gemini model name (default: `gemini-2.0-flash`) |

---

## Sample Queries

These five queries cover all agent routing paths and are the recommended test suite:

```
1. "Give me a PowerPoint slide summarizing top oncologists in California treating NSCLC"
   → get_physician_data → call_ppt_agent

2. "Build an Excel breakdown of C341 claim volume by physician specialty and state"
   → get_physician_data → call_excel_agent

3. "Write a two-page market access report on NSCLC physician density in the Northeast"
   → get_physician_data → call_report_agent

4. "Run an analysis and show me which states have the highest concentration of high-volume NSCLC prescribers"
   → get_physician_data → call_sandbox_agent

5. "Give me a slide deck and an Excel breakdown of high-volume NSCLC oncologists in California and New York"
   → get_physician_data → call_ppt_agent + call_excel_agent  (multi-agent)
```

---

## Why No LangChain?

LangChain and similar frameworks add abstraction layers between the code and the LLM. For this assignment — where the orchestration logic is the core deliverable — that's a liability:

- **Transparency**: Every tool dispatch, every message in the conversation history, every retry decision is visible in `orchestrator.py`. There is no magic.
- **Debuggability**: When Gemini returns an unexpected response format, you can see exactly what it returned and fix the parsing. With a framework, you'd be debugging the framework's internals.
- **Gemini native function calling**: `google-generativeai`'s `FunctionDeclaration` → `generate_content` → `function_call` loop is clean enough that an abstraction layer adds nothing.

The custom loop is ~80 lines of code. It handles tool dispatch, conversation history management, streaming, retry logic, and graceful error degradation. That is the entire orchestrator.

---

## What I Would Build Next

### 1. Real Physician Data API Integration
Replace `physicians.json` with live calls to the **CMS Open Payments API** and **NPI Registry**. Both are public APIs. This would give real prescriber data, real claim volumes, and the ability to query any specialty/geography — not just the 35 mock records. The `get_physician_data` tool interface would stay identical; only the data layer changes.

### 2. Parallel Agent Execution
When a query requests both a PPT and an Excel file, both agents currently run sequentially. With `asyncio.gather`, they could run in parallel, cutting end-to-end latency roughly in half for multi-artifact queries. The orchestrator loop would need to batch tool calls from the same Gemini turn rather than dispatching one at a time.

### 3. Session Persistence and Conversation Memory
Currently every query starts fresh. A follow-up like *"now filter that to only California"* has no context from the previous turn. Adding a session ID (stored in Redis or a simple SQLite table) with the last N turns of conversation history would enable multi-turn workflows — a key requirement for real field rep use cases.

### 4. Streaming Token Output for Reports
The report agent currently streams a single SSE event containing the full markdown when Gemini finishes. Using Gemini's `stream=True` parameter would let the report appear word-by-word in the UI, which is much more responsive for long reports. This requires restructuring the SSE event schema to include a `token` type alongside `tool_called`/`tool_done`.

### 5. Retrieval-Augmented Generation (RAG)
Ground report content in external evidence by indexing medical literature (PubMed abstracts, NCCN guidelines, payer coverage policies) into a vector store such as ChromaDB or Pinecone. Before the report agent writes a section, a retrieval step would fetch the most relevant passages and inject them into the prompt. This would shift reports from generic LLM summaries to evidence-backed documents with citations — a significant quality improvement for Medical Affairs use cases where accuracy and traceability are non-negotiable.

### 6. Specialized Domain Agents
Replace the single `call_report_agent` with three purpose-built agents tuned to distinct pharma functions:
- **Market Access Agent** — focuses on payer landscape, formulary positioning, and reimbursement barriers relevant to the queried territory
- **Medical Affairs Agent** — structures output around KOL engagement priorities, publication gaps, and clinical trial site identification
- **Commercial Strategy Agent** — generates territory segmentation, targeting tiers, and call plan recommendations based on claim volume and prescriber potential

Each agent would have its own system prompt, its own output schema, and would be routed to by distinct query keywords, giving field teams role-specific intelligence from a single natural language query.

---

## Known Limitations

### Data
- **Mock data only**: 35 synthetic physician records. Specialties, affiliations, and ICD-10 claim volumes are realistic in shape but not sourced from real claims data.
- **No pagination**: `get_physician_data` returns all matching records in one response. With a real dataset of thousands of physicians, this would need server-side pagination.

### LLM / API
- **Gemini free tier rate limits**: `gemini-2.5-flash` has a per-minute and per-day request quota. Running all 5 test queries back-to-back will hit the rate limit. The orchestrator includes automatic retry with backoff, but consecutive queries in a test suite need ~60s gaps.
- **Non-deterministic routing**: Gemini occasionally misroutes ambiguous queries (e.g., calling both `call_report_agent` and `call_sandbox_agent` for a pure report request). The tool descriptions and orchestrator system prompt are tuned to minimize this, but it is not 100% deterministic.

### Infrastructure
- **Artifacts lost on restart**: Generated `.pptx`, `.xlsx`, and `.docx` files are stored in `backend/artifacts/` on disk. They are not persisted to a database and will not be listed or accessible after a server restart (the file will exist but there's no registry of generated artifact IDs).
- **No authentication**: The API has no auth layer. Anyone with network access to port 8000 can call `/query` and generate artifacts. Not suitable for production deployment as-is.
- **Single-user**: The SSE stream is stateless and the server has no concept of users or sessions. Concurrent queries from different users will work but share the same artifact directory.

### Sandbox
- **E2B cold start**: The first E2B sandbox execution per session takes 3–5 seconds to spin up. Subsequent executions in the same process reuse the session and are faster.
- **Sandbox library availability**: The Gemini-generated code is instructed to use only `pandas` and `matplotlib`. If the model generates an import for an unavailable library (e.g., `seaborn`), the self-correction loop will catch the `ModuleNotFoundError` and regenerate the code — but this adds one extra Gemini API call and one extra E2B execution.

---

## Project Structure

```
DocNexus-Assignment/
├── backend/
│   ├── main.py                  FastAPI app, all 3 endpoints
│   ├── requirements.txt
│   ├── agents/
│   │   ├── orchestrator.py      Gemini tool_use agentic loop
│   │   ├── ppt_agent.py         Gemini JSON → python-pptx
│   │   ├── excel_agent.py       openpyxl 3-sheet workbook
│   │   ├── report_agent.py      Gemini markdown + python-docx
│   │   └── sandbox_agent.py     Gemini code-gen → E2B execution
│   ├── tools/
│   │   ├── tool_definitions.py  All 5 Gemini FunctionDeclarations
│   │   └── physician_data.py    Pure Python filter over physicians.json
│   ├── prompts/
│   │   ├── orchestrator.txt     Routing rules + output format
│   │   ├── ppt_agent.txt        JSON output schema
│   │   ├── report_agent.txt     Writing guidelines
│   │   └── sandbox_agent.txt    Code generation constraints
│   └── data/
│       └── physicians.json      35 mock physician records
└── frontend/
    └── src/
        ├── App.jsx              SSE stream consumer + state
        └── components/
            ├── QueryInput.jsx   Textarea, Analyze button, sample queries
            ├── PreferencePanel.jsx  ICD-10, state, volume filters
            ├── AgentTrace.jsx   Live timeline of tool calls
            └── ResultsPanel.jsx Downloads, chart, code, markdown
```
