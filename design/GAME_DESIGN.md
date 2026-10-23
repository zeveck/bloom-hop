# Bloom Hop

*Hop every pad, eat every fly, and make the whole pond bloom.*

## Pitch

You're a small green frog in a top-down pond. Hop from lily pad to lily pad,
eating the fly on each one, but every pad can only take so many hops before it
sinks behind you. Plan your route, flick beetles out of the way with your
tongue, time your hops on diving turtles, and when the last fly is gone the
whole pond bursts into flower.

## Settings

- Platform: both (desktop and phone, either orientation)
- Target: web (plain HTML and JavaScript, ES modules, no build step)
- Scope: medium (12 levels in 3 areas, plus a pre-baked bonus mode)
- Budget: $20 for generated art and audio (plan ≈ $10.60 including what is
  already spent; reserve ≈ $9.40, see Budget)
- Tools available: imagegen2 and anim8gen (OpenAI), nanogen (Gemini), audiogen
  (ElevenLabs; music confirmed working), playwright-cli for play-testing, node
  and Python + Pillow. No ffmpeg or sox.
- Already made: `game/assets/style-anchor.png` (frog, subject bbox 566x664 of
  1024, facing up), `game/assets/audio/music/mus-morning.mp3` (75 s),
  `game/src/rules.js`, `game/src/solver.js`.
- Decisions made on the player's behalf:
  - Turn-based grid puzzle, so solvability can be proven.
  - Levels are made offline in node by a seeded generator plus solver; the best
    12 are picked and baked in, each with a stored solution. Wild Pond ponds
    are pre-baked the same way (no generation in the browser).
  - Unlimited free undo and restart; no lives. Restart is itself undoable.
  - Power-ups are optional helpers; every level is solvable without them.
  - No always-on "this pond is dead" oracle: the Hint button checks on demand.
  - The name "Bloom Hop".

## The player's fantasy

A nimble, hungry little frog with a plan, tidying up a pond one hop at a time,
and then being rewarded with a pond full of flowers and a happy little dance.

## Core loop

- **10 seconds:** look at the pads within reach (they glow), pick one, the frog
  turns and hops, gulps the fly. Watch the pad you left lose a pip or sink.
- **1 minute:** find a route that lands on every pad before the ones you need
  sink. Get stuck, undo, spot the trick, finish. Pond blooms, frog celebrates.
- **Session:** 12 levels over three times of day (morning, sunset, moonlight),
  each area adding new pond creatures. A gold flower for a clear without
  hints. After level 8, the Wild Pond bonus.
- **The mechanic the game lives or dies by:** the hop rule plus sinking pads.
  It must be instantly readable which pads you can reach and how many hops
  each pad has left. The pip count is the strongest mark on every pad, and is
  never hidden under the frog.

## Rules (exact)

This section is the single source of truth. `game/src/rules.js` implements it;
the game, solver, generator and node tools all call `rules.js`.

### Board and level data

- Grid `w x h` (5x5 to 8x8). Coordinates: `x` grows right, `y` grows down,
  `(0,0)` top-left. Directions: `U` = y-1, `D` = y+1, `L` = x-1, `R` = x+1.
- Each cell is **water** or holds exactly one of: a **pad**, a **turtle**, a
  **fish spot**, or **reeds**. Fish spots and reeds behave exactly like water
  for every rule (hops and tongues pass over them). Decorative rocks live only
  outside the grid.
- Level format (also used for Wild Pond and debug fixtures):

```
{ id, name, area, w, h,
  pads:    [[x, y, pips], ...],          // pips 1..3; pads[0] is the start
  turtles: [[x, y, up, down, phase], ...], // up, down 1..3; phase 0..up+down-1
  beetles: [padIndex, ...],              // starting pads; never pads[0]
  fish:    [[x, y, "mend" | "leap"], ...],
  reeds:   [[x, y], ...],
  hint:    "one line or empty",
  solution:"R R tU U ..." }              // token grammar below
```

### State

`{ fx, fy, pips: int[] (per pad, 0 = sunk), flies: bitmask (pads with an
uneaten fly), beetles: padIndex[] (sorted), turn: int, slot: null | "mend" |
"leap", leapArmed: bool, fishUsed: bitmask, status: "play" | "won" |
"dunked" }`. `apply` may add a transient `gotFish` (fish index) to the
returned state so the game can animate the gift.

- Start: frog on `pads[0]`; `pips` from the level; every pad except `pads[0]`
  has a fly (pads under a beetle too; that fly can only be eaten after the
  beetle is moved); beetles from the level; `turn = 0`; slot empty; nothing
  armed; no fish used; status `play`.
- A pad is **floating** while `pips > 0`. A **free pad** is floating and has
  no beetle.
- **Turtle rhythm:** turtle `(up, down, phase)` is up at turn `T` exactly when
  `((T + phase) mod (up + down)) < up`. A turtle that is up is **surfaced**.
  `turtleHold(t, T)` = how many consecutive turns after `T` it stays up (the
  number of moves it will hold you if you land on it at `T`; 0 = a dunk).
- **Landable cell** (at the current turn): a free pad, or a surfaced turtle.
- A **move** in the player's words is any turn-costing action (hop, flick,
  leap). Turtle rhythms count moves, not just hops.

### Moves

A move is one of: **hop**, **flick**, **Mend**, **arm Leap**, **cancel
Leap**, **leap**. Hops, flicks and leaps cost a turn; the power-up actions
don't. Every move (including power-up actions) is one undo step.

**Hop `d`** (not allowed while Leap is armed). Look at cells 1, 2, 3 steps
from the frog in direction `d`, nearest first:
- off the grid: stop, the hop is illegal;
- a floating pad **with a beetle**: stop, the hop is illegal (blocked);
- a landable cell: that is the target; stop;
- anything else (water, fish spot, reeds, a sunk pad, a dived turtle): pass
  over it and keep looking.
If nothing is found in 3 cells, the hop is illegal. So the frog always lands
on the **first** thing it can stand on in that line.

**Flick `d`** (tongue; not allowed while Leap is armed). Look at cells 1..3
from the frog in direction `d` for the first cell holding a **beetle**; the
tongue passes over everything else (pads, water, turtles). If none, there is
no flick. If a beetle is found at cell `B`, look at cells 1..3 beyond `B` in
the same direction: the first **floating** pad found is the destination. If
that pad is free, the beetle moves there and the flick is legal. If there is
no floating pad within 3 cells, or the first floating pad already has a
beetle, the flick is **not a move** (a "wobble"): nothing changes, no turn
passes, nothing goes on the undo stack. `apply` throws on a wobble; the game
calls `flickInfo` first and plays the wobble animation and sound itself.
Beetles never land on turtles, water or sunk pads.

