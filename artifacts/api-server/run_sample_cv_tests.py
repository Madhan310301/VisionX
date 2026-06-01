import base64
import json
import os
import sys
from urllib import request, error

API = "http://127.0.0.1:8000/api/cv/process"
SAMPLES = [
    os.path.join(os.path.abspath(os.path.join(os.getcwd(), '..', '..')), 'sample_scans', 'computer_eight_dot_braille.png'),
    os.path.join(os.path.abspath(os.path.join(os.getcwd(), '..', '..')), 'sample_scans', 'music_braille_score.png'),
    os.path.join(os.path.abspath(os.path.join(os.getcwd(), '..', '..')), 'sample_scans', 'nemeth_math_braille.png')
]
OUTPUT_DIR = os.path.join(os.getcwd(), 'sample_outputs')
os.makedirs(OUTPUT_DIR, exist_ok=True)

for path in SAMPLES:
    name = os.path.splitext(os.path.basename(path))[0]
    print(f"Processing: {path}")
    try:
        with open(path, 'rb') as f:
            b = f.read()
    except FileNotFoundError:
        print(f"  Skipping missing: {path}")
        continue

    b64 = base64.b64encode(b).decode('ascii')
    payload = json.dumps({
        'imageBase64': 'data:image/png;base64,' + b64,
        'scanMode': 'auto'
    }).encode('utf-8')

    req = request.Request(API, data=payload, headers={'Content-Type': 'application/json'})
    try:
        with request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode('utf-8')
            data = json.loads(body)

            # Save debugImage and dotOverlayImage
            for key in ('debugImage', 'dotOverlayImage'):
                if key in data and data[key]:
                    img_b64 = data[key]
                    if ',' in img_b64:
                        img_b64 = img_b64.split(',', 1)[1]
                    out_path = os.path.join(OUTPUT_DIR, f"{name}_{key}.png")
                    with open(out_path, 'wb') as out:
                        out.write(base64.b64decode(img_b64))
                    print(f"  Saved {key} -> {out_path}")
            # Save JSON response
            out_json = os.path.join(OUTPUT_DIR, f"{name}_response.json")
            with open(out_json, 'w', encoding='utf-8') as jfile:
                json.dump(data, jfile, indent=2)
            print(f"  Saved response -> {out_json}")
    except error.URLError as e:
        print(f"  Request failed: {e}")
    except Exception as e:
        print(f"  Error processing {name}: {e}")

print('Done')
