"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CasinoWarState,
  DealResult,
  WarResult,
  canGoToWar,
  canPlaceAnte,
  clampAnte,
  createCasinoWarState,
  dealHand,
  goToWar,
  surrender,
  tableLimits
} from "@/lib/casinoWar";
import { MEDIA_ASSETS, SfxAssetKey } from "@/lib/mediaAssets";

type ResolvedHand = {
  title: string;
  tone: "emerald" | "red" | "amber";
};

type FeltTheme = "emerald" | "royal" | "crimson";
type WarCinematicPhase = "idle" | "intro" | "deal_down" | "reveal" | "winner" | "aftermath";

const LOG_LIMIT = 24;
const FELT_THEME_BUTTONS: Array<{ id: FeltTheme; label: string }> = [
  { id: "emerald", label: "Emerald" },
  { id: "royal", label: "Royal" },
  { id: "crimson", label: "Crimson" }
];

function cardText(card: Card | null): string {
  return card ? `${card.rank}${card.suit}` : "--";
}

function cardColor(card: Card | null): string {
  if (!card) {
    return "text-slate-400";
  }
  return card.suit === "♥" || card.suit === "♦" ? "text-red-700" : "text-slate-900";
}

function toneClass(tone: ResolvedHand["tone"]): string {
  if (tone === "emerald") {
    return "border-emerald-300/70 bg-emerald-500/15 text-emerald-100";
  }
  if (tone === "red") {
    return "border-rose-300/70 bg-rose-500/15 text-rose-100";
  }
  return "border-amber-300/70 bg-amber-500/15 text-amber-100";
}

function eventTitle(result: DealResult | WarResult): ResolvedHand {
  switch (result.outcome) {
    case "player_win":
      return { title: "Player wins hand", tone: "emerald" };
    case "dealer_win":
      return { title: "Dealer wins hand", tone: "red" };
    case "war_offered":
      return { title: "WAR offered", tone: "amber" };
    case "war_player_win":
      return { title: "Player wins WAR", tone: "emerald" };
    case "war_dealer_win":
      return { title: "Dealer wins WAR", tone: "red" };
    case "war_push":
      return { title: "WAR push", tone: "amber" };
    case "surrender":
      return { title: "Player surrender", tone: "amber" };
    default:
      return { title: "Hand complete", tone: "amber" };
  }
}

function CardDisplay({ label, card }: { label: string; card: Card | null }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-300">{label}</div>
      <div className="h-36 w-24 rounded-xl border border-white/60 bg-gradient-to-b from-white to-slate-100 p-3 shadow-xl">
        {card ? (
          <div className={`flex h-full flex-col justify-between text-2xl font-bold ${cardColor(card)}`}>
            <span>{card.rank}</span>
            <span className="self-center text-3xl">{card.suit}</span>
            <span className="self-end">{card.rank}</span>
          </div>
        ) : (
          <div className="grid h-full place-items-center rounded-lg border border-dashed border-slate-300 text-xs uppercase tracking-[0.12em] text-slate-400">
            Waiting
          </div>
        )}
      </div>
    </div>
  );
}

function CardBack({ className = "" }: { className?: string }) {
  return (
    <div className={`h-20 w-14 rounded-md border border-cyan-100/70 bg-slate-900 ${className}`}>
      <div className="grid h-full place-items-center text-[10px] font-semibold tracking-[0.2em] text-cyan-100">WAR</div>
    </div>
  );
}

