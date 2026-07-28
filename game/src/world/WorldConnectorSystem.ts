import type { MappedConnector } from '../campaign/campaignProgression.ts';
export class WorldConnectorSystem {
  private readonly connectors: readonly MappedConnector[];
  constructor(connectors: readonly MappedConnector[]) { this.connectors=connectors; }
  setObjectiveRequirementSatisfied(satisfied:boolean):void {
    this.connectors.forEach((connector)=>{ connector.objectiveRequirementSatisfied=satisfied; });
  }
  nearest(x:number,y:number,maxDistance=160):MappedConnector|undefined {
    return this.connectors
      .filter((connector)=>connector.enabled && connector.objectiveRequirementSatisfied)
      .map((connector)=>({connector,distance:Math.hypot(connector.x-x,connector.y-y)}))
      .filter(({distance})=>distance<=maxDistance)
      .sort((a,b)=>a.distance-b.distance)[0]?.connector;
  }
  get ids(){return {entries:[] as string[],exits:this.connectors.map(c=>c.connectorId)};}
}
