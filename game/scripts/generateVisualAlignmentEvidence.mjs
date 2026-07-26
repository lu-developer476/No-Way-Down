import fs from 'node:fs';
import { VISUAL_ALIGNMENT } from '../src/config/visualAlignment.ts';

const weapons = Object.entries(VISUAL_ALIGNMENT.weapons);
const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const weaponPanel = ([key, profile], index) => {
  const col = index % 4, row = Math.floor(index / 4), x = 24 + col * 230, y = 58 + row * 142;
  const muzzleX = 76 + profile.muzzleOffset.x;
  const carryX = 76 + profile.carryOffset.x;
  return `<g transform="translate(${x} ${y})"><rect width="210" height="122" fill="#151c29" stroke="#526178"/>
  <text x="8" y="16">${esc(key)}</text><ellipse cx="76" cy="102" rx="23" ry="5" fill="#05070b"/>
  <rect x="64" y="34" width="24" height="68" fill="#64748b"/><rect x="68" y="25" width="16" height="16" fill="#d6a27f"/>
  <rect x="${carryX}" y="${76 + profile.carryOffset.y}" width="${Math.min(44, profile.muzzleOffset.x-profile.carryOffset.x+3)}" height="7" fill="#d5a83d"/>
  <path d="M${muzzleX} ${76 + profile.muzzleOffset.y}h12m-6-6v12" stroke="#facc15" stroke-width="3"/>
  <line x1="${muzzleX}" y1="${76 + profile.muzzleOffset.y}" x2="${muzzleX + 70}" y2="${76 + profile.muzzleOffset.y}" stroke="#fff" stroke-dasharray="3 4"/>
  <text x="8" y="116" fill="#94a3b8">carry ${profile.carryOffset.x},${profile.carryOffset.y} · muzzle ${profile.muzzleOffset.x},${profile.muzzleOffset.y}</text></g>`;
};
const weaponSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="500" viewBox="0 0 960 500"><style>text{font:12px monospace;fill:#e5e7eb}shape-rendering:crispEdges</style><rect width="960" height="500" fill="#090d15"/><text x="24" y="28" font-size="18">No Way Down — weapon alignment evidence</text>${weapons.map(weaponPanel).join('')}</svg>`;

const states = ['Alan quieto','Camina →','Camina ←','Primaria/secundaria','Cuerpo a cuerpo','Escalera','Daño','Muerte','Aliado disparando','Zombi caminando','Zombi muriendo'];
const statePanel = (label, index) => { const col=index%4,row=Math.floor(index/4),x=24+col*230,y=58+row*142; const dead=/Muerte|muriendo/.test(label), left=label.includes('←'); return `<g transform="translate(${x} ${y})"><rect width="210" height="122" fill="#151c29" stroke="#526178"/><text x="8" y="16">${esc(label)}</text><line x1="8" y1="104" x2="202" y2="104" stroke="#22c55e" stroke-width="2"/><ellipse cx="100" cy="102" rx="24" ry="5" fill="#05070b"/><g transform="translate(100 102) rotate(${dead?78:0}) scale(${left?-1:1} 1)"><rect x="-12" y="-68" width="24" height="68" fill="${label.includes('Zombi')?'#557547':'#64748b'}"/><rect x="-8" y="-77" width="16" height="16" fill="#d6a27f"/><rect x="7" y="-31" width="33" height="7" fill="#d5a83d"/><path d="M42-28h10m-5-5v10" stroke="#facc15" stroke-width="3"/></g><rect x="88" y="51" width="24" height="51" fill="none" stroke="#38bdf8" stroke-dasharray="3 2"/><text x="8" y="117" fill="#94a3b8">pies, sombra y cuerpo: y=104</text></g>`; };
const stateSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="500" viewBox="0 0 960 500"><style>text{font:12px monospace;fill:#e5e7eb}shape-rendering:crispEdges</style><rect width="960" height="500" fill="#090d15"/><text x="24" y="28" font-size="18">No Way Down — character state alignment evidence</text>${states.map(statePanel).join('')}</svg>`;
fs.writeFileSync(new URL('../docs/visual-validation/weapons.svg', import.meta.url), weaponSvg);
fs.writeFileSync(new URL('../docs/visual-validation/character-states.svg', import.meta.url), stateSvg);
console.log(`Generated ${weapons.length} weapon panels and ${states.length} state panels.`);
