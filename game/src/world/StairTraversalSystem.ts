import type { StairZone } from './LevelWorldDefinition.ts';
export interface TraversalBody { x:number;y:number;setPosition(x:number,y:number):unknown }
interface ActiveTraversal {body:TraversalBody;zone:StairZone;progress:number;direction:1|-1}
export class StairTraversalSystem {
 private active=new Map<TraversalBody,ActiveTraversal>();
 private readonly zones:readonly StairZone[]; constructor(zones:readonly StairZone[]){this.zones=zones;}
 begin(body:TraversalBody,stairId:string,from:'lower'|'upper'):boolean{const zone=this.zones.find(value=>value.stairId===stairId);if(!zone||this.active.has(body))return false;body.setPosition(from==='lower'?zone.lowerX:zone.upperX,from==='lower'?zone.lowerY:zone.upperY);this.active.set(body,{body,zone,progress:from==='lower'?0:1,direction:from==='lower'?1:-1});return true;}
 update(deltaMs:number,speed=.00025):void{for(const state of this.active.values()){state.progress=Math.max(0,Math.min(1,state.progress+deltaMs*speed*state.direction));const {zone,progress}=state;state.body.setPosition(zone.lowerX+(zone.upperX-zone.lowerX)*progress,zone.lowerY+(zone.upperY-zone.lowerY)*progress);if(progress===0||progress===1)this.active.delete(state.body);}}
 isTraversing(body:TraversalBody):boolean{return this.active.has(body)}
 resolveFollower(body:TraversalBody,leader:TraversalBody,stairId:string):boolean{const zone=this.zones.find(value=>value.stairId===stairId);if(!zone)return false;const from=Math.abs(leader.y-zone.upperY)<Math.abs(leader.y-zone.lowerY)?'lower':'upper';return this.begin(body,stairId,from);}
 shutdown():void{this.active.clear();}
}
