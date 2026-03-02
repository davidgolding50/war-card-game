export const MEDIA_ASSETS = {
  music: {
    lounge: "/assets/audio/music/casino-lounge.mp3"
  },
  sfx: {
    warDrum: "/assets/audio/sfx/war-drum.mp3",
    cardHit: "/assets/audio/sfx/card-hit.mp3",
    reveal: "/assets/audio/sfx/reveal.mp3",
    win: "/assets/audio/sfx/win.mp3",
    lose: "/assets/audio/sfx/lose.mp3",
    push: "/assets/audio/sfx/push.mp3"
  },
  textures: {
    feltNoise: "/assets/table/felt-noise.svg"
  }
} as const;

export type SfxAssetKey = keyof typeof MEDIA_ASSETS.sfx;

