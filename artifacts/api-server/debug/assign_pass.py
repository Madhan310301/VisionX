#!/usr/bin/env python3
import json
from pathlib import Path
import math
from importlib import util

REPO_ROOT = Path(__file__).resolve().parents[3]
ENGINE_PATH = REPO_ROOT / "artifacts" / "api-server" / "braille_cv_engine.py"
DEBUG_DIR = REPO_ROOT / "artifacts" / "api-server" / "debug"

spec = util.spec_from_file_location("braille_cv_engine", str(ENGINE_PATH))
engine = util.module_from_spec(spec)
spec.loader.exec_module(engine)

THRESH_MULT = 2.2  # multiplier for assignment threshold (aggressive)

for res_path in sorted(DEBUG_DIR.glob('*_result.json')):
    # Skip files already produced by a previous assign pass
    if res_path.name.endswith('_assigned_result.json'):
        continue
    print('Processing', res_path.name)
    raw_text = res_path.read_text()
    if not raw_text:
        print(' - empty file, skipping')
        continue
    try:
        data = json.loads(raw_text)
    except Exception:
        print(' - failed to parse JSON, skipping', res_path.name)
        continue
    dots = data.get('debugDots') or []
    cells = data.get('cellDebug') or []
    if not cells:
        print(' - no cellDebug, skipping')
        continue

    # Build set of assigned dot centers (rounded)
    assigned = set()
    for c in cells:
        for dc in c.get('dot_centers', []):
            assigned.add((int(dc[0]), int(dc[1])))

    # Convert debugDots to same format
    debug_dots = [ (int(d['x']), int(d['y'])) for d in dots ]

    # Determine avg radius and d_intra if present in JSON; fallback
    avg_radius = data.get('spacing', {}).get('avg_radius') or data.get('avg_radius') or 6
    d_intra = data.get('spacing', {}).get('d_intra') or max(avg_radius*2.2, 12)
    assign_thresh = max(avg_radius * 3.0, d_intra * 1.2) * THRESH_MULT

    # Find orphan dots
    orphans = [pt for pt in debug_dots if pt not in assigned]
    print(f' - total dots: {len(debug_dots)}, assigned: {len(assigned)}, orphans: {len(orphans)}')

    # Map row centers for cells
    for od in orphans:
        ox, oy = od
        best = None
        best_dist = None
        for c in cells:
            # prefer same row by y proximity to cell bbox center
            bx, by, bw, bh = c.get('bbox', (0,0,0,0))
            cell_cy = int(by + bh/2)
            # skip if cell too far vertically
            if abs(cell_cy - oy) > assign_thresh * 1.6:
                continue
            cell_cx = c.get('cx', int(bx + bw/2))
            dist = math.hypot(ox - cell_cx, oy - cell_cy)
            if best_dist is None or dist < best_dist:
                best_dist = dist
                best = c
        if best and best_dist <= assign_thresh:
            best.setdefault('dot_centers', []).append([ox, oy])
            best['dots_detected'] = best.get('dots_detected', 0) + 1
            # conservative confidence bump
            best['confidence'] = float(min(0.96, best.get('confidence', 0.3) + 0.15))
            # update dot_matrix if grid_centers available
            try:
                gx = best['grid_centers']['x']
                gy = best['grid_centers']['y']
                col = 0 if abs(ox - gx[0]) <= abs(ox - gx[1]) else 1
                row_distances = [abs(v - oy) for v in gy]
                r = int(row_distances.index(min(row_distances)))
                dm = best.get('dot_matrix') or [[0,0],[0,0],[0,0]]
                dm[r][col] = 1
                best['dot_matrix'] = dm
                # recompute binary
                bin_code = 0
                if dm[0][0]: bin_code |= (1 << 0)
                if dm[1][0]: bin_code |= (1 << 1)
                if dm[2][0]: bin_code |= (1 << 2)
                if dm[0][1]: bin_code |= (1 << 3)
                if dm[1][1]: bin_code |= (1 << 4)
                if dm[2][1]: bin_code |= (1 << 5)
                best['binary'] = int(bin_code)
            except Exception:
                pass

    # Rebuild cells list for decoder
    mod_cells = []
    for c in cells:
        mod_cells.append({
            'binary': c.get('binary', 0),
            'confidence': c.get('confidence', 0.0),
            'dots_detected': c.get('dots_detected', 0),
            'row_idx': c.get('row_idx', 0),
        })

    # Decode
    new_text = engine.decode_braille_sequence(mod_cells, data.get('brailleSystem','handwritten'))
    # compute new mean confidence
    mean_conf = sum([float(c['confidence']) for c in mod_cells]) / max(1, len(mod_cells))

    # Write new JSON alongside original
    outp = {
        'rawText': new_text,
        'confidence': mean_conf,
        'debugDots': dots,
        'cellDebug': cells,
        'spacing': data.get('spacing')
    }
    out_path = res_path.with_name(res_path.stem + '_assigned_result.json')
    out_path.write_text(json.dumps(outp, indent=2))
    print(' - wrote', out_path.name)

print('Done assign pass.')