**Mend** (slot = mend, frog on a pad with pips < 3, Leap not armed): that pad
gets +1 pip; slot empties. Not allowed on a turtle or on a 3-pip pad (button
greyed).

**Arm Leap** (slot = leap, at least one leap target exists): `leapArmed =
true`. **Cancel Leap** (armed): `leapArmed = false`, the power-up stays in
the slot.

**Leap `d n`** (armed). Leap targets in direction `d` are all landable cells
1..6 steps away (passing over anything, beetle pads included; stopping at the
grid edge), numbered `1, 2, ...` from nearest. First the slot empties and
`leapArmed = false`; then the frog moves to target `n` exactly like a hop
(so a fish next to the landing pad can refill the now-empty slot).

### Order of operations for a turn-costing move (at turn T)

1. Legality is checked against the state at turn `T` (turtles as at `T`).
2. Hop / leap: if the frog is leaving a pad, that pad loses 1 pip (at 0 it
   sinks). Leaving a turtle costs nothing. The frog moves to the target. If
   the target pad has a fly, it is eaten. Then **fish**: if the target is a
   **pad** (not a turtle) orthogonally next to an unused fish spot and the
   slot is empty, the lowest-index such fish gives its power-up to the slot
   and becomes used. If the slot is full, nothing happens and the fish stays
   unused for a later landing.
   Flick: the beetle moves (frog, pips and flies unchanged).
3. `turn = T + 1`.
4. **Win:** if no flies remain, status = `won`.
5. **Dunk:** if the frog is on a turtle that is not surfaced at `T + 1`,
   status = `dunked`. A dunked state takes only Undo or Retry.

(Turtles hold no flies, so a winning move always ends on a pad and the order
of 4 and 5 never matters.)

A **dunk move** is a legal move whose result is `dunked`: landing on a turtle
that is not up at `T+1`, or flicking while standing on a turtle that is not
up at `T+1`. The game allows dunk moves (after a warning, see Controls); the
solver, generator and random player never use them.

### Win, stuck

- **Won:** status `won` (all flies eaten). The final pad keeps its pips.
- **Stuck:** status `play`, flies remain, Leap is not armed, and there is no
  legal hop, flick or leap that isn't a dunk move, Mend isn't usable, and Leap
  can't be armed (`isStuck` in `rules.js`). Shows the "Stuck!" card.
- There is no automatic "dead" detection. Whether a pond can still be finished
  is only checked when the player presses Hint (see Avoiding frustration).

### Solution token grammar

A solution is a string of tokens separated by single spaces:
`U D L R` (hop), `tU tD tL tR` (flick), `M` (Mend), `E` (arm Leap),
`X` (cancel Leap), `JUn JDn JLn JRn` (leap to target `n`, 1-based, such as
`JR2`). Stored solutions for main levels and Wild Ponds use only hops and
flicks (they are verified without power-ups). `rules.js` exports
`parse(string) → tokens` and `apply(level, state, token) → new state`, which
throws on an illegal token (including a wobble).

### Generated level guarantees (checked by `verify-levels.mjs`)

Every pad 1..3 pips; no cell holds two things; beetles only on non-start
pads; the stored solution replays to `won` with no dunk, in all 8
mirror/rotation symmetries; the solver confirms solvable **with power-ups
disabled**; the level's "must hold" checks pass (see Structure).

## Controls

**Desktop**

| Action | Keyboard | Mouse |
|---|---|---|
| Hop | Arrows or WASD | Click a glowing pad or turtle |
| Tongue flick | Shift + arrow, or Space then a direction within 1 s (any other key cancels the Space) | Click a beetle with a tongue marker |
| Use power-up | E (or Q): Mend applies; Leap arms, E again cancels | Power-up button |
| Leap (armed) | Arrow picks the nearest leap target that way, same arrow again moves to the next one, Enter or Space jumps | Click a gold-glowing target |
| Undo | Z, U or Backspace | Undo button |
| Retry (undoable) | R | Retry button |
| Hint | H | Hint button |
| Pause | Esc or P | Pause button (top corner) |
| Mute | M | Sound button (top corner) |
| Skip the bloom | Any key | Click |
| Menus | Arrows + Enter / Space | Click |

**Phone (touch)**

| Action | Touch |
|---|---|
| Hop | Tap a glowing pad, or swipe in a direction anywhere on the board |
| Tongue | Tap a beetle with a tongue marker |
| Leap (armed) | Tap a gold-glowing target (a swipe jumps to the nearest one that way) |
| Undo, Power-up, Hint, Retry | Button bar outside the board, 64 CSS px minimum each, semi-transparent. Portrait: bottom bar, left to right Undo, Power-up, Hint, Retry. Landscape: right-side bar, bottom to top Undo, Power-up, Hint, Retry (Undo nearest the thumb, Retry farthest from it) |
| Pause, Mute | Small top-corner buttons |

