export interface NwdBuildInfo { readonly sha: string; readonly shortSha: string; readonly builtAt: string; readonly mode: string; readonly version: string }
declare const __NWD_BUILD_INFO__: NwdBuildInfo
declare global { interface Window { __NWD_BUILD__?: Readonly<NwdBuildInfo> } }
export function publishBuildInfo(): Readonly<NwdBuildInfo> {
  const build = Object.freeze({ sha: __NWD_BUILD_INFO__.sha, shortSha: __NWD_BUILD_INFO__.shortSha, builtAt: __NWD_BUILD_INFO__.builtAt, mode: __NWD_BUILD_INFO__.mode, version: __NWD_BUILD_INFO__.version })
  window.__NWD_BUILD__ = build
  return build
}
