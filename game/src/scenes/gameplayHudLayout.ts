export type HudBounds={x:number;y:number;width:number;height:number};
export const GAMEPLAY_HUD_LAYOUT={
 playerHudBounds:{x:12,y:12,width:252,height:68},
 partyHudBounds:{x:12,y:86,width:252,height:50},
 minimapBounds:{x:772,y:12,width:176,height:96},
 objectiveToastBounds:{x:300,y:446,width:360,height:44},
 timerBounds:{x:360,y:12,width:240,height:32},
 interactionBounds:{x:280,y:494,width:400,height:34},
 dialogueBounds:{x:60,y:300,width:840,height:140}
} as const satisfies Record<string,HudBounds>;
export const boundsIntersect=(a:HudBounds,b:HudBounds)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
export function findHudIntersections(layout:Record<string,HudBounds>=GAMEPLAY_HUD_LAYOUT):string[]{const entries=Object.entries(layout),found:string[]=[];for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++)if(boundsIntersect(entries[i][1],entries[j][1]))found.push(`${entries[i][0]}:${entries[j][0]}`);return found;}
export const OBJECTIVE_TOAST_VISIBLE_MS=3500;
export const OBJECTIVE_TOAST_FADE_MS=300;
export const OBJECTIVE_COMPLETE_VISIBLE_MS=2000;