- **Taps never surprise.** Tapping a pad that isn't a hop target never moves
  the frog anywhere else: it plays the "nope" croak and flashes what's in the
  way (the pad you'd land on instead, or the blocking beetle). The same flash
  shows for an illegal arrow or swipe.
- **Turtle warning.** The first hop toward a turtle that would dunk you (red
  ring) doesn't hop: the frog wobbles and says "You'll get wet!". The same
  input again within 2 s does the dunk (it's funny, and undo is free). The
  same applies to a flick while standing on a turtle that would dive.
- **Retry is undoable.** Retry pushes the level's start state onto the undo
  stack as one step and shows a toast "Fresh pond! Undo to go back." The
  first Undo after a Retry returns to exactly where you were.
- **Hint bubbles never eat input.** While a start-of-level bubble is shown,
  any board input both dismisses it and acts; only a tap on the bubble itself
  just dismisses it.
- Either orientation works: the board is square and the HUD goes on the long
  side. A tap is a press that moves less than 12 px. All controls are inside
  the safe area. One input during an animation is buffered.

## Structure and difficulty

Three areas of four levels, each with its own time of day and song. Board size
and pad count grow; the random-player win rate (Tech plan) falls inside each
level's band. If no candidate lands in a band within the time budget, the
closest is taken and logged.

Turtles are written `up/down`. Phases are chosen by the generator.

| # | Name | Area | Size | Pads | Turtles | Beetles | Fish | What's new | Win-rate band | Must hold (verify) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | First Hops | Morning Pond | 5x5 | 5 | | | | Hop, eat flies | 100% (one path) | exactly 1 solution |
| 2 | Long Jump | Morning Pond | 5x5 | 7 | | | | Hops over water, first pad in line | 50-90% | a solution hop of 2+ cells |
| 3 | Sturdy Pads | Morning Pond | 6x6 | 8 | | | | 2-pip pads | 30-60% | a 2-pip pad |
| 4 | Morning Maze | Morning Pond | 6x6 | 10 | | | | 3-pip pads; sunk pads open long hops | 15-35% | a 3-pip pad; solution hops over a sunk pad |
| 5 | Turtle Crossing | Sunset Marsh | 6x6 | 8 | 1 (2/2) | | | Turtles | 30-60% | unsolvable with turtles removed |
| 6 | Beetle Bother | Sunset Marsh | 6x6 | 10 | | 1-2 | | Beetles and the tongue | 25-50% | unsolvable without flicks |
| 7 | Fishy Friends | Sunset Marsh | 6x6 | 11 | | | 1 mend | Fish and Mend Leaf | 20-45% | the fish is next to a pad the solution lands on in its first half |
| 8 | Marsh Medley | Sunset Marsh | 7x7 | 12 | 1 (2/1) | 1 | | Turtles + beetles together | 8-20% | unsolvable with turtles removed; unsolvable without flicks |
| 9 | Moonrise | Moonlit Lagoon | 7x7 | 13 | | | | Breather: bigger, pads only | 15-30% | |
| 10 | Shell Game | Moonlit Lagoon | 7x7 | 13 | 2 (2/2, 3/1) | | 1 leap | Two rhythms; Long Leap fish | 5-12% | unsolvable with turtles removed |
| 11 | Beetle Ballet | Moonlit Lagoon | 7x7 | 15 | | 2 | | A beetle moved twice | 3-8% | unsolvable without flicks; stored solution flicks one beetle twice |
| 12 | Full Bloom | Moonlit Lagoon | 8x8 | 16 | 1 (2/2) | 2 | 1 mend | Everything; the finale | under 2% | unsolvable with turtles removed; unsolvable without flicks |

"Unsolvable without flicks" uses `solve(..., { noFlick: true })`.

**Hint bubbles** (one line from the frog, tap to dismiss; never eat input):
- At level start: 1 "Hop to every pad and eat every fly!", 2 "You always land
  on the first pad in line.", 3 "The dots show how many more hops a pad can
  take!", 4 "Sunk pads can be hopped over!", 5 "The ring shows how many moves
  a turtle will hold you. Red means it dives as you land!", 6 "Flick beetles
  away with your tongue!", 7 "Land next to a ripple to meet a fish!",
  10 "Two turtles, two rhythms. Watch the rings!".
- When the first power-up of a kind arrives (any level, once per save):
  Mend "That fish left you a gift! Press E or tap it to mend this pad.";
  Leap "A gold feather! Press E or tap it to leap far."
- Level 7's layout puts the fish on the obvious early route and a 1-pip
  bottleneck where Mend clearly helps.

**Avoiding frustration:** free undo, undoable retry, reachable pads glow, the
last pip blinks when the frog stands on a 1-pip pad, doomed turtles are red
and don't glow, dived turtles count down to surfacing, and the **Hint** button
(always in the bar). It pulses softly after 45 s without a fly being eaten.
Pressing Hint:
- If Leap is armed, Hint first cancels it. If dunked, Hint does Undo.
- Otherwise the solver (power-ups on, worker, 300,000-node cap) runs from the
  current state while a small ripple spins on the button. Board input stays
  live; any move cancels the pending hint.
  - **Solvable:** it plays the next move of the solver's path (with a gold
    flash on the target).
  - **Proven dead:** "This pond can't be finished from here. Let's hop back!"
    It undoes back to the latest state in the history that is not proven
    dead (checked newest first, 1,000,000 nodes in total; a cap hit counts
    as not proven dead), never further than the level start (always
    solvable). The undo steps are normal undo steps.
  - **Unknown (cap hit):** falls back to the stored solution: if the moves of
    the current attempt are a prefix of it, it plays the next token;
    otherwise "Tricky! Want a fresh pond?" with a Retry button.

**Wild Pond (bonus, unlocks after level 8 is cleared):** 150 pre-baked
verified ponds, generated in node by `tools/make-wild.mjs` and shipped in
`src/wild.js`. Shows "Pond #n". Schedule:

| Ponds | Size | Pads | Creature types | Win-rate band |
|---|---|---|---|---|
| #1-50 | 6x6 | 8-10 | at most 1 (turtle, beetles or fish) | 30-60% |
| #51-100 | 7x7 | 10-13 | up to 2 | 10-25% |
| #101-150 | 7x7 or 8x8 | 12-16 | any | 3-12% |

Within each block ponds are sorted by measured win rate, highest first. After
#150 it continues with the same ponds transformed: pond #n uses base pond
`((n-1) mod 150) + 1` with symmetry `floor((n-1) / 150) mod 8`
(`transformLevel` in `rules.js`, solution tokens transformed to match), so
it's effectively endless. Until level 10 is cleared every Wild Pond fish gives
Mend instead of Leap (safe, since solutions never use power-ups).

## Win, lose and progress

- **Win a level:** last fly eaten. The bloom plays (any key or tap skips it),
  then the "Pond in Bloom!" card: flies eaten, moves, and a gold flower if
  earned. Next, Replay, or Levels.
- **Gold flower:** the winning attempt used no Hint. Undo, Retry, dunks and
  power-ups are all fine. Each history entry remembers whether its attempt
  has used a Hint; Retry starts a fresh attempt (gold possible again), and
  undoing a Retry brings back the old attempt's flag. A small gold bud in the
  HUD dims quietly when a Hint is used, so you always know.
- **Win the game:** clearing level 12 shows the victory screen: bg-moon with
  lotus blooms (code-composed), the frog celebrating, the count of gold
  flowers, and the Wild Pond button.
- **Lose:** there's no game over, only the "Stuck!" or "Dunked!" cards (Undo,
  Retry).
