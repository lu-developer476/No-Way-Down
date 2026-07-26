#!/usr/bin/env python3
"""Deterministically builds original visual-v2 assets as reviewable SVG text."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1] / "public/assets/visual-v2"
ACTIONS = ["idle", "run", "aim", "shoot", "reload", "hurt", "melee", "down", "interact"]

def svg(width, height, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" shape-rendering="crispEdges">\n{body}\n</svg>\n'

def save(relative, content):
    path = ROOT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")

def person(relative, skin, hair, coat, accent, zombie=False):
    parts=[]
    for i, action in enumerate(ACTIONS):
        x=i*48; bob=1 if action in ("run", "hurt") else 0; arm_y=67 if action=="down" else 39
        parts += [
          f'<ellipse cx="{x+24}" cy="87" rx="15" ry="5" fill="#05080b" opacity=".42"/>',
          f'<rect x="{x+17}" y="{59+bob}" width="8" height="25" fill="{coat}"/>',
          f'<rect x="{x+28}" y="{59-bob}" width="8" height="25" fill="{coat}"/>',
          f'<rect x="{x+14}" y="30" width="24" height="35" fill="{coat}"/>',
          f'<rect x="{x+14}" y="46" width="24" height="6" fill="{accent}"/>',
          f'<rect x="{x+18}" y="{13+bob}" width="17" height="19" fill="{skin}"/>',
          f'<rect x="{x+16}" y="{10+bob}" width="20" height="9" fill="{hair}"/>',
          f'<rect x="{x+13}" y="{19+bob}" width="5" height="11" fill="{hair}"/>',
          f'<path d="M{x+17} {arm_y} L{x+31} {arm_y+5}" stroke="{skin}" stroke-width="5"/>',
          f'<rect x="{x+26}" y="{arm_y+1}" width="20" height="5" fill="#283036"/>',
          f'<rect x="{x+33}" y="{arm_y}" width="6" height="3" fill="{accent}"/>'
        ]
        if zombie: parts += [f'<rect x="{x+27}" y="20" width="6" height="5" fill="#7e121c"/>', f'<rect x="{x+12}" y="42" width="9" height="7" fill="#671018"/>']
        if action=="shoot": parts.append(f'<path d="M{x+45} {arm_y+3} L{x+48} {arm_y-4} L{x+48} {arm_y+9} Z" fill="#ffb634"/>')
    save(relative, svg(432,96,"\n".join(parts)))

entries=[]
chars=[("characters/alan.svg","#be9774","#cdd2cc","#232b32","#d2a32d"),("characters/giovanna.svg","#b28069","#22191d","#302734","#cd3e68")]
zombies=[("zombies/guard.svg","#7c917c","#2b2f2a","#233943","#9b7e33"),("zombies/civil.svg","#948975","#493930","#3f2e34","#5e7076"),("zombies/advanced.svg","#6b806c","#2a2724","#31332b","#7a1d26")]
for rel,*colors in chars: person(rel,*colors); entries.append((Path(rel).stem,rel,"character",432,96,48,96,9))
for rel,*colors in zombies: person(rel,*colors,zombie=True); entries.append((Path(rel).stem,rel,"zombie",432,96,48,96,9))

weapon_parts=[]
for i,(metal,stock) in enumerate([("#364146","#5c432b"),("#4e3c31","#6b4930"),("#2a3137","#4e4035"),("#42484c","#654b32")]):
    x=i*32; weapon_parts += [f'<rect x="{x+2}" y="13" width="28" height="6" fill="{metal}"/>',f'<rect x="{x+10}" y="19" width="8" height="4" fill="{stock}"/>',f'<rect x="{x+24}" y="11" width="5" height="3" fill="#b59546"/>']
save("weapons/weapons.svg",svg(128,32,"\n".join(weapon_parts))); entries.append(("weapons","weapons/weapons.svg","weapon",128,32,32,32,4))

fx='''<path d="M1 8 L8 2 L15 8 L8 14 Z" fill="#fffad6"/><path d="M17 8 L26 1 L31 8 L26 15 Z" fill="#ffa624"/><ellipse cx="41" cy="9" rx="7" ry="6" fill="#6f787d" opacity=".58"/><path d="M49 8 H64" stroke="#ffc94d" stroke-width="2"/>'''
save("fx/combat_fx.svg",svg(64,16,fx)); entries.append(("combat-fx","fx/combat_fx.svg","fx",64,16,16,16,4))

for name,hair,accent in [("alan","#cdd2cc","#d2a32d"),("giovanna","#22191d","#cd3e68")]:
    body=f'<rect width="48" height="48" fill="#0f161c"/><rect x="8" y="29" width="33" height="19" fill="{accent}"/><ellipse cx="24" cy="22" rx="13" ry="15" fill="#b5896d"/><rect x="10" y="5" width="30" height="11" fill="{hair}"/>'
    rel=f"ui/portrait_{name}.svg"; save(rel,svg(48,48,body)); entries.append((f"portrait-{name}",rel,"ui",48,48,48,48,1))
markers=''.join(f'<circle cx="{i*8+4}" cy="4" r="3" fill="{c}"/>' for i,c in enumerate(["#54d399","#f472b6","#f87171","#facc15"]))
save("minimap/markers.svg",svg(32,8,markers)); entries.append(("minimap-markers","minimap/markers.svg","minimap",32,8,8,8,4))

manifest={"version":"2.0.0","license":"Original internal No Way Down artwork","assets":[]}
for aid,path,cat,w,h,fw,fh,count in entries:
    animations={a:{"start":i,"end":i,"fps":8,"repeat":-1 if a in ("idle","run") else 0} for i,a in enumerate(ACTIONS[:count])} if cat in ("character","zombie") else {}
    manifest["assets"].append({"id":aid,"path":f"assets/visual-v2/{path}","category":cat,"dimensions":{"width":w,"height":h},"frameWidth":fw,"frameHeight":fh,"frames":count,"animations":animations,"origin":{"x":.5,"y":.92},"recommendedScale":1,"version":"2.0.0","source":"Original internal deterministic SVG generator"})
(ROOT/"visual_manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
print(f"generated {len(entries)} text-only visual-v2 SVG assets")
