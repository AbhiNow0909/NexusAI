# CLAUDE.md — DocNexus AI Orchestration System

This file provides Claude Code with full context on the DocNexus internship assignment:
architecture decisions, tech stack, folder structure, coding conventions, and current
build progress. Read this before touching any file.

---

## Project Overview

DocNexus is a pharma/life-sciences intelligence platform. This assignment builds an
LLM-powered multi-agent orchestration system that accepts a natural language query,
routes it to specialized agents, and returns real downloadable artifacts (PowerPoint,
Excel, written reports, executed code analysis) — no manual steps.

**Deadline: Sunday May 31, 2026 — 11:59 PM PST**
**Submission: GitHub repo (public) + Loom video demo (7–12 min)**

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| LLM provider | Google Gemini via AI Studio | `gemini-2.0-flash` model; free tier sufficient |
| LLM SDK | `google-generativeai` (Python) | Native function calling / tool_use |
| Agent framework | Custom loop (no LangChain) | Explicit, reviewable, easy to explain in interview |
| Backend | FastAPI (Python) | Async, streaming support, file serving |
| Frontend | React + Vite | Minimal, SPA, no SSR needed |
| PPT generation | `python-pptx` | Server-side only, real .pptx files |
| Excel generation | `openpyxl` | Server-side only, real .xlsx files |
| Word report | `python-docx` | Optional .docx export for Report Agent |
| Sandbox execution | E2B SDK (`e2b`) | Cloud sandbox, free tier, handles security |
| Live agent trace | SSE (Server-Sent Events) | FastAPI `StreamingResponse`, React `EventSource` |
| Mock data | JSON file (in-memory) | 30+ physician records, loaded at startup |
| Package manager | pip + npm | Python backend, Node frontend |

---

## Repository Structure

```
DocNexus-Assignment/
├── CLAUDE.md                    ← this file
├── .env.example                 ← all required env vars (no secrets)
├── README.md                    ← architecture, setup, justifications
│
├── backend/
│   ├── main.py                  ← FastAPI app entry point, all routes
│   ├── requirements.txt
│   ├── .env                     ← GOOGLE_API_KEY, E2B_API_KEY (gitignored)
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── orchestrator.py      ← custom Gemini tool_use loop
│   │   ├── ppt_agent.py         ← python-pptx file generation
│   │   ├── excel_agent.py       ← openpyxl file generation
│   │   ├── sandbox_agent.py     ← E2B code execution + self-correction
│   │   └── report_agent.py      ← markdown + optional .docx generation
│   │
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── tool_definitions.py  ← Gemini function declarations (all 5 tools)
│   │   └── physician_data.py    ← get_physician_data() filtering logic
│   │
│   ├── prompts/
│   │   ├── orchestrator.txt     ← Orchestrator system prompt
│   │   ├── ppt_agent.txt        ← PPT Agent system prompt
│   │   ├── excel_agent.txt      ← Excel Agent system prompt
│   │   ├── sandbox_agent.txt    ← Sandbox Agent system prompt
│   │   └── report_agent.txt     ← Report Agent system prompt
│   │
│   ├── data/
│   │   └── physicians.json      ← 30+ mock physician records
│   │
│   └── artifacts/               ← generated .pptx / .xlsx / .docx files
│                                   (gitignored, created at runtime)
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        └── components/
            ├── QueryInput.jsx       ← text area + preference panel
            ├── PreferencePanel.jsx  ← ICD-10 codes, states, volume tier
            ├── AgentTrace.jsx       ← live SSE trace display
            └── ResultsPanel.jsx     ← report markdown + download buttons + chart
```

---

## Environment Variables

```bash
# backend/.env (never commit)
GOOGLE_API_KEY=your_key_from_aistudio_google_com
E2B_API_KEY=your_key_from_e2b_dev

# .env.example (commit this)
GOOGLE_API_KEY=
E2B_API_KEY=
```

---

## Architecture: How the System Works