- **Saved** in localStorage (`bloomhop-save`, version 1, try/catch): levels
  cleared, gold flowers, furthest level, Wild Pond best number, music and
  sound mute, how-to-play seen, power-up gift hints seen.

## Screens

- **Title:** composed in code: bg-morning drawn "cover", a ring of pad-3 and
  lotus sprites around the border, reeds in two corners, the frog (idle)
  below the centre, and the game name (bundled font) drawn in code over the
  clear centre. Play (continue), Levels, Wild Pond (locked until level 8),
  How to Play, sound toggle. "Tap or press any key" starts the audio. Petals
  and dragonflies drift.
- **How to play:** three cards composed in code from the game sprites with
  code-drawn text (hop and pips; flies and win; creatures and power-ups),
  swipe or arrows to page.
- **Level select:** 12 pads (pad-3 sprite) in a winding row across bg-morning,
  numbered in code. Locked: lotus bud, dimmed. Cleared: pink lotus. Gold
  clear: lotus tinted gold with a sparkle. One level ahead unlocks at a time.
  Music: mus-morning.
- **Gameplay HUD:** top: level number and name, fly counter (fly sprite x n),
  gold bud, Pause and Mute in the corner. Button bar: Undo, Power-up slot,
  Hint, Retry.
- **Pause:** Resume, Retry, Levels, music and sound toggles. Auto-pause when
  the page is hidden.
- **Level complete:** the bloom over the pond, then the card.
- **Stuck / Dunked:** small card over a dimmed board: Undo, Retry.
- **Toasts:** a slim line at the top of the board for "Fresh pond! Undo to go
  back." and the Hint messages; they fade after 3 s.
- **Victory:** described above. Music: mus-moon.
- **Rotate prompt:** not needed.

## Juice

Must-haves:
- Facing: at take-off of a hop, leap or flick the frog turns to face that
  direction (90° steps, ~80 ms ease) and keeps that facing while idle. The
  anchor art faces up (`U` = 0°, `R` = 90° clockwise).
- Hop arc: the frog switches to the stretched frame, scales up mid-hop with a
  soft shadow below, squash on take-off and landing.
- Pad bob and a water ripple ring on landing; a splash of droplets.
- Fly gulp: the fly zips to the frog's nose, a "+1" pop, the counter ticks
  with a bounce.
- Pad losing a pip: the pip pops off; pad sinking: tips, shrinks and fades
  with bubbles; 2 px screen shake.
- Glow on reachable pads, pulsing gently (cream); leap targets glow gold.
- The bloom: lotus flowers on empty water cells and around the board edge
  open one after another in a wave outward from the frog, petals drift, light
  warms up, a chime per flower (pitch rising), then the frog's celebration and
  a happy croak. About 4 s; 2 s in Wild Pond; any input skips to the card.
- Sound on every action (see Audio).

Should-haves:
- Tongue: a pink tongue shoots from the frog's nose (front centre of the sit
  frame's bbox, rotated with the facing) and snaps back; the beetle skitters
  with little ripples. A wobble on a blocked flick.
- Turtle: the ring ticks down each move with a tick sound; diving: bubbles
  and a slow sink to a dark silhouette; surfacing: a swell ring.
- Fish leap: the koi arcs out of its ripple (scale up, shadow, splash); the
  power-up bubble floats to the slot.
- Dunk: the frog plops in (squash, blue tint, ripple), pops back up dripping,
  a cartoon "blub". 2 px shake.
- Floating petals and dragonflies on the title screen.
- Water shimmer (slow animated highlight over the background).

## Art direction

- **Style line (paste into every image prompt; it describes the anchor):**
  "cute storybook illustration, top-down view, thick clean dark olive
  outlines, flat simple shapes with fine grainy gouache speckle texture,
  cream rim highlights, warm natural palette, soft even lighting, cute and
  friendly, no text"
- **Sprite add-on (every sprite prompt):** "bold simple shapes, strong
  silhouette, readable at 48 pixels, seen from directly above, single centered
  subject isolated on a transparent background, no shadows, no ground".
- **Style anchor (done):** `game/assets/style-anchor.png`, the frog top-down,
  sitting, facing up, lime/yellow-green with dark green spots and cream sides,
  subject bbox 566x664 of 1024. It is the reference image for every later
  imagegen2 sprite and (via `frog-ref.png`) every anim8gen frame. It is
  **not** passed to nanogen (nanogen treats `--image` as content to edit).
- **Palette:** pond teal #3f8f92, deep water #1f5560, pad jade #3f8a5a (pad
  body) with rim #6fae7f, dark leaf #2e6b34, frog lime (as the anchor,
  ≈ #81944a mean), lotus pink #f08aa8, cream #fff4dc, fly black #2a2a30,
  beetle amber #d9663a, turtle shell warm brown/ochre #a8743a, sunset amber
  #f2a65a, moonlit indigo #2b3566. Pads must be a cooler, deeper jade than the
  yellow-green frog; acceptance: the frog is clearly distinct from its pad on
  every area background.
