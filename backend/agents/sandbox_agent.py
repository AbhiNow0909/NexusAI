"""
Sandbox Agent — uses Gemini to write Python code, then executes it in E2B.
Includes a self-correction loop if execution fails.
"""
import json
import os
from pathlib import Path

import google.generativeai as genai


def load_prompt(name: str) -> str:
    path = Path(__file__).parent.parent / "prompts" / f"{name}.txt"
    return path.read_text(encoding="utf-8")


async def _generate_code(code_goal: str, dataset: str, chart_type: str) -> str:
    model = genai.GenerativeModel(
        model_name=os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"),
        system_instruction=load_prompt("sandbox_agent"),
    )
    prompt = (
        f"Code goal: {code_goal}\n"
        f"Chart type: {chart_type}\n\n"
        f"Dataset (JSON string):\n{dataset}\n\n"
        "Return ONLY the Python code — no markdown fences, no explanation."
    )
    response = model.generate_content(prompt)
    code = response.text.strip()
    if code.startswith("```"):
        code = code.split("```")[1]
        if code.startswith("python"):
            code = code[6:]
        code = code.rsplit("```", 1)[0]
    return code.strip()


async def _fix_code(original_code: str, error_message: str) -> str:
    model = genai.GenerativeModel(model_name=os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"))
    prompt = (
        "The following Python code raised an error when executed in a sandbox.\n"
        "Fix it so it runs without errors. Return ONLY the corrected Python code — no fences.\n\n"
        f"Original code:\n{original_code}\n\n"
        f"Error:\n{error_message}"
    )
    response = model.generate_content(prompt)
    code = response.text.strip()
    if code.startswith("```"):
        code = code.split("```")[1]
        if code.startswith("python"):
            code = code[6:]
        code = code.rsplit("```", 1)[0]
    return code.strip()


async def run_sandbox_agent(
    code_goal: str,
    dataset: str,
    chart_type: str = "bar",
) -> dict:
    try:
        genai.configure(api_key=os.environ["GOOGLE_API_KEY"])

        code = await _generate_code(code_goal, dataset, chart_type)

        from e2b_code_interpreter import Sandbox
        sandbox = Sandbox()

        result = sandbox.run_code(code)

        # Self-correction if execution failed
        if result.error:
            error_msg = str(result.error)
            corrected_code = await _fix_code(code, error_msg)
            result = sandbox.run_code(corrected_code)
            final_code = corrected_code
        else:
            final_code = code

        sandbox.kill()

        # Extract chart PNG if generated
        chart_b64 = None
        for output in result.results:
            if hasattr(output, "png") and output.png:
                chart_b64 = output.png

        stdout_lines = result.logs.stdout if result.logs else []
        stdout = "\n".join(stdout_lines) if isinstance(stdout_lines, list) else str(stdout_lines)

        return {
            "code": final_code,
            "stdout": stdout,
            "chart_b64": chart_b64,
        }

    except Exception as exc:
        return {"error": True, "message": str(exc)}
