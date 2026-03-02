Asset drop-in guide

Place licensed files here to upgrade visuals/audio without code changes.

Required/recognized paths:

- `audio/music/casino-lounge.mp3` (looped table music)
- `audio/sfx/war-drum.mp3` (war intro)
- `audio/sfx/card-hit.mp3` (war card placement)
- `audio/sfx/reveal.mp3` (war reveal)
- `audio/sfx/win.mp3` (player war win)
- `audio/sfx/lose.mp3` (dealer war win)
- `audio/sfx/push.mp3` (war push)
- `table/felt-noise.svg` (felt texture overlay)

Notes:

- If any file is missing, the app falls back to built-in synthesized audio and CSS visuals.
- Keep filenames exactly as listed unless you also update `lib/mediaAssets.ts`.
- Track the source/license for every third-party file in `THIRD_PARTY_ASSETS.md`.

