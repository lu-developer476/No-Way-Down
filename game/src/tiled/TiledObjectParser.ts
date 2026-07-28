import type { TiledObject, TiledProperty, TiledPropertyValue } from './TiledTypes.ts';
export class TiledDataError extends Error { readonly code:string; constructor(code:string,message:string){super(message);this.code=code;this.name='TiledDataError'} }
export class TiledObjectParser {
  static properties(properties: TiledProperty[]|undefined): Readonly<Record<string,TiledPropertyValue>> { return Object.freeze(Object.fromEntries((properties??[]).map(p=>[p.name,p.value]))) }
  static requiredString(properties: TiledProperty[]|undefined, name: string): string { const value=this.properties(properties)[name]; if(typeof value!=='string'||!value) throw new TiledDataError('MISSING_PROPERTY',`Required string property ${name} is missing`); return value }
  static runtimeId(object:TiledObject): string { return this.requiredString(object.properties,'runtimeId') }
}
