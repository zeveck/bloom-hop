// Generate the 12 main levels: run the walk generator for each level row,
// keep candidates that pass the row's checks and land in its win-rate band,
// and write game/src/levels.js. Usage: node tools/make-levels.mjs [levelNumber]
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { generateCandidate } from '../game/src/generator.js';
import { solve, countSolutions, randomWinRate, mulberry32 } from '../game/src/solver.js';
import { parse, initState, apply, DIRS } from '../game/src/rules.js';

export const ROWS = [
  { n: 1, name: 'First Hops', area: 'morning', cfg: { w: 5, h: 5, pads: 5, pSink: 1 }, band: [1, 1],
    hint: 'Hop to every pad and eat every fly!', must: ['unique'] },
  { n: 2, name: 'Long Jump', area: 'morning', cfg: { w: 5, h: 5, pads: 7, pSink: 1, reeds: 2 }, band: [0.5, 0.9],
    hint: 'You always land on the first pad in line.', must: ['longHop'] },
  { n: 3, name: 'Sturdy Pads', area: 'morning', cfg: { w: 6, h: 6, pads: 8, pSink: 0.6, reeds: 3 }, band: [0.3, 0.6],
    hint: 'The dots show how many more hops a pad can take!', must: ['pip2'] },
  { n: 4, name: 'Morning Maze', area: 'morning', cfg: { w: 6, h: 6, pads: 10, pSink: 0.45, reeds: 3 }, band: [0.15, 0.35],
    hint: 'Sunk pads can be hopped over!', must: ['pip3', 'overSunk'] },
  { n: 5, name: 'Turtle Crossing', area: 'sunset', cfg: { w: 6, h: 6, pads: 8, pSink: 0.8, turtles: 1, rhythms: [[2, 2]], reeds: 3 }, band: [0.3, 0.6],
    hint: 'The ring shows how many moves a turtle will hold you. Red means it dives as you land!', must: ['needTurtles'] },
  { n: 6, name: 'Beetle Bother', area: 'sunset', cfg: { w: 6, h: 6, pads: 10, pSink: 0.6, beetles: 1, reeds: 3 }, band: [0.25, 0.5],
    hint: 'Flick beetles away with your tongue!', must: ['needFlicks'] },
  { n: 7, name: 'Fishy Friends', area: 'sunset', cfg: { w: 6, h: 6, pads: 11, pSink: 0.6, fish: 1, fishGives: ['mend'], reeds: 2 }, band: [0.2, 0.45],
    hint: 'Land next to a ripple to meet a fish!', must: [] },
  { n: 8, name: 'Marsh Medley', area: 'sunset', cfg: { w: 7, h: 7, pads: 12, pSink: 0.6, turtles: 1, rhythms: [[2, 1]], beetles: 1, reeds: 4 }, band: [0.08, 0.2],
    hint: '', must: ['needTurtles', 'needFlicks'] },
  { n: 9, name: 'Moonrise', area: 'moon', cfg: { w: 7, h: 7, pads: 13, pSink: 0.5, reeds: 4 }, band: [0.15, 0.3],
    hint: '', must: [] },
  { n: 10, name: 'Shell Game', area: 'moon', cfg: { w: 7, h: 7, pads: 13, pSink: 0.6, turtles: 2, rhythms: [[2, 2], [3, 1]], fish: 1, fishGives: ['leap'], reeds: 3 }, band: [0.05, 0.12],
    hint: 'Two turtles, two rhythms. Watch the rings!', must: ['needTurtles'] },
  { n: 11, name: 'Beetle Ballet', area: 'moon', cfg: { w: 7, h: 7, pads: 15, pSink: 0.55, beetles: 2, flickTwice: true, reeds: 3 }, band: [0.03, 0.08],
    hint: '', must: ['needFlicks'] },
  { n: 12, name: 'Full Bloom', area: 'moon', cfg: { w: 8, h: 8, pads: 16, pSink: 0.55, turtles: 1, rhythms: [[2, 2]], beetles: 2, fish: 1, fishGives: ['mend'], reeds: 4 }, band: [0, 0.02],
    hint: '', must: ['needTurtles', 'needFlicks'] },
];

