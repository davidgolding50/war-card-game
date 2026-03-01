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

- `lib/war.ts`: Pure deterministic WAR engine (no React).
- `lib/war.test.ts`: Engine tests for core and edge-case behavior.
- `app/page.tsx`: UI, controls, log, autoplay, and keyboard shortcut.
- `app/layout.tsx` + `app/globals.css`: App shell and styling.

## Notes

- Autoplay uses a single reducer dispatch path (`PLAY_ROUND`) to avoid race conditions with manual play.
- Game ends immediately if a player cannot continue a WAR sequence.
