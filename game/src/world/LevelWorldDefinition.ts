export type EnvironmentRole = 'distant'|'structure'|'rearArchitecture'|'wall'|'rearDecor'|'playfieldDecor'|'prop'|'landmark'|'foreground'|'occluder'|'lightFixture'|'exitMarker'|'stairArchitecture';
export type ConnectorKind = 'door'|'stairUp'|'stairDown'|'stairLanding'|'officeAccess'|'garageRamp'|'vehicle'|'exteriorRoute'|'cinematicBoundary';
export type Facing = 'left'|'right';
export interface Bounds { x:number; y:number; width:number; height:number }
export interface WorldConnector { connectorId:string; kind:ConnectorKind; x:number; y:number; elevation:number; facing:Facing; sourceNodeId:string; destinationNodeId:string; destinationConnectorId:string; interactionId:string; transitionLabel:string; requiresObjectiveCompletion:boolean; canonicalTransitionReason:string }
export interface WalkableSurface extends Bounds { surfaceId:string; elevation:number }
export interface StairZone extends Bounds { stairId:string; lowerX:number; lowerY:number; upperX:number; upperY:number; direction:'ascending'|'descending'; allowsAllies:boolean; allowsEnemies:boolean; landingIds:readonly string[] }
export interface EnvironmentSector extends Bounds { sectorId:string; label:string; elevation:number }
export interface EnvironmentInstance { assetKey:string; x:number; y:number; originX:number; originY:number; scaleX:number; scaleY:number; flipX:boolean; alpha:number; depth:number; scrollFactorX:number; scrollFactorY:number; sectorId:string; role:EnvironmentRole; optionalVariant?:string; optionalLightAnchorId?:string }
export interface Anchor { id:string; x:number; y:number; elevation:number }
export interface SpawnZone extends Bounds { id:string; elevation:number }
export interface MinimapGeometry { kind:'interior'|'vertical'|'garage'|'exterior'; sectors:readonly Bounds[]; stairs:readonly { fromX:number; fromY:number; toX:number; toY:number }[] }
export interface LevelWorldDefinition {
  nodeId:string; runtimeLevelId:string; worldProfileId:string; locationId:string; locationLabel:string; floorId:string; floorLabel:string; elevationBase:number;
  worldWidth:number; worldHeight:number; cameraBounds:Bounds; entryConnectors:readonly WorldConnector[]; exitConnectors:readonly WorldConnector[];
  walkableSurfaces:readonly WalkableSurface[]; stairZones:readonly StairZone[]; platforms:readonly WalkableSurface[]; environmentalSectors:readonly EnvironmentSector[];
  environmentInstances:readonly EnvironmentInstance[]; foregroundInstances:readonly EnvironmentInstance[]; lightAnchors:readonly Anchor[]; objectiveAnchors:readonly Anchor[];
  enemySpawnZones:readonly SpawnZone[]; allySpawnAnchors:readonly Anchor[]; pickupAnchors:readonly Anchor[]; landmarkIds:readonly string[]; minimapGeometry:MinimapGeometry;
  rendererKind:'authored-level'; legacyBackground:false;
}