```
User query + preferences
        │
        ▼
POST /query  (FastAPI)
        │  ← SSE stream opens immediately
        ▼
Orchestrator Agent  (Gemini + custom tool_use loop)
        │
        ├── tool call: get_physician_data(specialty, state, icd10_codes, volume_threshold)
        │       └── pure Python filter on physicians.json — no LLM call
        │
        ├── tool call: call_ppt_agent(topic, physician_list, icd10_codes, slide_count)
        │       └── PPT Agent → Gemini generates slide content as JSON → python-pptx builds file
        │
        ├── tool call: call_excel_agent(analysis_type, physician_list, dimensions, icd10_codes)
        │       └── Excel Agent → openpyxl builds 3-sheet workbook
        │
        ├── tool call: call_sandbox_agent(code_goal, dataset, chart_type)
        │       └── Sandbox Agent → Gemini writes Python code → E2B executes → returns stdout + PNG
        │
        └── tool call: call_report_agent(report_type, sections, physician_list, icd10_context)
                └── Report Agent → Gemini generates markdown sections
        │
        ▼
Orchestrator collects all outputs, writes final summary
        │
        ▼
SSE stream emits: trace steps + artifact file IDs + report markdown
        │
        ▼
React UI renders: live trace → report → download buttons → chart image
```

---

## The Orchestrator Agent (Most Important File)

**File:** `backend/agents/orchestrator.py`

The Orchestrator is a custom agentic loop using the Gemini SDK's native function calling.
It does NOT use LangChain or any abstraction framework.

### Loop Logic

```python
import google.generativeai as genai
from tools.tool_definitions import TOOL_DECLARATIONS
from tools.physician_data import get_physician_data
from agents.ppt_agent import run_ppt_agent
from agents.excel_agent import run_excel_agent
from agents.sandbox_agent import run_sandbox_agent
from agents.report_agent import run_report_agent

# Tool dispatch map — maps tool names to actual Python functions
TOOL_HANDLERS = {
    "get_physician_data": get_physician_data,
    "call_ppt_agent": run_ppt_agent,
    "call_excel_agent": run_excel_agent,
    "call_sandbox_agent": run_sandbox_agent,
    "call_report_agent": run_report_agent,
}

async def run_orchestrator(query: str, preferences: dict, sse_queue: asyncio.Queue):
    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=load_prompt("orchestrator"),
        tools=TOOL_DECLARATIONS,
    )
    messages = [{"role": "user", "parts": [build_user_message(query, preferences)]}]

    while True:
        response = model.generate_content(messages)
        candidate = response.candidates[0]

        # Check for tool calls
        tool_calls = [p for p in candidate.content.parts if hasattr(p, "function_call")]

        if not tool_calls:
            # No more tool calls — final text response
            await sse_queue.put({"type": "done", "text": candidate.content.parts[0].text})
            break

        # Dispatch each tool call
        tool_results = []
        for tc in tool_calls:
            tool_name = tc.function_call.name
            tool_args = dict(tc.function_call.args)

            await sse_queue.put({"type": "tool_called", "tool": tool_name, "args": tool_args})

            result = await TOOL_HANDLERS[tool_name](**tool_args)
            tool_results.append({"name": tool_name, "result": result})

            await sse_queue.put({"type": "tool_done", "tool": tool_name, "result_summary": summarize(result)})

        # Feed results back into conversation
        messages.append({"role": "model", "parts": candidate.content.parts})
        messages.append({"role": "user", "parts": [
            genai.protos.Part(function_response=genai.protos.FunctionResponse(
                name=r["name"], response={"result": r["result"]}
            )) for r in tool_results
        ]})
```

### Key Constraint

`get_physician_data` is a pure Python function — it filters `physicians.json` in memory
and returns a list of matching physician dicts. It does NOT call the LLM.

---

## Tool Definitions

**File:** `backend/tools/tool_definitions.py`

All 5 tools must be declared as Gemini `FunctionDeclaration` objects. Tool descriptions
must be precise — Gemini routes based on the description text.

