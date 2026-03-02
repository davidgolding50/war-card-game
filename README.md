# WAR Card Game (Next.js + TypeScript + Tailwind)

Single-page web app for classic WAR (player vs computer).

## Run locally

```bash
cd "/Users/davidgolding/Documents/Playground/War Game"
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Test game engine

```bash
npm test
```

## Architecture

- `lib/war.ts`: Pure deterministic classic WAR engine.
- `lib/casinoWar.ts`: Casino War wagering engine (buy-in, ante, surrender/go-to-war).
- `lib/mediaAssets.ts`: Central asset path registry for music/SFX/textures.
- `lib/war.test.ts` + `lib/casinoWar.test.ts`: Engine tests.
- `app/page.tsx`: Casino War UI + cinematic war sequence + audio system.
- `app/layout.tsx` + `app/globals.css`: App shell and table styling.

## Asset Pipeline (Graphics + Audio)

Drop licensed files into `public/assets` using this guide:

- `public/assets/README.md`
- `THIRD_PARTY_ASSETS.md`

Recognized files include:

- `public/assets/audio/music/casino-lounge.mp3`
- `public/assets/audio/sfx/{war-drum,card-hit,reveal,win,lose,push}.mp3`
- `public/assets/table/felt-noise.svg`

If files are missing, the app automatically falls back to built-in synth audio and CSS visuals.

### Recommended asset sources

- https://itch.io/game-assets
- https://kenney.nl/assets
- https://opengameart.org
- https://pixabay.com/music/
- https://freesound.org
- https://mixkit.co/free-sound-effects/

## Notes

- Keep `THIRD_PARTY_ASSETS.md` updated for every external file you add.
- Prefer short-lived feature branches for clean PRs even when using an ongoing UI branch.
