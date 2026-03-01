"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { Card, GameState, PlayerId, createInitialGameState, playRound } from "@/lib/war";

type RoundOutcome = "none" | "player" | "computer" | "war" | "player_game" | "computer_game";
type FeltTheme = "emerald" | "royal" | "crimson";
type BurstTone = "gold" | "emerald" | "red";
type BurstNotice = { id: number; text: string; tone: BurstTone };

type UiState = {
  game: GameState;
  log: string[];
  autoPlay: boolean;
  hasStarted: boolean;
  lastPileCount: number;
  lastOutcome: RoundOutcome;
  lastMessage: string;
};

type Action =
  | { type: "DEAL" }
  | { type: "TOGGLE_AUTOPLAY" }
  | { type: "NEW_GAME" };

const MAX_LOG = 20;
const AUTO_PLAY_MS = 500;

function createUiState(): UiState {
  return {
    game: createInitialGameState(),
    log: ["New game ready. Press Start Deal to begin."],
    autoPlay: false,
    hasStarted: false,
    lastPileCount: 0,
    lastOutcome: "none",
    lastMessage: "Waiting for first deal"
  };
}

function reduceLog(current: string[], additions: string[]): string[] {
  return [...additions, ...current].slice(0, MAX_LOG);
}

function inferOutcome(events: string[], winner: PlayerId | null): { outcome: RoundOutcome; message: string } {
  const war = events.some((event) => event.includes("WAR!"));

  if (winner === "player") {
    return { outcome: "player_game", message: "You win the game" };
  }
  if (winner === "computer") {
    return { outcome: "computer_game", message: "Computer wins the game" };
  }

  if (events.some((event) => event.startsWith("PLAYER wins"))) {
    return { outcome: "player", message: "You take the deal" };
  }
  if (events.some((event) => event.startsWith("COMPUTER wins"))) {
    return { outcome: "computer", message: "Computer takes the deal" };
  }

  if (war) {
    return { outcome: "war", message: "WAR triggered" };
  }

  return { outcome: "none", message: "Deal complete" };
}

function reducer(state: UiState, action: Action): UiState {
  switch (action.type) {
    case "NEW_GAME":
      return createUiState();
    case "TOGGLE_AUTOPLAY":
      if (state.game.winner || !state.hasStarted) {
        return state;
      }
      return { ...state, autoPlay: !state.autoPlay };
    case "DEAL": {
      if (state.game.winner) {
        return { ...state, autoPlay: false };
      }

      const result = playRound(state.game);
      const nextAuto = result.state.winner ? false : state.autoPlay;
      const outcome = inferOutcome(result.events, result.state.winner);

      return {
        game: result.state,
        log: reduceLog(state.log, result.events),
        autoPlay: nextAuto,
        hasStarted: true,
        lastPileCount: result.pileCount,
        lastOutcome: outcome.outcome,
        lastMessage: outcome.message
      };
    }
    default:
      return state;
  }
}