- **Sprite sizing:** every sprite is trimmed (Pillow) to its alpha bounding
  box plus a 2% margin before downscaling; an animation's frames are all
  trimmed with the union box of its frames, so they share one scale and
  pivot. `assets/sprites/sprites.json` records each sprite's size and pivot
  (frog: the centre of the sit frame's body bbox; others: the image centre).
  **Draw sizes in the asset list are the subject's longest side in cells.**
  For the frog, the scale is set so the sit frame's subject is 0.62 cell; the
  stretch and celebrate frames use the same scale.
- **Readability rules (cells are about 44 CSS px on an 8x8 board on a phone):**
  - Pips are drawn in code, never in art: 1 to 3 cream dots with a dark
    outline, each at least max(9 CSS px, 0.18 cell), drawn above everything
    except UI. Where they go:
    - pad with a fly: in a row across the lower part of the pad;
    - pad with the frog on it: in a small cream-edged tab hugging the pad's
      lower rim, outside the frog (the frog stands 0.06 cell above the pad's
      centre so its silhouette ends above the tab in every facing);
    - empty pad (fly eaten, no frog): the dots grow and move to the centre.
    Worn pad art is a secondary cue only.
  - Fly: small, dark body with big pale wings and a code buzz. Beetle: shiny
    amber/red-orange shell with a cream highlight, 0.5 cell; a beetle's pad is
    dimmed and never glows; its fly circles the beetle, small.
  - Pads: round, centred, one notch in the same place; pad-2 and pad-1 are
    imagegen2 edits of pad-3 keeping the outline.
  - Turtles: surfaced, a code ring with filled dots = moves it will hold you
    (`turtleHold`), red ring = would dunk you. Dived: a code-drawn dark
    silhouette with a light edge, a slow ripple ring and hollow dots = moves
    until it surfaces.
  - The board gets a soft code vignette that darkens the water under the grid
    slightly so sprites pop.
- **Areas, one look:** bg-morning is made first; bg-sunset and bg-moon are
  nanogen edits of it (same composition, only light and colour change). The
  area overlay (morning none, sunset amber, moon blue) applies fully to the
  background, at about 15% (multiply plus a rim light) to sprites, and never
  to UI, pips, glows or flies. Moonlit water is no darker than #2b3566; the
  moon area adds code-drawn fireflies.
- **Backgrounds:** open water only: no pads, flowers, reeds, creatures,
  ripples or text; low contrast in the middle, soft detail (shallows, stones)
  toward the edges. Square, drawn "cover" so either orientation crops only the
  edges. Acceptance: a 390x844 screenshot of level 12 on each area with every
  sprite and pip readable.
- **Camera:** straight top-down.
- **Resolution:** the canvas fills the window at devicePixelRatio; everything
  is laid out in cell units. Sprites are made at 1024, trimmed, and downscaled
  so the longest side is 256 px (frog frames, pads, turtle, fish, reeds) or
  128 px (the rest), drawn smoothed.
- **Frog animations (anim8gen):** first make `frog-ref.png` with Pillow: the
  anchor scaled to 80% and centred on a fresh transparent 1024 canvas, so a
  legs-out stretch frame has room. Pass it as anim8gen's canonical reference
  (first `--image`, reference cleanup off) for every frog animation, with a
  body-centre anchor (top-down sprite, not a grounded side view). anim8gen's
  aligned sit frame (frame 0) is also the static frog sprite, so all frog
  images share one scale and pivot.

## Audio direction

- **Music** (instrumental). Each looping track has a `loopStart`/`loopEnd`
  (seconds) in `audio.js`, used on the AudioBufferSourceNode so it loops
  sample-accurately; a short crossfade only when the area changes.
  `loopEnd` is picked by decoding the track in the browser through
  playwright (Web Audio `decodeAudioData`, RMS per 0.5 s window): the last
  window before the level drops below 70% of the track's median, rounded down
  to a bar if the beat is clear. Listen to the seam once in the play-test.
  - Morning Pond (done, 75 s; also the title and level select): light, plucky
    marimba, acoustic guitar and flute, cheerful and calm.
  - Sunset Marsh: warmer, mellow, a lazy shuffle with soft clarinet and
    pizzicato strings.
  - Moonlit Lagoon (also victory): dreamy, music-box and harp, soft pads.
  - Prompts for the two new loops end with: "no intro, no ending, no
    fade-out, steady to the last bar".
  - Bloom fanfare: a 5 s celebratory sting (not looped).
- **Effects** (audiogen sfx; its minimum is 0.5 s, so short sounds are trimmed
  and faded in Web Audio): hop (springy boing-whoosh), land (soft wet plop),
  gulp (cute munch), pip pop and pad sink (bubbly bloop; the pop is the sink
  pitched up), nope (short low croak; also the "You'll get wet!" warning,
  pitched up), tongue flick (quick wet thwip), beetle scuttle (tiny clicky
  skitter; the wobble is the scuttle pitched down), turtle tick (soft wooden
  tock), turtle dive (bubbles), turtle surface (water swell), fish leap
  (splash), power-up get (sparkly chime), power-up use (magic whoosh), dunk
  (big comic splash plus blub), undo (soft rewind swish; also Retry), stuck
  (gentle "hmm" two-note; also "pond can't be finished"), bloom chime (bright
  bell, pitch-shifted per flower in code; also level unlock and the hint
  flash), happy croak (celebration ribbit), UI click (soft wooden tap; also
  the counter tick and the frog's turn). 19 generated effects.
- **Ambience (nice):** three `sfx --loop` beds, quiet under the music:
  morning birds and water, sunset crickets, night frogs.

## Asset list

Draw size is the subject's longest side on screen, in board cells (one cell
is about 44 CSS px on a phone at 8x8), after trimming (see Sprite sizing).

| ID | What it is | Tool | Size and format | Draw size | Transparent | Animation | Priority |
|---|---|---|---|---|---|---|---|
| style-anchor | Frog top-down, sitting, facing up (done) | imagegen2 (high) | 1024 PNG | (source only) | yes | | done |
| frog-ref | Anchor at 80% on a fresh 1024 canvas | code (Pillow) | 1024 PNG | (reference only) | yes | | must |
| frog | Static frog = anim8gen aligned sit frame | anim8gen (frame 0 = reference) | trimmed → 256 PNG | 0.62 cell (sit subject) | yes | rotates to facing | must |
| frog-hop | Frames: sit + full stretch from directly above, legs out behind | anim8gen (1 new frame) | 256 PNG frames | same scale as frog | yes | 2 frames; arc, squash, shadow in code | must |
| frog-celebrate | Frames: sit + front feet raised wide, body lifted, eyes open + same pose with happy closed ^^ eyes and a cream chin crescent | anim8gen (2 new frames) | 256 PNG frames | same scale (×1.2 in bloom) | yes | 3 frames 8 fps; bounce, spin, petals in code | must |
| frog-idle | Frames: sit + eyes closed (blink) | anim8gen (1 new frame) | 256 PNG frames | same scale | yes | 2 frames; breathing bob in code | should |
| pad-3 | Lush round lily pad, one notch, cool deep jade body #3f8a5a, lighter rim | imagegen2 (high, anchor ref) | trimmed → 256 PNG | 0.9 cell | yes | bob in code | must |
| pad-2 | Slightly worn pad (edit of pad-3, same outline) | imagegen2 edit (high) | 256 PNG | 0.9 cell | yes | | must |
| pad-1 | Worn, yellowing, torn pad (edit of pad-3, same outline) | imagegen2 edit (high) | 256 PNG | 0.9 cell | yes | | must |
| fly | Small dark fly, big pale wings, top-down | imagegen2 (high, anchor ref) | trimmed → 128 PNG | 0.3 cell (HUD 24 px) | yes | buzz in code | must |
| turtle | Turtle top-down, flat warm brown/ochre shell (a stepping stone) | imagegen2 (high, anchor ref) | trimmed → 256 PNG | 0.9 cell | yes | dive/surface in code | must |
| beetle | Shiny amber water beetle, cream highlight, top-down | imagegen2 (high, anchor ref) | trimmed → 128 PNG | 0.5 cell | yes | wiggle in code | must |
| fish | Koi from directly above, C-curve mid-leap | imagegen2 (high, anchor ref) | trimmed → 256 PNG | 0.75 cell (1.0 at peak) | yes | leap arc in code | must |
| pu-mend | Power-up: glowing leaf | imagegen2 (high, anchor ref) | trimmed → 128 PNG | 0.45 cell; slot 48 px | yes | | must |
| pu-leap | Power-up: golden spring feather | imagegen2 (high, anchor ref) | trimmed → 128 PNG | 0.45 cell; slot 48 px | yes | | must |
| lotus-bud | Closed lotus bud | imagegen2 (high, anchor ref) | trimmed → 128 PNG | 0.5 cell | yes | | must |
| lotus-pink | Open pink lotus | imagegen2 (high, anchor ref) | trimmed → 128 PNG | 0.55 cell | yes | open tween in code | must |
| lotus-white | Open cream lotus | imagegen2 (high, anchor ref) | trimmed → 128 PNG | 0.55 cell | yes | | should |
| reeds | Reed clump top-down | imagegen2 (high, anchor ref) | trimmed → 256 PNG | 0.9 cell | yes | sway in code | should |
| rock | Mossy rock (outside the grid) | imagegen2 (high, anchor ref) | trimmed → 128 PNG | 0.7 cell | yes | | nice |
| dragonfly | Dragonfly top-down (title) | imagegen2 (high, anchor ref) | trimmed → 128 PNG | 0.45 cell | yes | wing flutter in code | nice |
| bg-morning | Open pond water, morning, square | nanogen Pro | 1:1 2K → 1024 JPG | cover | no | shimmer in code | must |
| bg-sunset | Edit of bg-morning: sunset light | nanogen Pro edit | 1:1 2K → 1024 JPG | cover | no | | must |
| bg-moon | Edit of bg-morning: moonlight | nanogen Pro edit | 1:1 2K → 1024 JPG | cover | no | | must |
| app-icon | Square icon: frog face on a pad | imagegen2 (high, anchor ref) | 1024 PNG | | no | | must |
| icons | favicon, 192, 512, maskable, apple-touch from app-icon | code (Pillow) | PNG | | | | must |
| title | Title scene: bg-morning + pads, lotus, reeds, frog + title text | code | | cover | | petals, dragonflies | must |
| social-card | 1200x630 composed in HTML from bg-morning, sprites and title text, screenshot | code | JPG | | | | must |
| font | Rounded friendly font (Fredoka or Baloo 2, OFL) | bundled | woff2 + OFL.txt | | | | must |
| pips | Cream dots with dark outline, blink, pop; frog-pad tab | code | | ≥ max(9 px, 0.18 cell) each | | | must |
| glow | Reachable-pad glow (cream), leap-target glow (gold), red warn ring, hint flash | code | | | | pulse | must |
| turtle-ring | Ring with filled dots (moves it holds you), red when doomed; dived silhouette with hollow dots (moves until it surfaces) | code | | 1.0 cell | | tick | must |
| water-fx | Ripple rings, droplets, bubbles, shimmer, vignette, area overlay | code | | | | | must |
| fish-spot | Ripple marking a fish spot (used: calm) | code | | 0.8 cell | | | must |
| pu-bubble | Power-up bubble floating to the slot | code (+ pu sprite) | | | | | must |
| tongue | Pink tongue from the frog's nose, tongue marker and beetle-destination arrow | code | | | | | must |
| ui | Buttons (undo, power-up, hint, retry, pause, sound), cards, toasts, hint bubble, "+1" pop, gold bud, hint spinner ripple | code | | 64 CSS px bar buttons | | | must |
| petals, fireflies | Drifting petals (bloom, title), moon fireflies | code | | | | | must |
| screens | How-to-play cards, level select, victory (composed from the sprites above) | code | | | | | must |
| gold-flower | lotus-white (or pink) tinted gold + sparkle | code | | | | | must |
| mus-morning | Morning Pond / title / level select (done) | audiogen music | 75 s mp3 | | | loop (loopEnd measured) | done |
| mus-sunset | Sunset Marsh | audiogen music | 75 s mp3 | | | loop | must |
| mus-moon | Moonlit Lagoon / victory | audiogen music | 75 s mp3 | | | loop | must |
| mus-bloom | Bloom fanfare | audiogen music | 5 s mp3 | | | once | must |
| sfx (19) | The 19 effects in Audio direction | audiogen sfx | 0.5 to 2 s mp3, trimmed in code | | | | must: hop, land, gulp, sink, nope, flick, dunk, bloom, croak, click; should: the rest |
| amb (3) | Morning, sunset, night beds | audiogen sfx --loop | 20 s mp3 | | | loop | nice |

Totals still to make: 16 imagegen2 images (15 sprites + icon), 4 new
anim8gen frames in 3 animations, 3 nanogen images, 3 music tracks, 19 sound
effects, 3 ambience beds. Done: style anchor, mus-morning.

## Tech plan

```
game/
  index.html, manifest.webmanifest, sw.js, icons, social-card.jpg
  fonts/        bundled font + OFL.txt
  assets/       style-anchor.png, frog-ref.png, sprites/ (+ sprites.json),
                items/, bg/, ui/, audio/music, audio/sfx
  src/
    main.js         boot, loop, screens state machine
    rules.js        (built) the Rules section: prep, initState, cloneState,
                    turtleUp, turtleHold, hopTarget, flickInfo, leapTargets,
                    canMend, canArmLeap, apply, tryApply, legalMoves,
                    isDunkMove, isStuck, fliesLeft, stateKey, parse, replay,
                    transformLevel
    solver.js       (built) DFS solver, solution counter, random player,
                    mulberry32
    solve-worker.js module Web Worker wrapping solver.js for Hint
    levels.js       the 12 baked levels + debug fixture levels
    wild.js         the 150 baked Wild Ponds
    render.js       drawing the pond, pads, pips, frog, effects
    input.js        keyboard, pointer, swipe → actions
    audio.js        Web Audio: music loops (loopStart/loopEnd), sfx, mute
    ui.js           screens, buttons, cards, toasts
    save.js         localStorage
tools/
  test-rules.mjs    tiny hand-made fixtures, one or more per Rules bullet
  generator.mjs     seeded walk generator (uses rules.js and solver.js)
  make-levels.mjs   runs the generator per level row, prints stats, writes src/levels.js
  make-wild.mjs     writes src/wild.js (schedule above)
  verify-levels.mjs checks every level and Wild Pond (Rules guarantees + table,
                    all 8 symmetries); writes design/solutions/level-<n>.json;
                    exits non-zero on failure
  sprites.py        Pillow: frog-ref, trim/union-trim, downscale, sprites.json, icons
design/ASSETS.md    every generated asset with tool, prompt, cost; prices with
                    their date (imagegen2 high: ≈ $0.061 with one reference,
                    ≈ $0.053 without, OpenAI model page, 2026-10-23)
```

- **Rules are pure** and shared, so the game plays exactly what was verified.
  States are plain objects copied on apply; undo is a stack of states (each
  entry also stores its attempt's "hint used" flag; Retry pushes the start
  state).
- **Generator: creatures are part of the walk.** Before the walk, pick the
  size, the pad target and the creature counts from the level's row, and the
  turtles with their cells and `(up, down, phase)`. Then build a sequence of
  steps from the start pad, keeping a draft level and a live state (at turn
  `T`):
  - **hop:** pick `d` and a distance `k` (1..3). Every cell passed must be
    water-to-be, a turtle that is down at `T`, or an existing pad that can be
    **closed** (its departures so far already equal its final pips, so it is
    sunk now; it is never landed on again, never the final pad, never a beetle
    destination). Cells passed are marked "stays water". The target is an
    existing open pad, a new pad on a cell not marked "stays water" or
    "no new pad", or a turtle that is up at `T` **and** `T + 1`. Track each
    pad's departures.
  - **flick:** never while the frog is on a turtle. Only when a pad within 3
    in some direction, with nothing but passable cells between, can hold a
    beetle: either a beetle already there, or a new beetle on a pad never
    landed on or passed over and not on a cell marked "no new beetle". The
    destination is the first floating pad beyond it within 3; it must be a pad
    whose fly is already eaten and that has been left at most twice. Mark the
    cells strictly between the frog and the beetle "no new beetle", and the
    cells strictly between the beetle and the destination "no new pad, no new
    beetle". Count the flick's beetle as sitting on the destination.
  - **Pips**, computed from the step list: `pips = departures + 1` if the pad
    must still float after its last departure (it is the final pad, or a
    beetle sits on it at the end, or a beetle is flicked onto it after its
    last departure), otherwise `pips = departures`. Must be 1..3; any step
    that would push a pad's projected pips above 3 is rejected and retried.
  - **End:** new pads stop at the pad target; the walk ends when the pad
    target is reached **and** every pad except the start (beetle start pads
    included) has been landed on. A walk that can't continue is dropped.
  - Fish are placed next to pads the walk lands on (not changing anything
    else). Reeds go on cells marked "stays water" or untouched.
  - **The replay is the authority:** the whole step list is replayed with
    `rules.js` from the finished level; any mismatch (a different landing, an
    illegal step, a dunk, not won) rejects the candidate. Then the solver
    confirms it's solvable with power-ups off, and the level's "must hold"
    checks run. Rejections are counted by reason in the log.
  - Seeded (`mulberry32(seed)`); time budget 60 s per main level and 30 min for
    all Wild Ponds; logs candidates tried, acceptance rate, rejection reasons
    and node counts.
- **Solver:** DFS over safe moves (no dunk moves) with one global **visited
  set**: a state's key is added when it is first expanded and any state whose
  key is already in the set (including one on the current path) is not
  expanded again. This is complete for reachability and can't loop on
  turtle-to-turtle hops. State key = `stateKey` (frog cell, pips, flies,
  sorted beetles, `turn mod L` with L = lcm of the turtle periods, slot,
  leapArmed, fishUsed). Move order: fly-eating moves first, hops before
  flicks. With power-ups on (Hint only) the moves are hops, flicks, `M`, and
  a Leap macro `E J<d><n>` (two tokens, one step); `E` and `X` are never
  generated on their own. Node cap 2,000,000 in node (cap hit = reject),
  300,000 per Hint request in the browser (cap hit = "unknown").
  **Solution counting** (L1 needs exactly 1) stops at 1000 and is only used on
  levels with no turtles or beetles (it has no cycle guard). **Random
  player:** uniform over safe hops and flicks, no power-ups, 1000 playouts,
  each capped at 200 moves (a capped playout counts as a loss); win rate =
  difficulty.
- **Difficulty pick:** for each main level, generate candidates at its row's
  size and creatures, keep those in the win-rate band that pass its checks,
  prefer readable layouts (pads spread out, few long dead straight lines),
  bake the best with its solver solution.
- **Hint worker:** `solve-worker.js` (module Web Worker, in the sw precache).
  Each request carries a sequence number; the main thread ignores any reply
  whose number isn't the latest. A new request or any move while one is
  running terminates the worker and starts a fresh one. Results are cached
  in a Map by state key (so undo/redo never reads a stale answer). If the
  worker can't start, the check runs synchronously with a 50,000-node cap and
  a cap hit counts as unknown.
- **Game loop:** requestAnimationFrame, fixed 60 Hz update for animations,
  clamped frame gaps; the puzzle is turn-based, a move applies at once in
  rules and its animation plays; one input during an animation is buffered.
- **Scaling:** full-window canvas at devicePixelRatio; layout computes the
  square board rect and HUD/button areas for portrait vs landscape; recompute
  on resize and orientationchange; safe-area insets respected.
- **Input:** one layer mapping keyboard, pointer taps (hit-test cells,
  beetles, buttons, bubble) and swipes to actions; "just pressed" buffering;
  the Space flick prefix lasts 1 s and is cancelled by any other key.
- **Audio:** Web Audio, decoded AudioBuffers; music loops with per-track
  loopStart/loopEnd, crossfade on area change; started on the first input;
  short sfx played as trimmed slices with a 20 ms fade; music and sound mute
  (M mutes both), saved.
- **Install/offline:** manifest + sw.js from the template (slug `bloomhop-`);
  the precache lists every module including `solve-worker.js`.
- **Debug hook:** `window.__game` with
  - `state()`: `{ screen, mode ("main" | "wild" | "fixture"), level, pond,
    frog: {x, y}, facing, fliesLeft, turn, busy, complete, gameWon, stuck,
    dunked, hint (null | "pending" | "move" | "back" | "unknown"), undos,
    hintsUsed, goldPossible, powerup, leapArmed }`
  - `levels()`, `goToLevel(n | fixtureId)`, `solution(n)` (the token string),
    `wildPond(n)`, `wildSolution()`, `audioState()` (incl. current track and
    its loop points).
  - Fixture levels (debug only, never in level select), each finished with a
    short key sequence: `t-leap` (get a leap from a fish, arm, pick, cancel,
    leap), `t-dunk` (warning then dunk, undo), `t-stuck` (one hop to the
    Stuck card), `t-dead` (one hop into a dead state; Hint hops back),
    `t-fish` (fish gift with a full slot, then with an empty one).
- **Solution replay:** `design/solutions/level-<n>.json` holds `{ level,
  tokens, keys }`, where each token maps to real keys: `U` → ArrowUp (etc.),
  `tU` → Shift+ArrowUp. The play-test goes to the level, presses each
  token's keys, waits until `state().turn` has gone up and `busy` is false
  (3 s timeout), and checks `complete` at the end.

## Cut list

In order:
1. Ambience beds.
2. Dragonfly sprite and rock decoration (code petals only).
3. frog-idle animation (code bobbing and a code blink).
4. Reeds (code-drawn ripples instead).
5. lotus-white (tint the pink one; gold from pink).
6. Separate music and sound toggles (one mute).
7. Hint's solver worker (Hint uses only the stored-solution rule: next token
   if the attempt is a prefix, otherwise offer Retry).