```python
import google.generativeai as genai

TOOL_DECLARATIONS = [
    genai.protos.Tool(function_declarations=[
        genai.protos.FunctionDeclaration(
            name="get_physician_data",
            description=(
                "Retrieves filtered physician records from the mock database. "
                "Always call this FIRST before any agent tool to obtain the physician list. "
                "Returns a list of physician objects matching the filters."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "specialty": genai.protos.Schema(type=genai.protos.Type.STRING),
                    "state": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING)
                    ),
                    "icd10_codes": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING)
                    ),
                    "volume_threshold": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        enum=["low", "high", "very_high"]
                    ),
                },
            ),
        ),
        genai.protos.FunctionDeclaration(
            name="call_ppt_agent",
            description=(
                "Generates a real .pptx PowerPoint slide deck. "
                "Call this ONLY when the user explicitly asks for a presentation, "
                "slide deck, or PowerPoint. Do NOT call for reports or spreadsheets."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                required=["topic", "physician_list"],
                properties={
                    "topic": genai.protos.Schema(type=genai.protos.Type.STRING),
                    "physician_list": genai.protos.Schema(type=genai.protos.Type.STRING),  # JSON string
                    "icd10_codes": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING)
                    ),
                    "slide_count": genai.protos.Schema(type=genai.protos.Type.INTEGER),
                    "style_notes": genai.protos.Schema(type=genai.protos.Type.STRING),
                },
            ),
        ),
        genai.protos.FunctionDeclaration(
            name="call_excel_agent",
            description=(
                "Generates a real .xlsx Excel workbook with multiple sheets. "
                "Call this when the user asks for a spreadsheet, Excel file, "
                "breakdown table, or data export. Do NOT call for slide decks or reports."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                required=["analysis_type", "physician_list"],
                properties={
                    "analysis_type": genai.protos.Schema(type=genai.protos.Type.STRING),
                    "physician_list": genai.protos.Schema(type=genai.protos.Type.STRING),
                    "dimensions": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING)
                    ),
                    "icd10_codes": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING)
                    ),
                },
            ),
        ),
        genai.protos.FunctionDeclaration(
            name="call_sandbox_agent",
            description=(
                "Generates Python code and executes it in a secure cloud sandbox. "
                "Returns stdout text output and an optional chart image. "
                "Call this when the user asks for data analysis, charts, plots, "
                "or computation. Do NOT call for static files like PPT or Excel."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                required=["code_goal", "dataset"],
                properties={
                    "code_goal": genai.protos.Schema(type=genai.protos.Type.STRING),
                    "dataset": genai.protos.Schema(type=genai.protos.Type.STRING),  # JSON string
                    "chart_type": genai.protos.Schema(type=genai.protos.Type.STRING),
                },
            ),
        ),
        genai.protos.FunctionDeclaration(
            name="call_report_agent",
            description=(
                "Writes a structured multi-section written report in markdown. "
                "Call this when the user asks for a report, summary, analysis writeup, "
                "or written document. Do NOT call for slide decks or spreadsheets."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                required=["report_type", "physician_list"],
                properties={
                    "report_type": genai.protos.Schema(type=genai.protos.Type.STRING),
                    "sections": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING)
                    ),
                    "physician_list": genai.protos.Schema(type=genai.protos.Type.STRING),
                    "icd10_context": genai.protos.Schema(type=genai.protos.Type.STRING),
                    "geographic_scope": genai.protos.Schema(type=genai.protos.Type.STRING),
                },
            ),
        ),
    ])
]
```

---

## Mock Data Schema

**File:** `backend/data/physicians.json`

Must contain at least 30 records. Each record:

```json
{
  "id": "phy_001",
  "npi": "1234567890",
  "firstName": "Aisha",
  "lastName": "Patel",
  "specialty": "Medical Oncology",
  "affiliation": "UCSF Medical Center",
  "city": "San Francisco",
  "state": "CA",
  "icd10ClaimVolume": { "C341": 87, "C342": 12, "C349": 5 },
  "totalNSCLCClaims": 104,
  "volumeTier": "high",
  "email": "a.patel@ucsf.edu",
  "boardCertified": true
}
```

Records must span: specialties (Medical Oncology, Thoracic Surgery, Pulmonology,
Radiation Oncology, Hematology/Oncology), states (CA, NY, TX, FL, MA, IL, WA, PA),
volume tiers (low, high, very_high), and ICD-10 codes (C341, C342, C343, C349, C3410).

---

## FastAPI Endpoints

**File:** `backend/main.py`

### POST /query

Accepts user query + preferences. Opens SSE stream. Runs full agent pipeline.

