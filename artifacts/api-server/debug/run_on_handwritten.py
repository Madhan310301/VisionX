#!/usr/bin/env python3
import sys
import os
from pathlib import Path
import base64
import json
import traceback

# dynamic import of braille_cv_engine (file path) because package path has a dash
from importlib import util

REPO_ROOT = Path(__file__).resolve().parents[3]
ENGINE_PATH = REPO_ROOT / "artifacts" / "api-server" / "braille_cv_engine.py"
DEBUG_OUT = REPO_ROOT / "artifacts" / "api-server" / "debug"
IM_DIR = REPO_ROOT / "sample_scans" / "handwritten"

DEBUG_OUT.mkdir(parents=True, exist_ok=True)

spec = util.spec_from_file_location("braille_cv_engine", str(ENGINE_PATH))
engine = util.module_from_spec(spec)
spec.loader.exec_module(engine)

if not IM_DIR.exists():
    print(f"No images found at {IM_DIR}. Please put handwritten images there and re-run.")
    sys.exit(1)

imgs = sorted([p for p in IM_DIR.iterdir() if p.suffix.lower() in (".jpg", ".jpeg", ".png")])
if not imgs:
    print(f"No image files in {IM_DIR}")
    sys.exit(1)

results = []
for p in imgs:
    try:
        print(f"Processing {p.name}...")
        b = p.read_bytes()
        b64 = base64.b64encode(b).decode('ascii')
        res = engine.execute_braille_cv_pipeline(b64, scan_mode="handwritten")

        # save full JSON result
        out_json = DEBUG_OUT / (p.stem + "_result.json")
        out_json.write_text(json.dumps(res, indent=2))

        # save dotOverlayImage if present (base64 PNG)
        if res.get("dotOverlayImage"):
            png_b = base64.b64decode(res["dotOverlayImage"].split(",")[-1])
            (DEBUG_OUT / (p.stem + "_dotOverlay.png")).write_bytes(png_b)

        # save debugDots and cellDebug
        if res.get("debugDots") is not None:
            (DEBUG_OUT / (p.stem + "_debugDots.json")).write_text(json.dumps(res["debugDots"], indent=2))
        if res.get("cellDebug") is not None:
            (DEBUG_OUT / (p.stem + "_cellDebug.json")).write_text(json.dumps(res["cellDebug"], indent=2))

        results.append({"file": p.name, "status": "ok", "out": str(out_json)})
    except Exception as e:
        tb = traceback.format_exc()
        print(f"Error processing {p.name}: {e}\n{tb}")
        results.append({"file": p.name, "status": "error", "error": str(e)})

summary_path = DEBUG_OUT / "run_summary.json"
summary_path.write_text(json.dumps(results, indent=2))
print("Done. Outputs saved to:", DEBUG_OUT)
print("Summary:")
print(json.dumps(results, indent=2))
