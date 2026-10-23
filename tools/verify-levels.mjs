// Check every main level and Wild Pond: the Rules guarantees, each main
// level's "must hold" checks, and that the stored solution wins in all 8
// symmetries. Writes design/solutions/. Exits non-zero on any failure.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { LEVELS } from '../game/src/levels.js';
import { WILD } from '../game/src/wild.js';
import { FIXTURES } from '../game/src/fixtures.js';
import * as R from '../game/src/rules.js';
import { solve } from '../game/src/solver.js';
import { ROWS, checkMust } from './make-levels.mjs';

const root = new URL('..', import.meta.url).pathname;
execFileSync('node', [root + 'tools/test-rules.mjs'], { stdio: 'inherit' });

let fails = 0;
const fail = (what, msg) => { fails++; console.log('FAIL', what + ':', msg); };

function guarantees(L, what) {
  const cells = new Set();
  const put = (x, y, kind) => {
    if (x < 0 || y < 0 || x >= L.w || y >= L.h) fail(what, `${kind} off the grid`);
    const k = x + ',' + y;
    if (cells.has(k)) fail(what, `two things in cell ${k}`);
    cells.add(k);
  };
  L.pads.forEach(([x, y, p]) => { put(x, y, 'pad'); if (p < 1 || p > 3) fail(what, `pad pips ${p}`); });
  (L.turtles || []).forEach(([x, y, up, down, ph]) => {
    put(x, y, 'turtle');
    if (up < 1 || up > 3 || down < 1 || down > 3 || ph < 0 || ph >= up + down) fail(what, 'turtle rhythm');
  });
  (L.fish || []).forEach(([x, y]) => put(x, y, 'fish'));
  (L.reeds || []).forEach(([x, y]) => put(x, y, 'reeds'));
  if ((L.beetles || []).includes(0)) fail(what, 'beetle on the start pad');
  for (let k = 0; k < 8; k++) {
    const T = R.transformLevel(L, k);
    try {
      const s = R.replay(T, R.parse(T.solution));
      if (s.status !== 'won') fail(what, `symmetry ${k}: solution ends ${s.status}`);
    } catch (e) { fail(what, `symmetry ${k}: ${e.message}`); }
  }
  const sv = solve(L);
  if (sv.solvable !== true) fail(what, 'solver: ' + sv.solvable);
  return sv;
}

const KEYS = { U: ['ArrowUp'], D: ['ArrowDown'], L: ['ArrowLeft'], R: ['ArrowRight'] };
const keysFor = tok => (tok[0] === 't' ? ['Shift+' + KEYS[tok[1]][0]] : KEYS[tok]);
mkdirSync(root + 'design/solutions', { recursive: true });

LEVELS.forEach((L, i) => {
  const what = `level ${i + 1}`;
  const sv = guarantees(L, what);
  const row = ROWS[i];
  const m = checkMust(L, row.must);
  if (m.length) fail(what, 'must hold: ' + m.join(', '));
  if (row.n === 7 && !(L.fish.length && L.fish[0][2] === 'mend')) fail(what, 'needs a mend fish');
  if (row.n === 10 && !L.fish.some(f => f[2] === 'leap')) fail(what, 'needs a leap fish');
  const tokens = R.parse(L.solution);
  writeFileSync(root + `design/solutions/level-${i + 1}.json`, JSON.stringify({ level: i + 1, tokens, keys: tokens.map(keysFor) }, null, 1));
  console.log(`${what} ok: ${L.pads.length} pads, rate ${L.rate}, solver nodes ${sv.nodes}`);
});
WILD.forEach((L, i) => guarantees(L, `wild ${i + 1}`));
console.log(`wild ponds checked: ${WILD.length}`);
// Fixtures with solutions must replay.
for (const [id, L] of Object.entries(FIXTURES)) {
  if (!L.solution) continue;
  try {
    const s = R.replay(L, R.parse(L.solution));
    if (['t-leap', 't-dead'].includes(id) && s.status !== 'won') fail(id, 'fixture solution ends ' + s.status);
  } catch (e) { fail(id, e.message); }
}
console.log(fails ? `${fails} failures` : 'all levels verified');
process.exit(fails ? 1 : 0);
