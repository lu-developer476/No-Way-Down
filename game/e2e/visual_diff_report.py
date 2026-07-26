#!/usr/bin/env python3
import json,pathlib
from PIL import Image,ImageChops
root=pathlib.Path(__file__).resolve().parents[1]; base=root/'e2e'/'visual-baselines'; actual=root/'test-results'/'screenshots'; out=root/'test-results'/'visual-diff'; out.mkdir(parents=True,exist_ok=True)
rows=[]
for e in json.loads((base/'manifest.json').read_text())['baselines']:
 a,b=actual/e['filename'],base/e['filename']
 if not a.exists() or not b.exists(): rows.append({'filename':e['filename'],'status':'missing'}); continue
 ai,bi=Image.open(a).convert('RGB'),Image.open(b).convert('RGB'); d=ImageChops.difference(ai,bi); d.save(out/e['filename']); h=d.histogram(); changed=sum(v for i,v in enumerate(h) if i%256); rows.append({'filename':e['filename'],'ratio':changed/(ai.width*ai.height*3),'tolerance':e['tolerance']})
(out/'report.json').write_text(json.dumps(rows,indent=2))
