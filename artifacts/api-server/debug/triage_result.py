import json
import sys
from pathlib import Path

p = Path(sys.argv[1]) if len(sys.argv)>1 else Path('artifacts/api-server/debug/nemeth_math_braille_result.json')
if not p.exists():
    print('File not found:', p)
    sys.exit(1)

j = json.load(open(p,'r'))
raw = j.get('rawText','')
dd = j.get('debugDots') or []
cd = j.get('cellDebug') or []

print('File:', p.name)
print('Overall confidence:', j.get('confidence'))
print('SystemConfidence:', j.get('systemConfidence'), 'brailleSystem:', j.get('brailleSystem'))
print('debugDots:', len(dd), 'cellDebug:', len(cd))

# dot confidence stats
dot_cs = [d.get('confidence',1.0) for d in dd]
if dot_cs:
    print('dot confidence: min={:.3f}, median~={:.3f}, mean={:.3f}, max={:.3f}'.format(min(dot_cs), sorted(dot_cs)[len(dot_cs)//2], sum(dot_cs)/len(dot_cs), max(dot_cs)))

# cell confidence and binary summary
low_conf = []
unknown_count = 0
uncertain_cells = 0
bin_counts = {}
for i,c in enumerate(cd):
    conf = c.get('confidence',0)
    b = c.get('binary')
    label = c.get('label')
    if label and (label.startswith('[UNKNOWN]') or label=='[UNKNOWN]'):
        unknown_count += 1
    if '[' in str(b) or label and 'UNCERTAIN' in str(label):
        uncertain_cells += 1
    bin_counts[b] = bin_counts.get(b,0)+1
    if conf < 0.65:
        low_conf.append((i, conf, b, c.get('dots', [])))

print('Unknown cells (label shows [UNKNOWN]):', unknown_count)
print('Cells flagged uncertain:', uncertain_cells)
print('Unique binary patterns seen:', len(bin_counts))
print('Top 8 low-confidence cells (index,conf,binary,dotCount):')
for t in sorted(low_conf, key=lambda x: x[1])[:8]:
    idx,conf,b,dots = t
    print(idx, round(conf,3), b, len(dots) if dots else 0)

# Count rawText markers
unk = raw.count('[UNKNOWN]')
unc = raw.count('[UNCERTAIN_CELL]')
print('\nrawText markers: [UNKNOWN]=', unk, ', [UNCERTAIN_CELL]=', unc)

# Quick heuristic causes
print('\nHeuristic triage:')
if len(dd) < 40:
    print('- Possibly under-detected dots (too few detected).')
elif len(dd) > 250:
    print('- Possible over-detection (noise).')
else:
    print('- Dot count in plausible range.')

if unknown_count > len(cd)*0.2:
    print('- High fraction of unknown cells -> decoder mapping or cell grouping issue.')

if len([1 for _,c,b,d in low_conf if c<0.4])>5:
    print('- Many very low-confidence cells; consider raising dot detection thresholds and re-running.')

print('\nDone.')
