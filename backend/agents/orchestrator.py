"""
Orchestrator Agent — custom Gemini tool_use agentic loop.
Routes user queries to specialized sub-agents via Gemini function calling.
"""
import asyncio
import json
import os
from pathlib import Path

import google.generativeai as genai

from tools.physician_data import get_physician_data
from agents.ppt_agent import run_ppt_agent
from agents.excel_agent import run_excel_agent
from agents.sandbox_agent import run_sandbox_agent
from agents.report_agent import run_report_agent
from tools.tool_definitions import TOOL_DECLARATIONS

TOOL_HANDLERS = {
    "get_physician_data": get_physician_data,
    "call_ppt_agent": run_ppt_agent,
    "call_excel_agent": run_excel_agent,
    "call_sandbox_agent": run_sandbox_agent,
    "call_report_agent": run_report_agent,
}


def load_prompt(name: str) -> str:
    path = Path(__file__).parent.parent / "prompts" / f"{name}.txt"
    return path.read_text(encoding="utf-8")


def build_user_message(query: str, preferences: dict) -> str:
    pref_lines = []
    if preferences.get("icd10_codes"):
        pref_lines.append(f"ICD-10 codes: {', '.join(preferences['icd10_codes'])}")
    if preferences.get("states"):
        pref_lines.append(f"States: {', '.join(preferences['states'])}")
    if preferences.get("volume_tier"):
        pref_lines.append(f"Volume tier: {preferences['volume_tier']}")

    pref_block = "\n".join(pref_lines) if pref_lines else "No additional filters."
    return f"User query: {query}\n\nUser preferences:\n{pref_block}"


def summarize_result(result: dict) -> str:
    """Return a short human-readable summary of a tool result for SSE events."""
    if not result:
        return "No result."
    if result.get("error"):
        return f"Error: {result.get('message', 'unknown')}"
    if "physicians" in result:
        return f"Found {len(result['physicians'])} physicians."
    if "artifact_id" in result:
        return f"Generated artifact {result['artifact_id'][:8]}… ({result.get('filename', '')})"
    if "markdown" in result:
        preview = result["markdown"][:80].replace("\n", " ")
        return f"Report: {preview}…"
    if "stdout" in result:
        return f"Sandbox output: {str(result['stdout'])[:80]}"
    return "Done."


async def _generate_with_retry(model, messages, sse_queue: asyncio.Queue, max_retries: int = 3):
    """Calls model.generate_content with exponential backoff on 429 rate-limit errors."""
    import re
    for attempt in range(max_retries):
        try:
            return await asyncio.to_thread(model.generate_content, messages)
        except Exception as exc:
            is_rate_limit = "429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc)
            if not is_rate_limit or attempt == max_retries - 1:
                raise
            # Parse suggested retry delay from the error message if present
            match = re.search(r"retry in (\d+)", str(exc))
            wait = int(match.group(1)) + 5 if match else 30 * (2 ** attempt)
            await sse_queue.put({"type": "orchestrator_thinking",
                                 "message": f"Rate limit hit — waiting {wait}s before retry ({attempt + 1}/{max_retries})…"})
            await asyncio.sleep(wait)


async def run_orchestrator(query: str, preferences: dict, sse_queue: asyncio.Queue) -> None:
    try:
        genai.configure(api_key=os.environ["GOOGLE_API_KEY"])

        model = genai.GenerativeModel(
            model_name=os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"),
            system_instruction=load_prompt("orchestrator"),
            tools=TOOL_DECLARATIONS,
        )

        await sse_queue.put({"type": "orchestrator_thinking", "message": "Parsing intent and planning tool calls…"})

        user_message = build_user_message(query, preferences)
        messages = [{"role": "user", "parts": [user_message]}]

        max_iterations = 10
        for _ in range(max_iterations):
            # Run blocking gRPC call in a thread so the event loop (and SSE stream) stay responsive
            response = await _generate_with_retry(model, messages, sse_queue)
            candidate = response.candidates[0]

            tool_calls = [
                p for p in candidate.content.parts if hasattr(p, "function_call") and p.function_call.name
            ]

            if not tool_calls:
                final_text = ""
                for part in candidate.content.parts:
                    if hasattr(part, "text") and part.text:
                        final_text += part.text
                await sse_queue.put({"type": "done", "text": final_text})
                return

            tool_results = []
            for tc in tool_calls:
                tool_name = tc.function_call.name
                tool_args = dict(tc.function_call.args)

                await sse_queue.put({"type": "tool_called", "tool": tool_name, "args": tool_args})

                handler = TOOL_HANDLERS.get(tool_name)
                if handler is None:
                    result = {"error": True, "message": f"Unknown tool: {tool_name}"}
                else:
                    result = await handler(**tool_args)

                tool_results.append({"name": tool_name, "result": result})

                event = {"type": "tool_done", "tool": tool_name, "message": summarize_result(result)}
                # Attach artifact/content fields directly on the event for the frontend
                if "artifact_id" in result:
                    event["artifact_id"] = result["artifact_id"]
                    event["filename"] = result.get("filename", "")
                if "markdown" in result:
                    event["markdown"] = result["markdown"]
                if "stdout" in result:
                    event["stdout"] = result["stdout"]
                if "chart_b64" in result:
                    event["chart_b64"] = result["chart_b64"]
                if "physicians" in result:
                    event["count"] = len(result["physicians"])
                await sse_queue.put(event)

            # Feed tool results back into conversation history
            messages.append({"role": "model", "parts": candidate.content.parts})
            function_responses = [
                genai.protos.Part(
                    function_response=genai.protos.FunctionResponse(
                        name=r["name"],
                        response={"result": json.dumps(r["result"], default=str)},
                    )
                )
                for r in tool_results
            ]
            messages.append({"role": "user", "parts": function_responses})

        await sse_queue.put({"type": "done", "text": "Max iterations reached."})

    except Exception as exc:
        await sse_queue.put({"type": "error", "message": str(exc)})
