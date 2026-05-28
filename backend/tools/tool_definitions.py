"""
Gemini FunctionDeclaration objects for all 5 orchestrator tools.
Tool descriptions are intentionally precise — Gemini routes based on description text.
"""
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
                        items=genai.protos.Schema(type=genai.protos.Type.STRING),
                    ),
                    "icd10_codes": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING),
                    ),
                    "volume_threshold": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        enum=["low", "high", "very_high"],
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
                    "physician_list": genai.protos.Schema(type=genai.protos.Type.STRING),
                    "icd10_codes": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING),
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
                        items=genai.protos.Schema(type=genai.protos.Type.STRING),
                    ),
                    "icd10_codes": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING),
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
                    "dataset": genai.protos.Schema(type=genai.protos.Type.STRING),
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
                        items=genai.protos.Schema(type=genai.protos.Type.STRING),
                    ),
                    "physician_list": genai.protos.Schema(type=genai.protos.Type.STRING),
                    "icd10_context": genai.protos.Schema(type=genai.protos.Type.STRING),
                    "geographic_scope": genai.protos.Schema(type=genai.protos.Type.STRING),
                },
            ),
        ),
    ])
]