// Hops in the stored solution: distance of each, and whether it passed a sunk pad.
function hopStats(L) {
  let s = initState(L), longHop = false, overSunk = false;
  for (const t of parse(L.solution)) {
    const n = apply(L, s, t);
    if (DIRS[t]) {
      const dist = Math.abs(n.fx - s.fx) + Math.abs(n.fy - s.fy);
      if (dist >= 2) longHop = true;
      const [dx, dy] = DIRS[t];
      for (let k = 1; k < dist; k++) {
        const x = s.fx + dx * k, y = s.fy + dy * k;
        const pi = L.pads.findIndex(p => p[0] === x && p[1] === y);
        if (pi >= 0 && s.pips[pi] === 0) overSunk = true;
      }
    }
    s = n;
  }
  return { longHop, overSunk };
}

export function checkMust(L, must) {
  const fails = [];
  const hs = hopStats(L);
  for (const m of must) {
    if (m === 'unique' && countSolutions(L).count !== 1) fails.push(m);
    if (m === 'longHop' && !hs.longHop) fails.push(m);
    if (m === 'overSunk' && !hs.overSunk) fails.push(m);
    if (m === 'pip2' && !L.pads.some(p => p[2] === 2)) fails.push(m);
    if (m === 'pip3' && !L.pads.some(p => p[2] === 3)) fails.push(m);
    if (m === 'needTurtles' && solve({ ...L, turtles: [] }).solvable !== false) fails.push(m);
    if (m === 'needFlicks' && solve(L, undefined, { noFlick: true }).solvable !== false) fails.push(m);
  }
  return fails;
}

// Prefer pads spread over the board: mean distance to the nearest other pad.
function spread(L) {
  let t = 0;
  for (const a of L.pads) {
    let m = 99;
    for (const b of L.pads) if (a !== b) m = Math.min(m, Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]));
    t += m;
  }
  return t / L.pads.length;
}

export function search(row, { seed = row.n * 1000 + 7, seconds = 60, log = console.log } = {}) {
  const rng = mulberry32(seed);
  const t0 = Date.now();
  const reasons = {};
  let tried = 0, best = null;
  const [lo, hi] = row.band, mid = (lo + hi) / 2;
  while (Date.now() - t0 < seconds * 1000) {
    tried++;
    const r = generateCandidate(row.cfg, rng);
    if (r.fail) { reasons[r.fail] = (reasons[r.fail] || 0) + 1; continue; }
    const L = r.level;
    const sv = solve(L);
    if (sv.solvable !== true) { reasons.solver = (reasons.solver || 0) + 1; continue; }
    const fails = checkMust(L, row.must);
    if (fails.length) { reasons['must:' + fails[0]] = (reasons['must:' + fails[0]] || 0) + 1; continue; }
    const rate = randomWinRate(L, rng, 300);
    const inBand = rate >= lo && rate <= hi;
    const score = (inBand ? 0 : 10 + Math.abs(rate - mid) * 10) - spread(L) * 0.3;
    if (!best || score < best.score) best = { L, rate, score, inBand, nodes: sv.nodes };
    // Enough: a good in-band candidate after a reasonable search.
    if (best.inBand && tried > 3000 && Date.now() - t0 > seconds * 300) break;
  }
  log(`level ${row.n}: tried ${tried}, best rate ${best && best.rate.toFixed(3)} inBand ${best && best.inBand}, ` +
    `nodes ${best && best.nodes}, ${((Date.now() - t0) / 1000).toFixed(1)} s, rejects ${JSON.stringify(reasons)}`);
  return best;
}

function levelOut(row, L, rate) {
  return {
    id: row.n, name: row.name, area: row.area, w: L.w, h: L.h,
    pads: L.pads, turtles: L.turtles, beetles: L.beetles, fish: L.fish, reeds: L.reeds,
    hint: row.hint, solution: L.solution, rate: Math.round(rate * 1000) / 1000,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[2] ? Number(process.argv[2]) : null;
  const path = new URL('../game/src/levels.js', import.meta.url).pathname;
  let levels = [];
  if (existsSync(path)) {
    const txt = readFileSync(path, 'utf8');
    const m = txt.match(/export const LEVELS = (\[[\s\S]*?\]);\n/);
    if (m) levels = JSON.parse(m[1]);
  }
  for (const row of ROWS) {
    if (only && row.n !== only) continue;
    const best = search(row);
    if (!best) { console.log(`level ${row.n}: NO CANDIDATE`); continue; }
    const rate = randomWinRate(best.L, mulberry32(99), 1000);
    levels[row.n - 1] = levelOut(row, best.L, rate);
  }
  const body = '// Generated by tools/make-levels.mjs; verified by tools/verify-levels.mjs.\n' +
    'export const LEVELS = ' + JSON.stringify(levels) + ';\n';
  writeFileSync(path, body);
  console.log('wrote', path);
}
