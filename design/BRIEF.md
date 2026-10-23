# Bloom Hop: creative brief

**In one sentence:** a top-down puzzle game where a little frog hops across a
pond, eating the fly on every lily pad before the pads sink, and the whole pond
bursts into bloom when it's done.

**The feeling:** cozy, clever, gently tense. Every hop is a small decision;
when a level clicks, it should feel like solving a crossword and then being
handed a bouquet. Never punishing: undo is free, and a dunk in the water is
funny, not harsh.

## Who, where, how long

- Anyone who likes short logic puzzles: casual players, families, puzzle fans.
- Desktop (keyboard or mouse) and phones (tap a pad or swipe), either
  orientation.
- 1 to 3 minutes a level, a dozen levels: about a 20 to 30 minute game, with a
  bonus generated "Wild Pond" mode for more.

## What the person asked for (the must-haves)

- Overhead view, a frog hopping pad to pad.
- Each pad takes only so many hops before it sinks.
- Goal: land on every pad; each pad has a fly on it.
- Music; about a dozen levels that get harder.
- Levels may be generated, but must always be beatable.
- Tongue to nudge enemies.
- Turtle pads that surface and sink; fish that come up with power-ups.
- On clearing a level: flowers all around bloom and the frog celebrates.

## Style references

No style was given. Chosen look: a soft, hand-painted storybook pond, like a
watercolor picture book seen from above. Warm, readable, friendly. Borrow the
calm pacing and tactile "click" of classic sliding and path puzzles (the
"visit every tile once" family). Copy no existing game's characters, art or
names.

## Settings and decisions made on the person's behalf

- Platform both, web target, medium scope, $20 budget, 2 review rounds (defaults).
- Name: **Bloom Hop**.
- Turn-based, grid puzzle (not real time), so every level can be proven
  solvable by a solver, and turtles dive on a fixed rhythm counted in hops.
- Levels are generated offline by a seeded generator that builds each level
  backwards from a real path, then a solver confirms it. The 12 main levels are
  hand-picked from that output and baked in, each with a stored solution.
- Free unlimited undo and restart instead of lives.
- Power-ups are always optional: every level is solvable without them.