```python
@app.post("/query")
async def run_query(request: QueryRequest):
    queue = asyncio.Queue()

    async def event_generator():
        asyncio.create_task(run_orchestrator(request.query, request.preferences, queue))
        while True:
            event = await queue.get()
            yield f"data: {json.dumps(event)}\n\n"
            if event["type"] == "done":
                break

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

### GET /physicians

Returns filtered physician list. Query params: `specialty`, `state`, `icd10_codes`,
`volume_threshold`. Used by the frontend preference panel for previewing data.

### GET /artifacts/{artifact_id}

Serves generated files for download. Returns correct MIME type:
- `.pptx` → `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- `.xlsx` → `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `.docx` → `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

---

## SSE Event Schema

The frontend subscribes to the SSE stream and renders each event as it arrives.
All events are JSON objects with a `type` field.

```json
{ "type": "orchestrator_thinking", "message": "Parsing intent..." }
{ "type": "tool_called", "tool": "get_physician_data", "args": { "state": ["CA", "NY"] } }
{ "type": "tool_done",  "tool": "get_physician_data", "message": "Found 12 physicians" }
{ "type": "tool_called", "tool": "call_ppt_agent", "args": { "topic": "...", "slide_count": 4 } }
{ "type": "tool_done",  "tool": "call_ppt_agent", "artifact_id": "uuid-here", "filename": "deck.pptx" }
{ "type": "tool_called", "tool": "call_report_agent", "args": { ... } }
{ "type": "tool_done",  "tool": "call_report_agent", "markdown": "## Executive Summary\n..." }
{ "type": "tool_called", "tool": "call_sandbox_agent", "args": { ... } }
{ "type": "tool_done",  "tool": "call_sandbox_agent", "stdout": "...", "chart_b64": "base64png..." }
{ "type": "done", "text": "I generated a slide deck and Excel breakdown for 12 physicians..." }
```

---

## Agent Implementation Notes

### PPT Agent (`agents/ppt_agent.py`)

1. Call Gemini to generate slide content as a structured JSON object:
   ```json
   {
     "title": "High-Volume NSCLC Oncologists — C341 & C342 | CA & NY",
     "subtitle": "DocNexus Intelligence Report",
     "overview": { "total_physicians": 12, "top_specialties": [...], "top_states": [...] },
     "key_insights": ["Insight 1", "Insight 2", "Insight 3"],
     "top_physicians": [ { "name": "...", "affiliation": "...", "claims": 99 }, ... ]
   }
   ```
2. Use `python-pptx` to build 4 slides from that JSON.
3. Save to `backend/artifacts/{uuid}.pptx`.
4. Return `{ "artifact_id": uuid, "filename": "deck.pptx" }`.

**Slide structure (required):**
- Slide 1: Title slide — query summary + ICD-10 scope
- Slide 2: Physician population overview — count, top specialties, top states
- Slide 3: Key insights — 3–5 LLM-generated bullets
- Slide 4: Data table — top 10 physicians

### Excel Agent (`agents/excel_agent.py`)

1. No LLM call needed — pure data transformation.
2. Use `openpyxl` to build workbook with 3 sheets:
   - Sheet 1: Raw physician data table
   - Sheet 2: Pivot summary — claim volume by state × specialty (use `dict` aggregation)
   - Sheet 3: ICD-10 breakdown — physician count per selected code
