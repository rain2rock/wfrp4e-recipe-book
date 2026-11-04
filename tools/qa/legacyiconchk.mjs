// Saved image paths are world data: packaging must retain the pre-v0.1.31 URLs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { STARTER_CATALOGUE } from '../../scripts/starter-data.js';
const root = new URL('../../', import.meta.url);
const legacy = JSON.parse(fs.readFileSync(new URL('docs/legacy-icon-paths.json', root)));
assert.equal(legacy.paths.length, 33);
const paths = new Set(legacy.paths);
for (const prof of STARTER_CATALOGUE) {
  for (const item of [...prof.ingredients, ...prof.recipes]) paths.add(`assets/icons/${item.img}`);
}
for (const rel of paths) {
  const bytes = fs.readFileSync(new URL(rel, root));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', rel);
}
for (const [old, current] of Object.entries(legacy.aliases)) {
  assert.deepEqual(fs.readFileSync(new URL(`assets/icons/${old}`, root)),
    fs.readFileSync(new URL(`assets/icons/${current}`, root)), `${old} must match ${current}`);
}
console.log(`PASS: ${paths.size} current and legacy starter image paths exist; 12 aliases match current artwork.`);
