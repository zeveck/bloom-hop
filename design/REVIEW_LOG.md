# Design review log

## Round 1

Reviewers: Player, Builder, Art and sound director. Findings: 31 (9 must-fix, 18 should-fix, 4 nice). The refiner fixed all 31 (3 had no or partial evidence and were fixed as cheap insurance or judgment calls).

Main outcomes: an exact rules section (state, turtle formula, order of operations, tongue/wobble, fish, Long Leap target choice, token grammar); turtle dunk warnings; pips drawn in code at legible size; dead-state detection in a worker plus a solver-backed Hint; creatures generated inside the walk; Wild Pond pre-baked (150 ponds, unlock after level 8); open-water-only backgrounds with sunset and moon made as edits; frog-free square title; top-down koi; amber beetles; frog animations cut to 2 to 3 frames; frog-tongue cut; budget about $11.60.

Findings in detail: .gamegen/review/r1-*.md

## Round 2

Reviewers: Player (0 must-fix, 6 should-fix, 2 nice), Builder (1 must-fix, 5 should-fix, 1 nice), Art and sound director (0 must-fix, 6 should-fix, 1 nice). The refiner fixed all 22.

Main outcomes: the solver uses a global visited set (it was already patched in game/src/solver.js); the automatic dead banner was replaced by an on-demand Hint backed by the solver; gold means no Hint; Retry can be undone; pips under the frog move to a tab; the frog turns to face each move; dived turtles count down to surfacing; draw sizes are measured on the trimmed subject; pads are cooler jade, so the lime frog stands out; anim8gen gets an 80% reference; the title scene is built in code; music loop points are measured; the generator pip formula, flick-line reservation and turtle T+1 rule are fixed; per-level creature counts and a Wild Pond schedule were added; rule tests and debug fixtures were added.

Converged: the 2-round limit was reached, and every must-fix and should-fix finding from both rounds has been dealt with. The open items are notes for the build (Hint solver power option, move ordering), not design gaps.

## Final review

Playtester: 9 findings (no must-fix): bubble over the frog, how-to card cut off on phones, gift tip vanishing, pause menu not keyboard-navigable, landscape board too small, pause card padding, dived-turtle dots looking like pips, move count including undone moves, toast over the bottom row; plus the idea of a lotus opening on each pad as its fly is eaten. All done.

Bug hunter: 10 findings (2 must-fix: title menu off-screen on short landscape screens; a malformed save freezing the game). Also fixed: a buffered key skipping the bloom, Retry+Undo during the winning hop, Hint mid-hop, pause card height, overlays replacing pause, fanfare ignoring mute, music while paused, hint search surviving level changes. All re-tested with real input.
