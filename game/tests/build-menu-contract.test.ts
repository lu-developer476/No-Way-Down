import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuildInfo, resolveBuildSha } from '../build/buildInfoConfig.ts';
import { advanceMainMenuSetup, closeMainMenuSetup, inactiveMainMenuState, initialMainMenuState, openMainMenuSetup } from '../src/scenes/mainMenuState.ts';
import packageJson from '../package.json' with { type: 'json' };

const unknown = (): string => 'unknown';
test('build identity has exactly five keys and package version', () => { const info=createBuildInfo({},'test',new Date('2026-01-02T03:04:05Z'),unknown); assert.deepEqual(Object.keys(info).sort(),['builtAt','mode','sha','shortSha','version']); assert.equal(info.version,packageJson.version); assert.equal(new Date(info.builtAt).toISOString(),info.builtAt) });
test('build SHA priority and fallbacks are deterministic', () => { assert.equal(resolveBuildSha({NWD_BUILD_SHA:'nwd',GITHUB_SHA:'github',RENDER_GIT_COMMIT:'render'},unknown),'nwd'); assert.equal(resolveBuildSha({GITHUB_SHA:'github',RENDER_GIT_COMMIT:'render'},unknown),'github'); assert.equal(resolveBuildSha({RENDER_GIT_COMMIT:'render'},unknown),'render'); assert.equal(resolveBuildSha({},unknown),'unknown'); assert.equal(createBuildInfo({NWD_BUILD_SHA:'123456789'},'production',new Date(),unknown).shortSha,'1234567') });
test('menu diagnostic contract follows setup and shutdown lifecycle', () => { const initial=initialMainMenuState(); assert.equal(initial.ready,true); assert.equal(initial.selectedIndex,0); assert.equal(initial.setupVisible,false); let state=openMainMenuSetup(initial); assert.equal(state.setupStep,'protagonist'); state=advanceMainMenuSetup(state,'difficulty'); assert.equal(state.setupStep,'difficulty'); state=closeMainMenuSetup(state); assert.equal(state.setupStep,'closed'); assert.equal(state.setupVisible,false); assert.equal(inactiveMainMenuState(state).ready,false) });
