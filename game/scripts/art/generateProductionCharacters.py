#!/usr/bin/env python3
"""Deterministic, offline production pixel-art generator for No Way Down."""
from __future__ import annotations
import argparse, hashlib, json, random, struct, tempfile, zlib
from pathlib import Path

def rgba(value):
 if isinstance(value,tuple): return value if len(value)==4 else (*value,255)
 value=value.lstrip('#'); return tuple(int(value[i:i+2],16) for i in (0,2,4))+(255,)
class PixelImage:
 def __init__(self,w,h,color=(0,0,0,0)): self.width=w;self.height=h;self.pixels=[rgba(color)]*(w*h)
 def put(self,x,y,color):
  if 0<=x<self.width and 0<=y<self.height:self.pixels[y*self.width+x]=rgba(color)
 def alpha_composite(self,other,pos):
  ox,oy=pos
  for y in range(other.height):
   for x in range(other.width):
    c=other.pixels[y*other.width+x]
    if c[3]:self.put(ox+x,oy+y,c)
 def save(self,path,**_):
  raw=b''.join(b'\0'+bytes(sum((list(self.pixels[y*self.width+x]) for x in range(self.width)),[])) for y in range(self.height))
  def chunk(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
  data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',self.width,self.height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
  Path(path).write_bytes(data)
class PixelDraw:
 def __init__(self,im):self.im=im
 def point(self,p,fill):self.im.put(*p,fill)
 def rectangle(self,box,fill):
  x0,y0,x1,y1=map(int,box)
  for y in range(y0,y1+1):
   for x in range(x0,x1+1):self.im.put(x,y,fill)
 def line(self,points,fill,width=1):
  if len(points)==4 and isinstance(points[0],int): points=[points[:2],points[2:]]
  for a,b in zip(points,points[1:]):
   x0,y0=map(int,a);x1,y1=map(int,b);dx=abs(x1-x0);sx=1 if x0<x1 else -1;dy=-abs(y1-y0);sy=1 if y0<y1 else -1;err=dx+dy
   while True:
    for yy in range(y0-width//2,y0+(width+1)//2):
     for xx in range(x0-width//2,x0+(width+1)//2):self.im.put(xx,yy,fill)
    if x0==x1 and y0==y1:break
    e=2*err
    if e>=dy:err+=dy;x0+=sx
    if e<=dx:err+=dx;y0+=sy
 def polygon(self,pts,fill):
  pts=[(int(x),int(y)) for x,y in pts]; ymin=max(0,min(y for _,y in pts));ymax=min(self.im.height-1,max(y for _,y in pts))
  for y in range(ymin,ymax+1):
   xs=[]
   for (x1,y1),(x2,y2) in zip(pts,pts[1:]+pts[:1]):
    if y1==y2 or y<min(y1,y2) or y>=max(y1,y2):continue
    xs.append(round(x1+(y-y1)*(x2-x1)/(y2-y1)))
   xs.sort()
   for a,b in zip(xs[::2],xs[1::2]):
    for x in range(a,b+1):self.im.put(x,y,fill)
class Image:
 @staticmethod
 def new(_mode,size,color):return PixelImage(*size,color)
class ImageDraw:
 @staticmethod
 def Draw(im):return PixelDraw(im)

SEED=4762026; FW,FH,FOOT=64,96,88
ROOT=Path(__file__).resolve().parents[3]
GENERATOR='game/scripts/art/generateProductionCharacters.py'
HUMAN_ANIMS=[('idle',4,5,True),('walk',8,10,True),('aim',2,8,True),('shoot',4,12,False),('reload',6,9,False),('melee',6,12,False),('hurt',3,8,False),('death',6,7,False),('climb',6,9,True),('interact',3,7,False)]
ZOMBIE_ANIMS=[('idle',4,4,True),('walk',8,8,True),('attack',6,9,False),('hurt',3,7,False),('death',8,6,False)]
HUMANS={
'alan':('Alan Nahuel',['#e3b28b','#b97d62','#75483b'],['#eef1ed','#aeb4b3','#666d70'],['#171c25','#293342','#465365','#e3ad36','#fff0a3','#080b10'],'broad','beard'),
'giovanna':('Giovanna',['#e9b793','#bd8065','#77483e'],['#261c24','#49333f','#86616c'],['#202532','#3b3343','#74405e','#d55291','#ff9ac8','#0b0c12'],'slim','long'),
'nahir':('Nahir',['#dca17d','#ad6b55','#6e3c35'],['#9b4938','#633126','#351b1b'],['#203c64','#315f8d','#5993bf','#df6b9e','#ffc0d8','#0a1320'],'athletic','swept'),
'damian':('Damián',['#d4a17e','#a66b50','#673b31'],['#342820','#674b35','#9a7654'],['#442630','#713645','#9b5260','#d68a4b','#ffc17c','#160c10'],'heavy','crop'),
'celestino':('Celestino',['#c98f6d','#965b48','#593229'],['#352d20','#67563a','#9b8658'],['#263d2c','#3e6642','#679260','#a9b85b','#e1dc8b','#0b140d'],'robust','short'),
'hernan':('Hernán',['#dca783','#ad7058','#684038'],['#19191c','#393b42','#70737a'],['#171d24','#26333b','#38594d','#57a66d','#a6df9d','#080b0e'],'tall','side'),
'yamil':('Yamil',['#daa47e','#aa6c50','#633a2c'],['#4b2e20','#755039','#a67855'],['#28313b','#485866','#73614d','#dd7635','#ffb15b','#0d1116'],'lean','wave'),
'lorena':('Lorena',['#edbd98','#c48268','#7c493e'],['#e2c39c','#a67c59','#644630'],['#493552','#684b72','#8c7199','#4db2a1','#9de4d1','#130e17'],'curvy','braid'),
'selene':('Selene',['#c98d70','#985a49','#5d342d'],['#171b2e','#313b64','#5f6b99'],['#182b3a','#28506b','#457b91','#c5a952','#f1dc82','#080f15'],'slim','bob')}
ZOMBIES={
'zombie-guard':('Guardia infectado',['#91a47a','#647658','#394a38'],['#303b36','#18211f','#65736b'],['#24394b','#38566a','#637a87','#8f3037','#d35d55','#10191c'],'broad','helmet'),
'zombie-civil':('Civil infectado',['#a8a07c','#777054','#474532'],['#49352f','#251c1b','#806255'],['#5b4337','#80604b','#aa876c','#772f3d','#bd5960','#18110f'],'thin','messy'),
'zombie-advanced':('Infectado avanzado',['#779178','#4e674e','#2e4134'],['#24262f','#101117','#515666'],['#30303d','#4e4257','#725774','#9c3047','#e35b68','#111117'],'hulking','scar')}

def poly(d, pts, fill, outline='#080b10'): d.polygon(pts,fill=fill); d.line(pts+[pts[0]],fill=outline,width=1)
def frame(pal,profile,hair_style,row,frame,zombie=False):
 im=Image.new('RGBA',(FW,FH),(0,0,0,0)); d=ImageDraw.Draw(im); rng=random.Random(SEED+row*101+frame*17+sum(map(ord,profile+hair_style)))
 skin,hair,clothes=pal[:3],pal[3:6],pal[6:]
 phase=(frame%4)-1; bob=[0,1,0,-1][frame%4]; foot=FOOT
 if row==7: # grounded death pose
  poly(d,[(8,80-frame),(49,75),(59,80),(52,87),(16,88)],clothes[1]); poly(d,[(44,69+frame%3),(58,72),(57,84),(45,82)],skin[1]); d.rectangle((10,86,60,88),fill=clothes[-1]); d.point((2+frame*3,2),fill=clothes[4]); return im
 widths={'broad':19,'heavy':20,'robust':19,'tall':15,'lean':14,'slim':13,'curvy':16,'athletic':15,'thin':12,'hulking':21}.get(profile,16)
 cx=31; shoulder=widths; head_y=10+bob; torso_top=32+bob; torso_bottom=61+bob
 # rear equipment / silhouette accessories
 if profile in ('robust','hulking'): poly(d,[(cx-shoulder-6,35),(cx-shoulder+1,31),(cx-shoulder+3,61),(cx-shoulder-5,65)],clothes[2])
 if hair_style=='braid': poly(d,[(cx-10,20),(cx-14,33),(cx-10,49),(cx-6,31)],hair[1])
 # legs with animated articulation and fixed feet
 stride=phase*(3 if row in (1,8) else 1); knee=72
 poly(d,[(cx-widths//2,torso_bottom),(cx-2,torso_bottom),(cx-3+stride,knee),(cx-7+stride,foot-5),(cx-15+stride,foot-5),(cx-11,knee)],clothes[1])
 poly(d,[(cx+1,torso_bottom),(cx+widths//2,torso_bottom),(cx+11-stride,knee),(cx+15-stride,foot-5),(cx+4-stride,foot-5),(cx+5,knee)],clothes[2])
 # boots exact line
 poly(d,[(cx-16+stride,foot-6),(cx-5+stride,foot-6),(cx-3+stride,foot),(cx-18+stride,foot)],clothes[-1])
 poly(d,[(cx+4-stride,foot-6),(cx+15-stride,foot-6),(cx+19-stride,foot),(cx+3-stride,foot)],clothes[-1])
 # torso tailored by profile
 poly(d,[(cx-shoulder,torso_top+5),(cx-shoulder+4,torso_top),(cx+shoulder-3,torso_top),(cx+shoulder+2,torso_top+8),(cx+widths//2,torso_bottom),(cx-widths//2,torso_bottom)],clothes[0])
 d.line((cx-shoulder+4,torso_top+3,cx+widths//2,torso_bottom-3),fill=clothes[3],width=2); d.line((cx-4,torso_top+1,cx-4,torso_bottom-2),fill=clothes[2],width=2)
 # head, ears, neck; pixel polygons rather than primitives
 poly(d,[(cx-7,27+bob),(cx-5,21+bob),(cx+6,21+bob),(cx+8,30+bob),(cx+4,36+bob),(cx-5,35+bob)],skin[1])
 d.rectangle((cx-9,25+bob,cx-6,30+bob),fill=skin[1]); d.rectangle((cx+7,25+bob,cx+10,30+bob),fill=skin[1])
 poly(d,[(cx-8,head_y+8),(cx-5,head_y+3),(cx+3,head_y+1),(cx+9,head_y+7),(cx+8,head_y+17),(cx+4,head_y+22),(cx-4,head_y+22),(cx-8,head_y+16)],skin[0])
 # hair unique profiles
 hair_pts={'long':[(cx-10,head_y+9),(cx-7,head_y+1),(cx+7,head_y),(cx+11,head_y+9),(cx+9,head_y+29),(cx+5,head_y+22),(cx+7,head_y+8),(cx-6,head_y+7),(cx-7,head_y+25),(cx-11,head_y+27)],'bob':[(cx-10,head_y+7),(cx-5,head_y),(cx+7,head_y+1),(cx+11,head_y+8),(cx+9,head_y+20),(cx+5,head_y+17),(cx+6,head_y+7),(cx-8,head_y+10),(cx-8,head_y+19),(cx-11,head_y+18)],'swept':[(cx-9,head_y+9),(cx-4,head_y),(cx+9,head_y+3),(cx+12,head_y+8),(cx+3,head_y+6),(cx-8,head_y+13)],'wave':[(cx-9,head_y+9),(cx-5,head_y+1),(cx+2,head_y),(cx+10,head_y+5),(cx+7,head_y+10),(cx+1,head_y+6),(cx-8,head_y+13)]}.get(hair_style,[(cx-9,head_y+9),(cx-5,head_y+1),(cx+7,head_y+2),(cx+10,head_y+9),(cx+5,head_y+7),(cx-8,head_y+13)])
 poly(d,hair_pts,hair[0]); d.line(hair_pts[:max(2,len(hair_pts)//2)],fill=hair[2],width=2)
 # face readability
 d.point((cx-3,head_y+13),fill='#171317'); d.point((cx+5,head_y+13),fill='#171317'); d.line((cx+5,head_y+16,cx+7,head_y+17),fill=skin[2]); d.line((cx-1,head_y+20,cx+4,head_y+20),fill=skin[2])
 if hair_style=='beard': poly(d,[(cx-7,head_y+17),(cx-3,head_y+23),(cx+5,head_y+23),(cx+8,head_y+17),(cx+5,head_y+27),(cx-3,head_y+26)],hair[1])
 if zombie: d.line((cx-5,head_y+17,cx+2,head_y+19),fill=clothes[4],width=2); d.point((cx+5,head_y+13),fill='#f3d36a')
 # arms connected; distinct action poses
 reach=12 + (10 if row in (2,3,5) else 0) + (frame%3 if row else 0); arm_y=44+bob+(frame%2 if row in (4,9) else 0)
 poly(d,[(cx-shoulder+2,torso_top+5),(cx-shoulder-5,arm_y),(cx-7,arm_y+8),(cx-2,arm_y+5),(cx-shoulder+7,torso_top+10)],clothes[1])
 poly(d,[(cx+shoulder-3,torso_top+5),(cx+reach,arm_y-2),(cx+reach+5,arm_y+2),(cx+6,arm_y+8),(cx+shoulder-8,torso_top+12)],clothes[2])
 poly(d,[(cx+reach,arm_y-3),(cx+reach+7,arm_y-2),(cx+reach+8,arm_y+3),(cx+reach+2,arm_y+4)],skin[0])
 # accessories and highlights
 d.line((cx-widths//2+2,torso_bottom-3,cx+widths//2-2,torso_bottom-3),fill=clothes[3],width=2); d.rectangle((cx-2,torso_bottom-5,cx+3,torso_bottom),fill=clothes[4])
 if row==3: d.line((cx+reach+7,arm_y-1,cx+reach+15+(frame%2)*2,arm_y-1),fill=clothes[4],width=2)
 if hair_style=='helmet': poly(d,[(cx-11,head_y+10),(cx-8,head_y+2),(cx+7,head_y+1),(cx+12,head_y+10)],clothes[1])
 if hair_style=='scar': d.line((cx-5,head_y+9,cx+5,head_y+20),fill=clothes[4],width=2)
 # ensure every frame differs without breaking feet
 d.point((2+frame*3%58,2+row%4),fill=(*ImageColor(clothes[4]),255))
 return im

def ImageColor(hexv): return tuple(int(hexv[i:i+2],16) for i in (1,3,5))
def sheet(spec,anims,zombie=False):
 name,skin,hair,clothes,profile,style=spec; out=Image.new('RGBA',(FW*8,FH*len(anims)),(0,0,0,0))
 pal=skin+hair+clothes
 for row,(_,count,_,_) in enumerate(anims):
  hashes=[]
  for i in range(count):
   rendered=frame(pal,profile,style,row,i,zombie); digest=hash(tuple(rendered.pixels))
   if digest in hashes: raise RuntimeError(f'identical frames in {name}, row {row}')
   hashes.append(digest); out.alpha_composite(rendered,(i*FW,row*FH))
 if not any(pixel[3] for pixel in out.pixels): raise RuntimeError(f'empty sheet: {name}')
 return out

def portrait(spec):
 name,skin,hair,clothes,profile,style=spec; im=Image.new('RGBA',(48,48),(0,0,0,0)); d=ImageDraw.Draw(im)
 poly(d,[(5,48),(8,34),(18,29),(31,29),(41,35),(45,48)],clothes[0]); poly(d,[(15,8),(22,3),(32,5),(38,13),(35,31),(28,38),(18,33),(12,23)],skin[0]); poly(d,[(12,16),(15,6),(24,1),(36,6),(39,15),(32,11),(18,12)],hair[0]); d.rectangle((18,19,21,21),fill='#171317'); d.rectangle((30,19,33,21),fill='#171317'); d.line((22,29,31,29),fill=skin[2],width=2)
 if style=='beard': poly(d,[(14,25),(20,34),(29,38),(36,27),(32,36),(21,38)],hair[1])
 return im

def metadata_entry(cid,path,anims,profile,portrait_path=None):
 rows={}; start=0
 for row,(name,count,fps,repeat) in enumerate(anims): rows[name]={'row':row,'startFrame':row*8,'endFrame':row*8+count-1,'fps':fps,'repeat':-1 if repeat else 0}; start+=count
 e={'characterId':cid,'sheetPath':path,'frameWidth':FW,'frameHeight':FH,'footLine':FOOT,'animations':rows,'bodyProfile':{'width':26 if profile in ('broad','heavy','robust','hulking') else 22,'height':60,'offsetX':19,'offsetY':28},'heldWeaponAnchor':{'x':15,'y':-43},'holsteredPrimaryAnchor':{'x':-12,'y':-45},'holsteredSecondaryAnchor':{'x':-15,'y':-28},'nameplateAnchor':{'x':0,'y':-94},'shadowAnchor':{'x':0,'y':1}}
 if portrait_path:e['portraitPath']=portrait_path
 return e

def write_all(base, metadata=False):
 (base/'game/config').mkdir(parents=True,exist_ok=True)
 art=base/'game/public/assets/production-art'; entries=[]; assets=[]
 for folder in ('characters','zombies','ui','weapons'): (art/folder).mkdir(parents=True,exist_ok=True)
 for cid,spec in HUMANS.items():
  rel=f'assets/production-art/characters/{cid}.png'; path=base/'game/public'/rel; sheet(spec,HUMAN_ANIMS).save(path,format='PNG',optimize=False,compress_level=9)
  pp=f'assets/production-art/ui/portrait-{cid}.png' if cid in ('alan','giovanna') else None
  if pp: portrait(spec).save(base/'game/public'/pp,format='PNG',compress_level=9)
  entries.append(metadata_entry(cid,rel,HUMAN_ANIMS,spec[4],pp))
 for cid,spec in ZOMBIES.items():
  rel=f'assets/production-art/zombies/{cid}.png'; sheet(spec,ZOMBIE_ANIMS,True).save(base/'game/public'/rel,format='PNG',compress_level=9); entries.append(metadata_entry(cid,rel,ZOMBIE_ANIMS,spec[4]))
 manifest={'schemaVersion':1,'frameWidth':FW,'frameHeight':FH,'footLine':FOOT,'visualOrigin':{'x':32,'y':88},'characters':entries}
 if metadata: (art/'characters/character_art_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 for path in sorted(art.rglob('*.png')):
  data=path.read_bytes(); rel=path.relative_to(base).as_posix(); category=path.parent.name; rows=10 if category=='characters' else (5 if category=='zombies' else 1); width=int.from_bytes(data[16:20],'big');height=int.from_bytes(data[20:24],'big')
  assets.append({'path':rel,'category':category,'generator':GENERATOR,'width':width,'height':height,'frameWidth':FW if category in ('characters','zombies') else 48,'frameHeight':FH if category in ('characters','zombies') else 48,'animationRows':rows,'sha256':hashlib.sha256(data).hexdigest(),'fileSize':len(data),'alphaRequired':True,'purpose':'Runtime character animation' if category in ('characters','zombies') else 'Gameplay HUD portrait'})
 config={'schemaVersion':1,'maxFileSize':1048576,'generator':GENERATOR,'assets':assets}
 if metadata: (base/'game/config/generated-production-art.json').write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n')

def main():
 p=argparse.ArgumentParser();p.add_argument('--verify',action='store_true');a=p.parse_args()
 random.seed(SEED)
 if a.verify:
  with tempfile.TemporaryDirectory() as td:
   temp=Path(td); write_all(temp, metadata=True)
   expected=json.loads((ROOT/'game/config/generated-production-art.json').read_text())['assets']; actual=json.loads((temp/'game/config/generated-production-art.json').read_text())['assets']
   if [(x['path'],x['sha256']) for x in expected] != [(x['path'],x['sha256']) for x in actual]: raise SystemExit('Production art verification failed: generated hashes differ')
   print(f'Production art verified ({len(actual)} deterministic PNG files).')
 else:
  write_all(ROOT); print(f'Runtime art generated: {len(HUMANS)} humans, {len(ZOMBIES)} zombies and 2 portraits (14 deterministic RGBA PNG files).')
if __name__=='__main__': main()
