export interface NwdBuildInfo {
  readonly sha: string;
  readonly shortSha: string;
  readonly builtAt: string;
  readonly mode: string;
  readonly version: string;
}

declare global {
  const __NWD_BUILD_INFO__: NwdBuildInfo;
}

export const buildInfo: NwdBuildInfo = Object.freeze({ ...__NWD_BUILD_INFO__ });