function CardView({ card, label }: { card: Card | null; label: string }) {
  const isRed = card ? card.suit === "♥" || card.suit === "♦" : false;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-xs uppercase tracking-[0.2em] text-emerald-100/80">{label}</div>
      <div className="h-40 w-28 rounded-xl border border-amber-100/70 bg-gradient-to-b from-white to-stone-100 p-3 shadow-2xl transition duration-300">
        {card ? (
          <div
            className={`flex h-full flex-col justify-between text-2xl font-bold ${
              isRed ? "text-red-700" : "text-slate-800"
            }`}
          >
            <span>{card.rank}</span>
            <span className="self-center text-3xl">{card.suit}</span>
            <span className="self-end">{card.rank}</span>
          </div>
        ) : (
          <div className="grid h-full place-items-center rounded-lg border border-dashed border-slate-300 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Waiting
          </div>
        )}
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const FELT_THEME_BUTTONS: Array<{ id: FeltTheme; label: string }> = [
  { id: "emerald", label: "Emerald" },
  { id: "royal", label: "Royal" },
  { id: "crimson", label: "Crimson" }
];

export default function Page() {
  const [state, dispatch] = useReducer(reducer, undefined, createUiState);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [feltTheme, setFeltTheme] = useState<FeltTheme>("emerald");

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesPosition, setNotesPosition] = useState({ x: 28, y: 120 });
  const dragRef = useRef<{ active: boolean; offsetX: number; offsetY: number }>({
    active: false,
    offsetX: 0,
    offsetY: 0
  });

  const [musicOn, setMusicOn] = useState(false);
  const [musicVolume, setMusicVolume] = useState(55);
  const musicContextRef = useRef<AudioContext | null>(null);
  const musicTimerRef = useRef<number | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const musicStepRef = useRef(0);

  const sfxContextRef = useRef<AudioContext | null>(null);
  const prevRoundRef = useRef(0);
  const burstIdRef = useRef(0);
  const [burst, setBurst] = useState<BurstNotice | null>(null);
  const [burstQueue, setBurstQueue] = useState<BurstNotice[]>([]);

  useEffect(() => {
    if (!state.autoPlay || state.game.winner) {
      return;
    }

    const interval = window.setInterval(() => {
      dispatch({ type: "DEAL" });
    }, AUTO_PLAY_MS);

    return () => window.clearInterval(interval);
  }, [state.autoPlay, state.game.winner]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space") {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) {
        return;
      }

      event.preventDefault();
      dispatch({ type: "DEAL" });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const blockedMessage = "Cannot assign to read only property 'solana'";

    function shouldBlock(message: string | undefined): boolean {
      return Boolean(message && message.includes(blockedMessage));
    }

    function onError(event: ErrorEvent): void {
      if (shouldBlock(event.message)) {
        event.preventDefault();
      }
    }

    function onRejection(event: PromiseRejectionEvent): void {
      const reasonMessage =
        typeof event.reason === "string"
          ? event.reason
          : event.reason instanceof Error
            ? event.reason.message
            : undefined;

      if (shouldBlock(reasonMessage)) {
        event.preventDefault();
      }
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      if (!dragRef.current.active) {
        return;
      }

      const panelWidth = 320;
      const panelHeight = 340;
      const x = clamp(event.clientX - dragRef.current.offsetX, 10, window.innerWidth - panelWidth - 10);
      const y = clamp(event.clientY - dragRef.current.offsetY, 10, window.innerHeight - panelHeight - 10);
      setNotesPosition({ x, y });
    }

    function onMouseUp() {
      dragRef.current.active = false;
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    function stopMusic(): void {
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
      stopMusic();
      return;
    }

    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) {
      return;
    }

    const context = new AudioContextClass();
    musicContextRef.current = context;

    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(1200, context.currentTime);

    const masterGain = context.createGain();
    masterGain.gain.value = 0.36 * (musicVolume / 100);

    lowpass.connect(masterGain);
    masterGain.connect(context.destination);

    musicGainRef.current = masterGain;
    musicStepRef.current = 0;

    const progression = [130.81, 110.0, 146.83, 98.0]; // C3, A2, D3, G2
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
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.06);
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

      // Soft chord bed.
      playTone(root, now, 1.4, "triangle", 0.18);
      playTone(root * 1.26, now + 0.02, 1.35, "triangle", 0.13);
      playTone(root * 1.5, now + 0.03, 1.3, "sine", 0.12);

      // Walking bass pulse.
      playTone(root / 2, now + 0.05, 0.45, "sine", 0.22);

      // Clean melody tone.
      if (step % 2 === 1) {
        playTone(topLine[step % topLine.length], now + 0.14, 0.35, "sine", 0.11);
      }

      musicStepRef.current += 1;
    }

    void context.resume();
    tick();
    musicTimerRef.current = window.setInterval(tick, 900);

    return () => stopMusic();
  }, [musicOn, musicVolume]);

  useEffect(() => {
    if (musicGainRef.current && musicContextRef.current) {
      musicGainRef.current.gain.setValueAtTime(
        0.36 * (musicVolume / 100),
        musicContextRef.current.currentTime
      );
    }
  }, [musicVolume]);

  useEffect(() => {
    if (state.game.round === 0 || prevRoundRef.current === state.game.round) {
      return;
    }

    prevRoundRef.current = state.game.round;

    let nextBurst: BurstNotice | null = null;
    if (state.lastOutcome === "player" || state.lastOutcome === "player_game") {
      nextBurst = { id: burstIdRef.current + 1, text: "You Win The Deal", tone: "emerald" };
    } else if (state.lastOutcome === "computer" || state.lastOutcome === "computer_game") {
      nextBurst = { id: burstIdRef.current + 1, text: "Computer Wins Deal", tone: "red" };
    } else if (state.lastOutcome === "war") {
      nextBurst = { id: burstIdRef.current + 1, text: "WAR!", tone: "gold" };
    } else {
      nextBurst = { id: burstIdRef.current + 1, text: "Deal", tone: "gold" };
    }

    burstIdRef.current += 1;
    setBurstQueue((current) => [...current, nextBurst]);

    const AudioContextClass = window.AudioContext;
    if (AudioContextClass) {
      const context = sfxContextRef.current ?? new AudioContextClass();
      sfxContextRef.current = context;

      function tone(frequency: number, duration: number, volume: number, delay = 0) {
        const start = context.currentTime + delay;
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(context.destination);
        osc.start(start);
        osc.stop(start + duration + 0.02);
      }

      if (state.lastOutcome === "player" || state.lastOutcome === "player_game") {
        tone(440, 0.2, 0.1);
        tone(554.37, 0.2, 0.1, 0.09);
        tone(659.25, 0.24, 0.11, 0.18);
      } else if (state.lastOutcome === "computer" || state.lastOutcome === "computer_game") {
        tone(440, 0.2, 0.08);
        tone(349.23, 0.2, 0.08, 0.08);
        tone(293.66, 0.25, 0.09, 0.16);
      } else if (state.lastOutcome === "war") {
        tone(220, 0.14, 0.09);
        tone(220, 0.14, 0.09, 0.12);
      }
    }
  }, [state.game.round, state.lastOutcome]);

  useEffect(() => {
    if (burst || burstQueue.length === 0) {
      return;
    }

    const [next, ...rest] = burstQueue;
    setBurst(next);
    setBurstQueue(rest);
  }, [burst, burstQueue]);

  useEffect(() => {
    if (!burst) {
      return;
    }

    const timer = window.setTimeout(() => {
      setBurst(null);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [burst]);

  const statusToneClass =
    burst?.tone === "emerald"
      ? "border-emerald-200/90 bg-emerald-500/30 text-emerald-100"
      : burst?.tone === "red"
        ? "border-rose-200/90 bg-rose-600/30 text-rose-100"
        : "border-amber-200/90 bg-amber-500/30 text-amber-100";

  return (
    <main className="min-h-screen w-full p-3 sm:p-6 lg:p-8">
      {burst && (
        <div className="pointer-events-none fixed left-1/2 top-5 z-50 -translate-x-1/2">
          <div
            key={burst.id}
            className={`deal-burst rounded-full border-2 px-8 py-3 text-2xl font-semibold tracking-wide shadow-2xl ${statusToneClass}`}
          >
            {burst.text}
          </div>
        </div>
      )}

      <div
        className={`casino-felt felt-${feltTheme} relative mx-auto flex min-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-amber-200/40 px-4 py-5 shadow-[0_30px_120px_rgba(0,0,0,0.6)] sm:px-8 sm:py-7`}
      >
        <div className="pointer-events-none absolute left-1/2 top-[17%] h-[26rem] w-[130%] -translate-x-1/2 rounded-[999px] border border-amber-100/20" />
        <div className="pointer-events-none absolute left-1/2 top-[20%] h-[20rem] w-[100%] -translate-x-1/2 rounded-[999px] border border-amber-100/15 border-dashed" />
        <div className="pointer-events-none absolute left-[12%] top-[14%] h-9 w-9 rounded-full border border-amber-200/35 bg-red-500/35 shadow-[0_0_20px_rgba(248,113,113,0.55)]" />
        <div className="pointer-events-none absolute right-[12%] top-[14%] h-9 w-9 rounded-full border border-amber-200/35 bg-blue-500/35 shadow-[0_0_20px_rgba(96,165,250,0.55)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/35 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/40 to-transparent" />

        <header className="relative z-10 flex items-start justify-between gap-3 text-amber-50">
          <div>
            <div className="text-xs uppercase tracking-[0.26em] text-amber-200/80">Casino Table</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-wide sm:text-3xl">WAR: Heads Up</h1>
            <p className="mt-1 text-sm text-emerald-100/85">
              {state.hasStarted
                ? "Press Space or Next Deal to continue."
                : "Press Start Deal to begin the match."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            className="rounded-full border border-amber-100/70 bg-amber-100/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-100 backdrop-blur transition hover:bg-amber-100/20"
          >
            Rules
          </button>
        </header>

        <section className="relative z-10 mt-6 flex flex-1 flex-col justify-between">
          <div className="mx-auto w-full max-w-4xl rounded-3xl border border-amber-100/25 bg-black/15 px-4 py-4 backdrop-blur-sm sm:px-6">
            <div className="grid grid-cols-3 items-center text-xs uppercase tracking-[0.18em] text-amber-100/85">
              <span className="justify-self-start">Computer stack: {state.game.computerDeck.length}</span>
              <span className="justify-self-center text-center">Round {state.game.round}</span>
              <span className="justify-self-end">War pile: {state.lastPileCount}</span>
            </div>

            <div className="mt-3 rounded-xl border border-amber-100/25 bg-black/20 px-3 py-2 text-center text-sm text-amber-100/90">
              {state.lastMessage}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-5">
              <div className="hidden items-center justify-center sm:flex">
                <CardView card={state.game.revealedComputer} label="Opponent card" />
              </div>

              <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-100/20 bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-emerald-50/90">Center Pot</div>
                <div className="flex items-center gap-4">
                  <CardView card={state.game.revealedComputer} label="Computer" />
                  <CardView card={state.game.revealedPlayer} label="Player" />
                </div>
              </div>

              <div className="hidden items-center justify-center sm:flex">
                <div className="rounded-xl border border-amber-100/20 bg-black/25 px-5 py-4 text-center text-amber-100">
                  <div className="text-xs uppercase tracking-[0.16em] text-amber-100/70">Computer</div>
                  <div className="mt-1 text-xl font-semibold">{state.game.computerDeck.length}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-6 rounded-3xl border border-amber-100/40 bg-gradient-to-b from-amber-200/10 to-amber-300/5 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm uppercase tracking-[0.18em] text-amber-100">Your Rail</div>
              <div className="text-sm font-semibold text-amber-50">Cards remaining: {state.game.playerDeck.length}</div>
            </div>

            {state.game.winner && (
              <div className="mt-3 rounded-xl border border-amber-200/60 bg-amber-100/20 px-4 py-3 text-sm font-semibold text-amber-50">
                {state.game.winner === "player" ? "You clear the table. Victory." : "House takes it this time."}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {!state.hasStarted ? (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "DEAL" })}
                  disabled={Boolean(state.game.winner)}
                  className="rounded-full border border-amber-50/80 bg-gradient-to-b from-amber-100 to-amber-300 px-7 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-emerald-900 shadow-lg shadow-amber-900/45 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Start Deal
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "DEAL" })}
                    disabled={Boolean(state.game.winner)}
                    className="rounded-full border border-amber-50/70 bg-gradient-to-b from-amber-100 to-amber-300 px-6 py-2 text-sm font-bold uppercase tracking-[0.08em] text-emerald-900 shadow-lg shadow-amber-900/40 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next Deal
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "TOGGLE_AUTOPLAY" })}
                    disabled={Boolean(state.game.winner)}
                    className="rounded-full border border-emerald-50/50 bg-emerald-900/65 px-5 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-emerald-100 shadow-lg shadow-black/30 transition hover:bg-emerald-900/85 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {state.autoPlay ? "Pause Auto" : "Auto Deals"}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => dispatch({ type: "NEW_GAME" })}
                className="rounded-full border border-amber-100/60 bg-amber-200/15 px-5 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-amber-100 transition hover:bg-amber-200/25"
              >
                New Game
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-amber-100/20 pt-3">
              <div className="text-xs uppercase tracking-[0.14em] text-amber-100/80">Felt Color</div>
              <div className="flex flex-wrap items-center gap-2">
                {FELT_THEME_BUTTONS.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setFeltTheme(theme.id)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
                      feltTheme === theme.id
                        ? "border-amber-100/90 bg-amber-100/30 text-amber-50"
                        : "border-amber-100/45 bg-black/25 text-amber-100/90 hover:bg-black/35"
                    }`}
                  >
                    {theme.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-amber-100/20 pt-3">
              <div className="text-xs uppercase tracking-[0.14em] text-amber-100/80">Table Music</div>
              <button
                type="button"
                onClick={() => setMusicOn((previous) => !previous)}
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition ${
                  musicOn
                    ? "border-emerald-200/80 bg-emerald-300/20 text-emerald-100"
                    : "border-amber-100/50 bg-black/20 text-amber-100"
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
                className="h-1.5 w-36 cursor-pointer accent-amber-300"
                aria-label="Music volume"
              />
              <div className="text-xs text-amber-100/80">{musicVolume}%</div>
            </div>
          </div>
        </section>
      </div>

      <button
        type="button"
        onClick={() => setNotesOpen((open) => !open)}
        className="fixed bottom-5 left-5 z-40 rounded-full border border-amber-100/70 bg-black/65 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-100 shadow-xl backdrop-blur"
      >
        {notesOpen ? "Hide Notes" : "Show Notes"}
      </button>

      {notesOpen && (
        <aside
          className="fixed z-40 w-80 rounded-2xl border border-amber-100/35 bg-black/75 p-3 text-xs text-emerald-100/85 shadow-2xl backdrop-blur"
          style={{ left: `${notesPosition.x}px`, top: `${notesPosition.y}px` }}
        >
          <div
            className="mb-2 flex cursor-move items-center justify-between rounded-lg bg-amber-100/10 px-2 py-1 text-amber-100"
            onMouseDown={(event) => {
              const parent = (event.currentTarget as HTMLElement).parentElement;
              if (!parent) {
                return;
              }
              const rect = parent.getBoundingClientRect();
              dragRef.current = {
                active: true,
                offsetX: event.clientX - rect.left,
                offsetY: event.clientY - rect.top
              };
            }}
          >
            <span className="uppercase tracking-[0.16em]">Dealer Notes</span>
            <button
              type="button"
              onClick={() => setNotesOpen(false)}
              className="rounded bg-black/35 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]"
            >
              Close
            </button>
          </div>
          <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {state.log.map((event, idx) => (
              <li key={`${state.game.round}-${idx}`} className="rounded bg-black/25 px-2 py-1">
                {event}
              </li>
            ))}
          </ul>
        </aside>
      )}

      {rulesOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border border-amber-100/30 bg-emerald-950 p-5 text-emerald-50 shadow-2xl">
            <div className="mb-2 text-lg font-semibold tracking-wide text-amber-100">Classic War Rules</div>
            <ul className="space-y-2 text-sm text-emerald-100/90">
              <li>52-card deck split 26/26 between you and the computer.</li>
              <li>Both reveal top card each round. Higher rank wins, ace is high.</li>
              <li>Winner takes revealed cards and places them at the bottom.</li>
              <li>On ties: 3 face-down cards, then 1 face-up card. Repeat if tied again.</li>
              <li>If either player cannot continue a war, that player loses immediately.</li>
              <li>Game ends when one side has zero cards.</li>
            </ul>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setRulesOpen(false)}
                className="rounded-full border border-amber-100/70 bg-amber-100/20 px-5 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-amber-100 transition hover:bg-amber-100/30"
              >
                Back To Table
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