3. Apply formatting: header row bold + blue fill, alternating row colors (#F2F2F2), auto column widths.
4. Save to `backend/artifacts/{uuid}.xlsx`. Return artifact_id.

### Sandbox Agent (`agents/sandbox_agent.py`)

```python
async def run_sandbox_agent(code_goal: str, dataset: str, chart_type: str = "bar"):
    # Step 1: Ask Gemini to write Python code
    code = await generate_code(code_goal, dataset, chart_type)

    # Step 2: Execute in E2B sandbox
    from e2b_code_interpreter import Sandbox
    sandbox = Sandbox()
    result = sandbox.run_code(code)

    # Step 3: Self-correct if execution fails
    if result.error:
        corrected_code = await fix_code(code, result.error)
        result = sandbox.run_code(corrected_code)

    # Step 4: Extract chart if generated
    chart_b64 = None
    for output in result.results:
        if output.png:
            chart_b64 = output.png  # already base64

    return {
        "code": corrected_code if result.error else code,
        "stdout": result.logs.stdout,
        "chart_b64": chart_b64,
    }
```

Gemini code generation prompt must include:
- The dataset as a JSON string embedded in the prompt
- Instruction to use only `pandas` and `matplotlib`
- Instruction to save chart as `plt.savefig('/tmp/chart.png')` — E2B captures it

### Report Agent (`agents/report_agent.py`)

1. Call Gemini with all 5 sections in a single structured prompt.
2. System prompt instructs it to reference user preferences explicitly in the text
   (e.g., "Filtered to ICD-10 codes C341 and C342, High Volume threshold, California").
3. Return the markdown string directly in the SSE event — no file needed for rendering.
4. Optionally save `.docx` using `python-docx` and return an artifact_id for download.

---

## System Prompt Guidelines

**Files:** `backend/prompts/*.txt`

Each prompt is stored as a plain text file and loaded with a helper:

```python
def load_prompt(name: str) -> str:
    path = Path(__file__).parent.parent / "prompts" / f"{name}.txt"
    return path.read_text()
```

### Orchestrator prompt structure

```
ROLE
You are the Orchestrator for the DocNexus physician intelligence system...

RESPONSIBILITIES
- Parse the user's intent to identify required artifact types
- Always call get_physician_data first to obtain filtered physician records
- Select the correct specialized agent(s) based on the artifact type requested
- Pass physician data and preferences to each agent as structured context
- If multiple artifacts are requested, call multiple agents (they can run sequentially)

ROUTING RULES
- "slide deck", "PowerPoint", "presentation" → call_ppt_agent
- "Excel", "spreadsheet", "breakdown table", "data export" → call_excel_agent
- "report", "write-up", "summary", "analysis document" → call_report_agent
- "chart", "plot", "run analysis", "show me which", "compute" → call_sandbox_agent
- Ambiguous queries requesting both data and visuals → call both excel + sandbox

OUTPUT FORMAT
After all tool calls complete, write a brief summary (2-3 sentences) confirming
what was generated and which artifacts are available for download.
```

### Agent prompt structure (all agents follow same pattern)

```
ROLE
You are the [PPT/Excel/Sandbox/Report] Agent for the DocNexus system.
You receive structured physician data and produce [specific output type].

INPUT
- physician_list: JSON array of physician objects
- icd10_codes: list of relevant ICD-10 codes
- [other agent-specific inputs]

OUTPUT FORMAT
Return a single valid JSON object with the following structure: [...]

RULES
- Reference the physician data concretely — use real names, specialties, states, claim counts
- Never invent data not present in the physician_list
- [agent-specific rules]
```

---

## Frontend Component Notes

### QueryInput.jsx

- Large `<textarea>` for free-form query
- "Analyze" submit button that calls `POST /query`
- On submit: opens `EventSource` to consume SSE stream

### PreferencePanel.jsx

- Multi-select for ICD-10 codes (default options: C341, C342, C343, C349, C3410)
- Multi-select for states (US state list)
- Radio for volume tier: All / High / Very High
- Sent as JSON in the POST /query body alongside the query string

### AgentTrace.jsx

- Subscribes to SSE stream events
- Renders each step as a timeline row: icon + label + status
- Steps: "Orchestrator parsing intent" → "Fetching physician data (12 found)"
  → "Generating PowerPoint..." → "Generating Excel..." → "Done"

### ResultsPanel.jsx

- Renders report markdown using `react-markdown`
- Shows download buttons for each artifact (links to `GET /artifacts/:id`)
- Renders sandbox chart image inline (base64 PNG from SSE event)

---

## Coding Conventions

- Python: type hints on all function signatures; async/await throughout the backend
- All LLM calls are async — use `await` and `asyncio.create_task` for parallel agent calls
- Prompts live in `.txt` files, never hardcoded as Python strings
- Artifact files are named `{uuid4}.{ext}` — never user-supplied filenames
- Errors from agents return a structured dict `{ "error": true, "message": "..." }`
  instead of raising exceptions — the Orchestrator handles graceful degradation
- No `eval()` or `exec()` in the backend — all code execution goes through E2B
- CORS: allow `http://localhost:5173` (Vite dev server) in FastAPI middleware

---

## Current Build Status

### ✅ Completed (in this planning session)
- Full architecture decided and documented
- Tech stack finalized
- Folder structure designed
- All tool definitions written out
- Agent implementation patterns defined
- SSE event schema defined
- System prompt structure documented

### ✅ Phase 1 — Scaffolding (start here)
- [ ] Create repo, folder structure, `.env.example`, `.gitignore`
- [ ] Generate `physicians.json` with 30+ records
- [ ] FastAPI skeleton: all 3 endpoints stubbed, CORS enabled, health check
- [ ] React + Vite scaffold: placeholder components, confirm backend connectivity

### 🔲 Phase 2 — Orchestrator
- [ ] Install `google-generativeai`, confirm API key works
- [ ] Write all 5 tool definitions in `tool_definitions.py`
- [ ] Implement custom Gemini agentic loop in `orchestrator.py`
- [ ] Write Orchestrator system prompt
- [ ] Implement SSE streaming from FastAPI + `EventSource` in React
- [ ] Test all 4 sample queries from the brief — verify correct tool routing

### 🔲 Phase 3 — PPT + Excel + Report Agents
- [ ] PPT Agent: hardcode → file downloads → wire LLM content generation
- [ ] Excel Agent: hardcode → file downloads → pivot logic
- [ ] Report Agent: Gemini generates all 5 sections as markdown
- [ ] Verify all files download with correct MIME types in the browser

### 🔲 Phase 4 — Sandbox Agent
- [ ] E2B account + SDK install, hello-world smoke test
- [ ] Gemini code generation prompt (pandas + matplotlib)
- [ ] E2B execution + stdout + chart PNG capture
- [ ] Self-correction loop on execution error
- [ ] Inline chart rendering in React UI

### 🔲 Phase 5 — Polish + Submission
- [ ] Full UI wiring: QueryInput → SSE → AgentTrace → ResultsPanel
- [ ] End-to-end test all 4 sample queries from the brief
- [ ] README: architecture, setup, framework justification, what's next
- [ ] Loom demo: 7–12 min, 2 queries, narrate prompt engineering decisions

---

## Test Queries (from the assignment brief)

Use these to validate the system before recording the demo:

```
1. "Give me a PowerPoint slide summarizing top oncologists in California treating NSCLC"
   Expected: get_physician_data → call_ppt_agent

2. "Build an Excel breakdown of C341 claim volume by physician specialty and state"
   Expected: get_physician_data → call_excel_agent

3. "Write a two-page market access report on NSCLC physician density in the Northeast"
   Expected: get_physician_data → call_report_agent

4. "Run an analysis and show me which states have the highest concentration of high-volume NSCLC prescribers"
   Expected: get_physician_data → call_sandbox_agent

5. "Give me a slide deck and an Excel breakdown of high-volume NSCLC oncologists in California and New York"
   Expected: get_physician_data → call_ppt_agent + call_excel_agent (multi-agent)
```

Query 5 is the primary demo query — it's the end-to-end walkthrough in the brief.

---

## Evaluation Criteria Reminder

| Criterion | Weight | Key Risk |
|---|---|---|
| Agent Orchestration | 35% | Tool descriptions too vague → wrong routing |
| Agent Output Quality | 25% | Files don't download / wrong MIME type |
| Sandbox Execution | 20% | E2B not set up / self-correction missing |
| Code Quality | 20% | Prompts hardcoded / no separation of concerns |

---

## Known Constraints + Mitigations

| Constraint | Mitigation |
|---|---|
| Gemini free tier: 1,500 RPD, 15 RPM | More than enough for development + demo |
| E2B cold start: ~3–5 seconds | Narrate in demo; acceptable for assignment |
| Gemini passes tool args as `MapComposite` | Call `dict(tc.function_call.args)` to convert |
| `physician_list` passed as JSON string to tools | Gemini tool params don't support nested arrays — serialize to string, parse inside each agent |
| SSE doesn't support bidirectional communication | Not needed; query is sent via POST, stream is read-only |
| Artifacts stored in `/tmp` — lost on restart | Fine for assignment; note as known limitation in README |
