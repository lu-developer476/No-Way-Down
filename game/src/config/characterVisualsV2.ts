export type Point = Readonly<{ x: number; y: number }>;
export interface CharacterAttachmentContract {
  handOffset: Point; secondaryHandOffset: Point; muzzleOffset: Point;
  shellEjectionOffset: Point; nameplateOffset: Point; healthBarOffset: Point; shadowOffset: Point;
}
export const characterVisualsV2 = Object.freeze({
  alan: { texture: 'v2-alan', attachments: { handOffset:{x:8,y:-39},secondaryHandOffset:{x:18,y:-35},muzzleOffset:{x:39,y:-37},shellEjectionOffset:{x:15,y:-44},nameplateOffset:{x:0,y:-92},healthBarOffset:{x:0,y:-84},shadowOffset:{x:0,y:-4} } },
  giovanna: { texture: 'v2-giovanna', attachments: { handOffset:{x:7,y:-38},secondaryHandOffset:{x:17,y:-34},muzzleOffset:{x:38,y:-36},shellEjectionOffset:{x:14,y:-43},nameplateOffset:{x:0,y:-91},healthBarOffset:{x:0,y:-83},shadowOffset:{x:0,y:-4} } }
} satisfies Record<string, { texture:string; attachments: CharacterAttachmentContract }>);
