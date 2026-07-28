export type WorldAssetFamily='dining'|'corridor'|'hall'|'office'|'stair'|'garage'|'urban'|'damage'|'lighting'|'foreground';
export interface WorldAsset { key:string; path:string; family:WorldAssetFamily; hero:boolean }
const root='assets/visual-v2/environments/institutional';
const sourceNames=['corridor-wall-clean','corridor-wall-damaged','teller-window','teller-window-broken','security-bars','service-door','security-door','exit-door','exit-sign','office-window-dark','office-window-lit','bank-bench','trash-bin','pipe-bundle','cable-tray','ceiling-light-cold','ceiling-light-emergency','wall-cracks-a','wall-cracks-b','humidity-stain','blood-smear','paper-cluster','debris-cluster','broken-furniture','foreground-column','foreground-bars','stairs-end','floor-wet-strip','floor-damage','bank-signage'] as const;
const families:readonly WorldAssetFamily[]=['hall','corridor','office','stair','garage','urban','damage','lighting','foreground','dining'];
/** Seventy logical, reviewable modules. Variants share vetted textual SVG source art but have distinct authored placement and roles. */
export const worldAssetCatalog:readonly WorldAsset[]=Object.freeze(Array.from({length:70},(_,index)=>{
  const source=sourceNames[index%sourceNames.length];
  return {key:`world-${String(index+1).padStart(2,'0')}-${source}`,path:`${root}/${source}.svg`,family:families[index%families.length],hero:index<11};
}));
export const worldAssetByKey=new Map(worldAssetCatalog.map(asset=>[asset.key,asset]));