8. Long Leap power-up (keep Mend Leaf only; level 10's fish gives Mend).
9. Wild Pond mode (keep the 12 levels).
10. A shared music track for two areas.

Never cut: hop and pips, flies, the bloom celebration, turtles, the tongue and
beetles, fish with at least one power-up, 12 solvable levels, music, undo and
undoable retry, a Hint button of some kind.

## Budget estimate

Prices: imagegen2 (gpt-image-2.5-flare) looked up on OpenAI's model page
2026-10-23: high quality 1024² ≈ $0.061 with one reference image (1756 output
tokens × $30/M + 1024 input image tokens × $8/M), ≈ $0.053 without; counted
here as $0.07 to cover a second input image on edits. anim8gen frames are
imagegen2 calls with the reference: $0.07. nanogen from its skill: Pro 1K/2K
$0.134; Flash 1K is listed as both $0.034 and $0.067 in the skill (lines 153
and 406), so $0.067 is used. audiogen from its skill: music ~$0.30/min, sfx
~$0.12 per generation. All sprites at high quality. Record actual spend per
asset in `design/ASSETS.md`.

| Item | Count × tries × price | Estimate |
|---|---|---|
| Already spent: style anchor + mus-morning (estimate; ASSETS.md has the actual) | | $0.65 |
| imagegen2 sprites + icon (high, anchor ref) | 16 × 2.5 × $0.07 | $2.80 |
| anim8gen frames (high, with reference) | 4 × 3 × $0.07 | $0.84 |
| nanogen Pro finals (bg-morning + 2 edits) | 3 × 2 × $0.134 | $0.80 |
| nanogen Flash drafts | 4 × $0.067 | $0.27 |
| music (sunset, moon, bloom) | 155 s × 1.5 tries ≈ 3.9 min × $0.30 | $1.16 |
| sfx | 19 × 1.5 tries ≈ 29 × $0.12 | $3.48 |
| ambience | 3 × 1.5 tries ≈ 5 × $0.12 | $0.60 |
| **Total** | | **≈ $10.60, so reserve ≈ $9.40 of the $20** |

At $16 (80%) get thrifty; stop at $20 and use the cut list.

## Definition of done

- [ ] Starts with no console errors at desktop (1280x800) and phone (390x844
      portrait, 844x390 landscape) sizes.
- [ ] `tools/test-rules.mjs` passes: fixtures for every Rules bullet (first
      pad in line, blocked by beetle, pip loss and sinking, turtle rhythm and
      `turtleHold`, dunk, flick and wobble with `apply` throwing, fish order
      and full slot, Mend limits, Leap arm/cancel/targets and the fish refill
      after a leap, stuck), plus a solver test on a turtle-cycle level that
      returns without looping.
- [ ] `tools/verify-levels.mjs` passes: every main level and Wild Pond meets
      the Rules guarantees and its "must hold" checks, solvable with
      power-ups off, stored solution replays to won in all 8 symmetries;
      solutions written to `design/solutions/`.
- [ ] Every one of the 12 levels is completed by replaying its stored
      solution with real key presses, and the game can be won (victory
      screen). Wild Ponds #1, #75, #150, #151 and #1000 replay to complete.
- [ ] Rules match the design in play, checked with the fixture levels:
      nearest-pad hop, blocked beetle, pip loss and sinking, turtle ring
      (filled and hollow dots) and dunk warning, flick and wobble (no turn),
      fish gives a power-up once, Mend and Long Leap (arm, choose, cancel) by
      key and button, frog faces each hop and flick.
- [ ] Stuck card, Dunked card, undo, undoable retry (Undo after Retry
      restores the position) and all three Hint outcomes work (`t-dead` hops
      back); a move during a pending Hint cancels it; nothing gets stuck.
- [ ] Hop by arrows, WASD, click, tap and swipe; tongue by Shift+arrow, Space
      then arrow, and tapping a beetle; a tap on a non-target pad never moves
      the frog; the first board tap while a hint bubble shows still acts.
- [ ] A 390x844 screenshot of level 12 in each area shows every pip
      (including the tab under the frog), fly, beetle and turtle ring clearly
      readable, the frog clearly distinct from its pad; backgrounds have no
      pad-like shapes.
- [ ] Music plays per area after the first input and loops without an
      audible gap or fade at the seam; effects play; mute works and is
      remembered.
- [ ] The bloom plays on every level clear and can be skipped.
- [ ] Progress (cleared levels, gold flowers, Wild Pond best) saved and
      restored on reload.
- [ ] Installs as an app and works offline (`?sw=1`), Hint included.
