import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync,readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const repo=resolve(import.meta.dirname,'../..'),game=resolve(repo,'game');
const config=JSON.parse(readFileSync(resolve(game,'config/generated-production-art.json'),'utf8'));
const manifest=JSON.parse(readFileSync(resolve(game,'public/assets/production-art/characters/character_art_manifest.json'),'utf8'));
test('generated production art is ignored and no longer configured for LFS',()=>{
 const ignore=readFileSync(resolve(repo,'.gitignore'),'utf8');assert.match(ignore,/production-art\/\*\*\/\*\.png/);
 assert.equal(existsSync(resolve(repo,'.gitattributes'))?readFileSync(resolve(repo,'.gitattributes'),'utf8').includes('production-art'):false,false);
});
test('all expected runtime raster files are valid deterministic RGBA outputs',()=>{
 assert.equal(config.assets.length,28);for(const asset of config.assets){const bytes=readFileSync(resolve(repo,asset.path));assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(bytes[25],6);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256)}
});
test('every human and infected owns a distinct generated sheet',()=>{
 const expected=['alan','giovanna','nahir','damian','celestino','hernan','yamil','lorena','selene','zombie-guard','zombie-civil','zombie-advanced'];
 assert.deepEqual(manifest.characters.map((entry:{characterId:string})=>entry.characterId),expected);
 assert.equal(new Set(manifest.characters.map((entry:{sheetPath:string})=>entry.sheetPath)).size,expected.length);
 for(const entry of manifest.characters){assert.equal(entry.footLine,104);assert.equal(entry.frameWidth,80);assert.equal(entry.frameHeight,112)}
 assert.deepEqual(manifest.visualOrigin,{x:40,y:104});
});