export default function Page() {
  const limits = useMemo(() => tableLimits(), []);
  const [buyIn, setBuyIn] = useState(500);
  const [ante, setAnte] = useState(25);
  const [feltTheme, setFeltTheme] = useState<FeltTheme>("emerald");
  const [state, setState] = useState<CasinoWarState | null>(null);
  const [events, setEvents] = useState<string[]>(["Welcome to Casino War. Buy in to begin."]);
  const [result, setResult] = useState<ResolvedHand | null>(null);
  const [warResult, setWarResult] = useState<WarResult | null>(null);

  const [warPhase, setWarPhase] = useState<WarCinematicPhase>("idle");
  const [warDownCount, setWarDownCount] = useState(0);
  const [warPayload, setWarPayload] = useState<WarResult | null>(null);
  const warTimersRef = useRef<number[]>([]);
  const sfxContextRef = useRef<AudioContext | null>(null);

  const [musicOn, setMusicOn] = useState(false);
  const [musicVolume, setMusicVolume] = useState(55);
  const [audioBackend, setAudioBackend] = useState<"asset" | "synth">("asset");
  const musicContextRef = useRef<AudioContext | null>(null);
  const musicTimerRef = useRef<number | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const musicStepRef = useRef(0);
  const musicElementRef = useRef<HTMLAudioElement | null>(null);
  const sfxElementsRef = useRef<Partial<Record<SfxAssetKey, HTMLAudioElement>>>({});

  function addEvents(next: string[]) {
    setEvents((current) => [...next, ...current].slice(0, LOG_LIMIT));
  }

  function clearWarTimers() {
    for (const timerId of warTimersRef.current) {
      window.clearTimeout(timerId);
      window.clearInterval(timerId);
    }
    warTimersRef.current = [];
  }

  function synthSfx(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType = "triangle",
    delay = 0
  ) {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) {
      return;
    }

    const context = sfxContextRef.current ?? new AudioContextClass();
    sfxContextRef.current = context;

    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function playAssetSfx(key: SfxAssetKey, volume = 0.55): boolean {
    const source = MEDIA_ASSETS.sfx[key];
    const player = sfxElementsRef.current[key] ?? new Audio(source);
    player.preload = "auto";
    player.volume = Math.max(0, Math.min(1, (musicVolume / 100) * volume));
    sfxElementsRef.current[key] = player;

    try {
      player.currentTime = 0;
      const result = player.play();
      if (result) {
        void result.catch(() => undefined);
      }
      return true;
    } catch {
      return false;
    }
  }

  function warCue(
    key: SfxAssetKey,
    fallback: { frequency: number; duration: number; volume: number; type?: OscillatorType; delay?: number }
  ) {
    const played = playAssetSfx(key, 0.75);
    if (!played) {
      setAudioBackend("synth");
      synthSfx(
        fallback.frequency,
        fallback.duration,
        fallback.volume,
        fallback.type ?? "triangle",
        fallback.delay ?? 0
      );
    } else {
      setAudioBackend("asset");
    }
  }

  function startWarCinematic(payload: WarResult) {
    clearWarTimers();
    setWarPayload(payload);
    setWarDownCount(0);
    setWarPhase("intro");

    warCue("warDrum", { frequency: 120, duration: 0.45, volume: 0.18, type: "sawtooth" });
    warCue("warDrum", { frequency: 168, duration: 0.42, volume: 0.14, delay: 0.06 });

    const introTimer = window.setTimeout(() => {
      setWarPhase("deal_down");

      let placed = 0;
      const dealInterval = window.setInterval(() => {
        placed += 1;
        setWarDownCount(Math.min(placed, 3));
        warCue("cardHit", { frequency: placed % 2 === 0 ? 190 : 160, duration: 0.12, volume: 0.12 });

        if (placed >= 3) {
          window.clearInterval(dealInterval);
          setWarPhase("reveal");
          warCue("reveal", { frequency: 420, duration: 0.2, volume: 0.15 });
          warCue("reveal", { frequency: 520, duration: 0.22, volume: 0.13, delay: 0.08 });

          const winnerTimer = window.setTimeout(() => {
            setWarPhase("winner");
            if (payload.outcome === "war_player_win") {
              warCue("win", { frequency: 440, duration: 0.2, volume: 0.13 });
              warCue("win", { frequency: 554, duration: 0.2, volume: 0.13, delay: 0.08 });
              warCue("win", { frequency: 660, duration: 0.24, volume: 0.14, delay: 0.18 });
            } else if (payload.outcome === "war_dealer_win") {
              warCue("lose", { frequency: 330, duration: 0.22, volume: 0.13 });
              warCue("lose", { frequency: 247, duration: 0.24, volume: 0.13, delay: 0.1 });
            } else {
              warCue("push", { frequency: 392, duration: 0.2, volume: 0.11 });
              warCue("push", { frequency: 440, duration: 0.2, volume: 0.11, delay: 0.1 });
            }

            const revealDownTimer = window.setTimeout(() => {
              setWarPhase("aftermath");

              const closeTimer = window.setTimeout(() => {
                setWarPhase("idle");
                setWarPayload(null);
                setWarDownCount(0);
              }, 2200);
              warTimersRef.current.push(closeTimer);
            }, 1000);
            warTimersRef.current.push(revealDownTimer);
          }, 1200);
          warTimersRef.current.push(winnerTimer);
        }
      }, 300);
      warTimersRef.current.push(dealInterval);
    }, 600);

    warTimersRef.current.push(introTimer);
  }

  function handleBuyIn() {
    const session = createCasinoWarState(Math.max(50, Math.floor(buyIn)));
    setState(session);
    setWarResult(null);
    setResult({ title: `Bought in for $${session.bankroll}`, tone: "amber" });
    addEvents([`Bought in for $${session.bankroll}. Table limits $${limits.min}-$${limits.max}.`]);
  }

  function handleDeal() {
    if (!state || warPhase !== "idle") {
      return;
    }

    const wager = clampAnte(ante);
    if (!canPlaceAnte(state, wager)) {
      setResult({ title: "Ante invalid for bankroll", tone: "red" });
      addEvents([`Cannot deal: ante $${wager} outside limits or exceeds bankroll.`]);
      return;
    }

    const dealt = dealHand(state, wager);
    setState(dealt.state);
    setWarResult(null);
    setResult(eventTitle(dealt));
    addEvents(dealt.events);
  }

  function handleSurrender() {
    if (!state || state.phase !== "awaiting_war_choice" || warPhase !== "idle") {
      return;
    }

    const resolved = surrender(state);
    setState(resolved.state);
    setWarResult(null);
    setResult(eventTitle(resolved));
    addEvents(resolved.events);
  }

  function handleGoToWar() {
    if (!state || state.phase !== "awaiting_war_choice" || warPhase !== "idle") {
      return;
    }

    if (!canGoToWar(state)) {
      setResult({ title: "Insufficient bankroll for war bet", tone: "red" });
      addEvents(["Cannot go to war: bankroll is less than required war bet."]);
      return;
    }

    const resolved = goToWar(state);
    setState(resolved.state);
    setWarResult(resolved);
    setResult(eventTitle(resolved));
    addEvents(resolved.events);
    startWarCinematic(resolved);
  }

  useEffect(() => () => clearWarTimers(), []);

  useEffect(() => {
    function startSynthMusic() {
      const AudioContextClass = window.AudioContext;
      if (!AudioContextClass) {
        return;
      }

      const context = new AudioContextClass();
      musicContextRef.current = context;

      const lowpass = context.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.setValueAtTime(1400, context.currentTime);

      const masterGain = context.createGain();
      masterGain.gain.value = 0.45 * (musicVolume / 100);

      lowpass.connect(masterGain);
      masterGain.connect(context.destination);

      musicGainRef.current = masterGain;
      musicStepRef.current = 0;
      setAudioBackend("synth");

      const progression = [130.81, 110.0, 146.83, 98.0];
      const topLine = [392.0, 440.0, 493.88, 523.25, 493.88, 440.0, 392.0, 349.23];

      function playTone(
        frequency: number,
        start: number,
        duration: number,
        type: OscillatorType,
        volume: number
      ) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(lowpass);
        osc.start(start);
        osc.stop(start + duration + 0.04);
      }

      function tick() {
        const now = context.currentTime;
        const step = musicStepRef.current;
        const root = progression[Math.floor(step / 2) % progression.length];
        playTone(root, now, 1.3, "triangle", 0.2);
        playTone(root * 1.26, now + 0.03, 1.25, "triangle", 0.14);
        playTone(root / 2, now + 0.05, 0.42, "sine", 0.22);
        if (step % 2 === 1) {
          playTone(topLine[step % topLine.length], now + 0.16, 0.32, "sine", 0.12);
        }
        musicStepRef.current += 1;
      }

      void context.resume();
      tick();
      musicTimerRef.current = window.setInterval(tick, 900);
    }

    function stopAudio() {
      if (musicElementRef.current) {
        musicElementRef.current.pause();
        musicElementRef.current.currentTime = 0;
        musicElementRef.current = null;
      }
      if (musicTimerRef.current !== null) {
        window.clearInterval(musicTimerRef.current);
        musicTimerRef.current = null;
      }
      if (musicContextRef.current) {
        void musicContextRef.current.close();
        musicContextRef.current = null;
      }
      musicGainRef.current = null;
    }

    if (!musicOn) {
      stopAudio();
      return;
    }

    let cancelled = false;
    const assetTrack = new Audio(MEDIA_ASSETS.music.lounge);
    assetTrack.loop = true;
    assetTrack.preload = "auto";
    assetTrack.volume = Math.max(0, Math.min(1, musicVolume / 100));
    musicElementRef.current = assetTrack;

    const onAssetError = () => {
      if (cancelled) {
        return;
      }
      musicElementRef.current = null;
      startSynthMusic();
    };
    assetTrack.addEventListener("error", onAssetError, { once: true });

    try {
      const playAttempt = assetTrack.play();
      if (playAttempt) {
        void playAttempt
          .then(() => {
            if (!cancelled) {
              setAudioBackend("asset");
            }
          })
          .catch(onAssetError);
      } else {
        setAudioBackend("asset");
      }
    } catch {
      onAssetError();
    }

    return () => {
      cancelled = true;
      assetTrack.removeEventListener("error", onAssetError);
      stopAudio();
    };
  }, [musicOn, musicVolume]);

  useEffect(() => {
    if (musicElementRef.current) {
      musicElementRef.current.volume = Math.max(0, Math.min(1, musicVolume / 100));
    }
    if (musicGainRef.current && musicContextRef.current) {
      musicGainRef.current.gain.setValueAtTime(
        0.45 * (musicVolume / 100),
        musicContextRef.current.currentTime
      );
    }
  }, [musicVolume]);

  useEffect(() => {
    return () => {
      for (const key of Object.keys(sfxElementsRef.current) as SfxAssetKey[]) {
        const item = sfxElementsRef.current[key];
        if (!item) {
          continue;
        }
        item.pause();
        item.currentTime = 0;
      }
    };
  }, []);

  const quickBuyIns = [100, 250, 500, 1000, 2000];
  const quickAntes = [5, 10, 25, 50, 100, 200];
  const warWinnerText =
    warPayload?.outcome === "war_player_win"
      ? "YOU DEFEAT THE CHALLENGER"
      : warPayload?.outcome === "war_dealer_win"
        ? "THE CHALLENGER OVERPOWERS YOU"
        : "THE CLASH ENDS IN A PUSH";
  const warActive = warPhase !== "idle";

  return (
    <main className="min-h-screen p-4 sm:p-6">
      {warActive && warPayload && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-gradient-to-b from-orange-900/95 via-amber-900/90 to-black/95">
          <div className="absolute inset-0 arena-crowd" />
          <div className="absolute inset-0 arena-dust" />

          <div className="absolute left-1/2 top-8 -translate-x-1/2 text-center text-amber-100">
            <div className="text-xs uppercase tracking-[0.3em]">Arena Of War</div>
            <div className="mt-1 text-3xl font-semibold">GLADIATOR DUEL</div>
            <div className="mt-2 text-sm text-amber-50/90">
              {warPhase === "intro" && "The crowd roars as the duel begins."}
              {warPhase === "deal_down" && "Three face-down cards are dealt to each fighter."}
              {warPhase === "reveal" && "Final card flips. All eyes on the reveal."}
              {warPhase === "winner" && warWinnerText}
              {warPhase === "aftermath" && "Hidden cards revealed. The arena settles."}
            </div>
          </div>

          <div className="absolute inset-x-0 top-[22%] text-center">
            <div className="text-xs uppercase tracking-[0.2em] text-amber-100/80">Opponent</div>
            <div className="mt-3 flex justify-center gap-2">
              {Array.from({ length: warDownCount }).map((_, index) => (
                <CardBack key={`enemy-down-${index}`} className="-rotate-6" />
              ))}
            </div>
          </div>

          <div className="absolute left-1/2 top-[48%] -translate-x-1/2">
            <div className="flex items-center gap-8">
              <CardDisplay label="Dealer" card={warPhase === "intro" || warPhase === "deal_down" ? null : warPayload.warDealerCard} />
              <div className="text-2xl font-bold text-amber-100">VS</div>
              <CardDisplay label="Player" card={warPhase === "intro" || warPhase === "deal_down" ? null : warPayload.warPlayerCard} />
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-[18%] text-center">
            <div className="text-xs uppercase tracking-[0.2em] text-amber-100/80">You</div>
            <div className="mt-3 flex justify-center gap-2">
              {Array.from({ length: warDownCount }).map((_, index) => (
                <CardBack key={`player-down-${index}`} className="rotate-6" />
              ))}
            </div>
          </div>

          {warPhase === "winner" && (
            <div className="absolute inset-x-0 top-[67%] text-center">
              <span className="arena-banner rounded-full border border-amber-100/80 bg-black/35 px-8 py-3 text-xl font-semibold text-amber-100">
                {warWinnerText}
              </span>
            </div>
          )}

          {warPhase === "aftermath" && (
            <div className="absolute bottom-4 left-1/2 w-[92%] max-w-4xl -translate-x-1/2 rounded-2xl border border-amber-100/35 bg-black/45 p-4 text-amber-100 backdrop-blur">
              <div className="text-xs uppercase tracking-[0.16em]">Face-down cards revealed</div>
              <div className="mt-2 text-sm">Opponent: {warPayload.burnDealer.map(cardText).join(" ")}</div>
              <div className="text-sm">Player: {warPayload.burnPlayer.map(cardText).join(" ")}</div>
            </div>
          )}
        </div>
      )}

      <div className={`minimal-table felt-${feltTheme} mx-auto w-full max-w-4xl rounded-2xl border border-white/15 p-5 sm:p-6`}>
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Casino War</div>
            <h1 className="mt-1 text-2xl font-semibold text-white">Minimal Table</h1>
          </div>
          {state && (
            <button
              type="button"
              onClick={() => {
                addEvents([`Session ended. Cashed out $${state.bankroll}.`]);
                setState(null);
                setWarResult(null);
                setResult({ title: "Table closed", tone: "amber" });
              }}
              className="rounded-lg border border-rose-300/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-rose-100"
            >
              Cash Out
            </button>
          )}
        </header>

        {!state ? (
          <section className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-300">Buy In</div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={50}
                step={25}
                value={buyIn}
                onChange={(event) => setBuyIn(Number(event.target.value))}
                className="w-44 rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none"
              />
              <button
                type="button"
                onClick={handleBuyIn}
                className="rounded-lg border border-cyan-200/55 bg-cyan-300/90 px-4 py-2 text-sm font-bold text-slate-900"
              >
                Enter
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickBuyIns.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setBuyIn(chip)}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-slate-200"
                >
                  ${chip}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="minimal-stat">Bankroll <strong>${state.bankroll}</strong></div>
              <div className="minimal-stat">Hand <strong>{state.handNumber}</strong></div>
              <div className="minimal-stat">Ante <strong>${clampAnte(ante)}</strong></div>
              <div className="minimal-stat">Shoe <strong>{state.shoe.length}</strong></div>
            </section>

            {result && <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${toneClass(result.tone)}`}>{result.title}</div>}

            <section className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-white/10 bg-black/25 p-4 sm:grid-cols-2">
              <CardDisplay label="Player" card={state.playerCard} />
              <CardDisplay label="Dealer" card={state.dealerCard} />
              {warResult && !warActive && (
                <div className="sm:col-span-2 rounded-lg border border-cyan-200/20 bg-cyan-500/10 p-3 text-sm text-cyan-100">
                  Final: Player {cardText(warResult.warPlayerCard)} vs Dealer {cardText(warResult.warDealerCard)}
                </div>
              )}
            </section>

            <section className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/25 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-300">Wager</div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-slate-200">Ante</label>
                <input
                  type="number"
                  min={limits.min}
                  max={limits.max}
                  step={5}
                  value={ante}
                  onChange={(event) => setAnte(Number(event.target.value))}
                  className="w-28 rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none"
                />
                <span className="text-xs text-slate-300">limits ${limits.min}-${limits.max}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {quickAntes.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setAnte(chip)}
                    className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-slate-200"
                  >
                    ${chip}
                  </button>
                ))}
              </div>

              {state.phase === "ready" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDeal}
                    disabled={!canPlaceAnte(state, clampAnte(ante)) || warActive}
                    className="rounded-lg border border-cyan-200/55 bg-cyan-300/90 px-4 py-2 text-sm font-bold text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Deal Hand
                  </button>
                  <span className="text-sm text-slate-200">Wager ${clampAnte(ante)}</span>
                </div>
              ) : (
                <div className="rounded-lg border border-violet-300/35 bg-violet-500/10 p-3">
                  <div className="text-sm font-semibold text-violet-100">Tie hand</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSurrender}
                      disabled={warActive}
                      className="rounded-lg border border-violet-200/55 px-4 py-2 text-sm text-violet-100 disabled:opacity-45"
                    >
                      Surrender
                    </button>
                    <button
                      type="button"
                      onClick={handleGoToWar}
                      disabled={!canGoToWar(state) || warActive}
                      className="rounded-lg border border-cyan-200/55 bg-cyan-300/90 px-4 py-2 text-sm font-bold text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Go To War (${state.ante})
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        <section className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
          <details open>
            <summary className="cursor-pointer text-xs uppercase tracking-[0.16em] text-slate-300">Dealer Log</summary>
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-slate-200">
              {events.map((event, index) => (
                <div key={`${event}-${index}`} className="rounded bg-white/5 px-2 py-1">
                  {event}
                </div>
              ))}
            </div>
          </details>
        </section>

        <section className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-300">Preferences</div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {FELT_THEME_BUTTONS.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setFeltTheme(theme.id)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${
                  feltTheme === theme.id
                    ? "border-cyan-100/85 bg-cyan-300/20 text-cyan-100"
                    : "border-white/20 bg-white/5 text-slate-200"
                }`}
              >
                {theme.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={() => setMusicOn((previous) => !previous)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] ${
                musicOn ? "border-cyan-200/75 bg-cyan-300/15 text-cyan-100" : "border-white/20 bg-white/5 text-slate-200"
              }`}
            >
              {musicOn ? "Music On" : "Music Off"}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={musicVolume}
              onChange={(event) => setMusicVolume(Number(event.target.value))}
              className="h-1.5 w-36 cursor-pointer accent-cyan-300"
              aria-label="Music volume"
            />
            <span className="text-xs text-slate-300">{musicVolume}%</span>
            <span className="text-[11px] uppercase tracking-[0.12em] text-cyan-200/80">
              {audioBackend === "asset" ? "Asset" : "Synth"}
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
