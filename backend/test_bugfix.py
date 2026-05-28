"""Re-test Q5 (multi-agent PPT+Excel) after bug fixes."""
import sys, json
sys.stdout.reconfigure(encoding="utf-8")
import requests

URL = "http://localhost:8000/query"
payload = {
    "query": "Give me a slide deck and an Excel breakdown of high-volume NSCLC oncologists in California and New York",
    "preferences": {"icd10_codes": ["C341", "C342"], "states": ["CA", "NY"], "volume_tier": "high"},
}

print("Q5 — PPT + Excel multi-agent")
print("="*50)
tools, artifacts, errors = [], [], []

with requests.post(URL, json=payload, stream=True, timeout=300) as resp:
    resp.raise_for_status()
    for line in resp.iter_lines(decode_unicode=True):
        if not line.startswith("data: "): continue
        try: ev = json.loads(line[6:])
        except: continue
        t = ev.get("type")
        if t == "tool_called":
            tools.append(ev["tool"])
            print(f"  tool_called: {ev['tool']}")
        elif t == "tool_done":
            msg = ev.get("message", "")
            if "Error" in msg:
                errors.append(f"{ev['tool']}: {msg}")
            if ev.get("artifact_id"):
                artifacts.append(ev["artifact_id"])
            print(f"  tool_done:   {ev['tool']} -> {msg[:90]}")
        elif t in ("done", "error"):
            print(f"  [{t}]: {(ev.get('text') or ev.get('message',''))[:120]}")
            break

print(f"\n  Artifacts: {len(artifacts)}")
print(f"  Errors:    {len(errors)}")
for e in errors: print(f"    - {e}")
status = "PASS" if len(errors) == 0 and len(artifacts) >= 2 else "PARTIAL"
print(f"  => {status}")
