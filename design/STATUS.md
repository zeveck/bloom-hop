# Bloom Hop: progress

## Request (as typed)

/gg:gamegen Make an overhead puzzle game in which you're a frog hopping from lilipad to lilipad and each one can only handle so many hops before it sinks and the goal is to hop on every lilipad, perhaps each one has a fly on it or something, and there's music and maybe a dozen level that get harder as you go. They can be generated, but, should always be possible to beat. You could also use your tongue to nudge enemies or something. There could also be turtle pads that surface and sink or fish that come up and give you power ups. When you hop to every lilipad flowers around the level all bloom and you celebrate before moving on.

## Settings

- Platform: both (desktop + phone) · Target: web · Scope: medium · Budget: $20 · Rounds: 2
- Game folder: /workspaces/dc-test (it was essentially empty)
- Available: OpenAI (imagegen2, anim8gen) ok, Gemini (nanogen) ok, ElevenLabs (audiogen) ok (restricted key; the person confirmed a paid plan, so no ElevenLabs credit is needed), node, Python + Pillow (installed this run), playwright-cli

## Phases

- [x] Brief: BRIEF.md written (Bloom Hop, turn-based grid puzzle, cozy storybook pond)
- [x] Design: GAME_DESIGN.md, 12 levels in 3 areas + Wild Pond bonus, ~23 images, 3 anims, 4 music, 17 sfx, est $11-14
- [x] Design review: 2 rounds, 53 findings all dealt with (REVIEW_LOG.md); re-read as the requester, still their game
- [x] Art, animation, audio: 17 sprites + icon, 3 backgrounds, 3 frog animations, 4 music, 19 sfx, 3 ambience; about $5.68 (ASSETS.md)
- [x] Build: rules/solver/generator, 12 levels + 150 Wild Ponds verified (tools/verify-levels.mjs), full game in game/src (not a git repo, so no commits)
- [x] Play-test: all 12 levels by real keys, level 6 by touch (taps, swipes, beetle tap), fixtures (dunk, stuck, retry-undo, dead+hint, leap, fish), wild #1/#75/#150/#151/#1000, title/howto/pause/mute/save, desktop + phone portrait/landscape, no console errors
- [x] Final review: playtester (9 findings) and bug hunter (10 findings), all fixed and re-tested; all 12 levels replayed again
- [x] Wrap up: social card, README, Pages workflow, served at http://localhost:8123

## Notes

- Early work done during review (rules are exact, so safe to start):
  - Style anchor accepted: game/assets/style-anchor.png (imagegen2, 2 tries)
  - mus-morning made (75 s): game/assets/audio/music/mus-morning.mp3
  - game/src/rules.js, solver.js (cycle-safe), generator.js (walk with creatures; tested: l1-l12 configs produce valid, solver-confirmed levels)
