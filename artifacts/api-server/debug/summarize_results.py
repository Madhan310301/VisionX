import json
from pathlib import Path
D=Path(__file__).resolve().parents[0]
for f in sorted(D.glob('*_result.json')):
    j=json.load(open(f,'r'))
    raw=j.get('rawText','')
    cnf=j.get('confidence')
    dd=j.get('debugDots')
    cd=j.get('cellDebug')
    has_overlay = bool(j.get('dotOverlayImage'))
    print(f"{f.name}: confidence={cnf}, raw_len={len(raw):,}, debugDots={len(dd) if dd else 0}, cellDebug={len(cd) if cd else 0}, overlay={has_overlay}")
    print('rawText preview:')
    print((raw[:400] + '...') if len(raw)>400 else raw)
    print('-'*60)
