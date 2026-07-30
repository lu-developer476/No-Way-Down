export interface NwdBuildInfo {
  readonly frontendSha: string; readonly branch: string; readonly buildId: string; readonly builtAt: string;
  readonly canonicalNodeCount: number; readonly generatedArtCount: number; readonly packageVersion: string;
  readonly sha: string; readonly shortSha: string; readonly mode: string; readonly version: string;
}
declare global { const __NWD_BUILD_INFO__: NwdBuildInfo }
export const buildInfo: NwdBuildInfo = Object.freeze({ ...__NWD_BUILD_INFO__ });
