"use client";

import { useMemo, useState } from "react";
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

type ResolvedHand = {
  title: string;
  tone: "emerald" | "red" | "amber";
};

const LOG_LIMIT = 24;

function cardText(card: Card | null): string {
  return card ? `${card.rank}${card.suit}` : "--";
}

function cardColor(card: Card | null): string {
  if (!card) {
    return "text-slate-400";
  }
  return card.suit === "♥" || card.suit === "♦" ? "text-red-700" : "text-slate-800";
}

function toneClass(tone: ResolvedHand["tone"]): string {
  if (tone === "emerald") {
    return "border-emerald-300/75 bg-emerald-500/25 text-emerald-100";
  }
  if (tone === "red") {
    return "border-rose-300/75 bg-rose-600/25 text-rose-100";
  }
  return "border-amber-300/75 bg-amber-500/25 text-amber-100";
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
      <div className="text-xs uppercase tracking-[0.18em] text-amber-100/85">{label}</div>
      <div className="h-36 w-24 rounded-xl border border-amber-100/65 bg-gradient-to-b from-white to-stone-100 p-3 shadow-2xl">
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

export default function Page() {
  const limits = useMemo(() => tableLimits(), []);
  const [buyIn, setBuyIn] = useState(500);
  const [ante, setAnte] = useState(25);
  const [state, setState] = useState<CasinoWarState | null>(null);
  const [events, setEvents] = useState<string[]>(["Welcome to Casino War. Buy in to begin."]);
  const [result, setResult] = useState<ResolvedHand | null>(null);
  const [warResult, setWarResult] = useState<WarResult | null>(null);

  function addEvents(next: string[]) {
    setEvents((current) => [...next, ...current].slice(0, LOG_LIMIT));
  }

  function handleBuyIn() {
    const session = createCasinoWarState(Math.max(50, Math.floor(buyIn)));
    setState(session);
    setWarResult(null);
    setResult({ title: `Bought in for $${session.bankroll}`, tone: "amber" });
    addEvents([`Bought in for $${session.bankroll}. Table limits $${limits.min}-$${limits.max}.`]);
  }

  function handleDeal() {
    if (!state) {
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
    const title = eventTitle(dealt);
    setResult(title);
    addEvents(dealt.events);
  }

  function handleSurrender() {
    if (!state || state.phase !== "awaiting_war_choice") {
      return;
    }

    const resolved = surrender(state);
    setState(resolved.state);
    setWarResult(null);
    setResult(eventTitle(resolved));
    addEvents(resolved.events);
  }

  function handleGoToWar() {
    if (!state || state.phase !== "awaiting_war_choice") {
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
  }

  const quickBuyIns = [100, 250, 500, 1000, 2000];
  const quickAntes = [5, 10, 25, 50, 100, 200];

  return (
    <main className="min-h-screen w-full p-3 sm:p-6 lg:p-8">
      <div className="casino-felt felt-emerald relative mx-auto flex min-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-amber-200/40 px-4 py-5 shadow-[0_30px_120px_rgba(0,0,0,0.6)] sm:px-8 sm:py-7">
        <header className="relative z-10 flex items-start justify-between gap-4 text-amber-50">
          <div>
            <div className="text-xs uppercase tracking-[0.26em] text-amber-200/80">Table Game</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-wide sm:text-3xl">Casino War</h1>
            <p className="mt-1 text-sm text-emerald-100/85">Buy in, place ante, deal cards. Tie gives Surrender or Go To War.</p>
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
              className="rounded-full border border-amber-100/70 bg-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-amber-100"
            >
              Cash Out
            </button>
          )}
        </header>

        {!state ? (
          <section className="mt-8 rounded-2xl border border-amber-100/25 bg-black/25 p-5 text-amber-50">
            <div className="text-sm uppercase tracking-[0.18em] text-amber-100/80">Buy In</div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="number"
                min={50}
                step={25}
                value={buyIn}
                onChange={(event) => setBuyIn(Number(event.target.value))}
                className="w-40 rounded-lg border border-amber-200/40 bg-black/30 px-3 py-2 text-sm text-amber-50 outline-none"
              />
              <button
                type="button"
                onClick={handleBuyIn}
                className="rounded-full border border-amber-50/80 bg-gradient-to-b from-amber-100 to-amber-300 px-7 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-emerald-900 shadow-lg"
              >
                Enter Table
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {quickBuyIns.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setBuyIn(chip)}
                  className="rounded-full border border-amber-100/55 bg-black/20 px-3 py-1 text-xs font-semibold text-amber-100"
                >
                  ${chip}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <>
            <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-amber-100/25 bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-amber-100/80">Bankroll</div>
                <div className="mt-1 text-3xl font-bold text-emerald-100">${state.bankroll}</div>
              </div>
              <div className="rounded-xl border border-amber-100/25 bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-amber-100/80">Hand</div>
                <div className="mt-1 text-3xl font-bold text-amber-100">{state.handNumber}</div>
              </div>
              <div className="rounded-xl border border-amber-100/25 bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-amber-100/80">Ante</div>
                <div className="mt-1 text-3xl font-bold text-amber-100">${clampAnte(ante)}</div>
              </div>
              <div className="rounded-xl border border-amber-100/25 bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-amber-100/80">Shoe Remaining</div>
                <div className="mt-1 text-3xl font-bold text-amber-100">{state.shoe.length}</div>
              </div>
            </section>

            {result && (
              <div className={`mt-4 rounded-xl border px-4 py-3 text-center text-sm font-semibold ${toneClass(result.tone)}`}>
                {result.title}
              </div>
            )}

            <section className="mt-5 rounded-2xl border border-amber-100/25 bg-black/22 p-5">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <CardDisplay label="Player" card={state.playerCard} />
                <CardDisplay label="Dealer" card={state.dealerCard} />
              </div>

              {warResult && (
                <div className="mt-5 rounded-xl border border-amber-100/30 bg-black/25 p-4 text-amber-100">
                  <div className="text-xs uppercase tracking-[0.16em] text-amber-100/80">War Reveal</div>
                  <div className="mt-2 text-sm">Player burn: {warResult.burnPlayer.map(cardText).join(" ")}</div>
                  <div className="text-sm">Dealer burn: {warResult.burnDealer.map(cardText).join(" ")}</div>
                  <div className="mt-2 text-sm font-semibold">
                    Final: Player {cardText(warResult.warPlayerCard)} vs Dealer {cardText(warResult.warDealerCard)}
                  </div>
                </div>
              )}
            </section>

            <section className="mt-5 rounded-2xl border border-amber-100/25 bg-black/22 p-5">
              <div className="text-xs uppercase tracking-[0.16em] text-amber-100/80">Wager Controls</div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="text-sm text-amber-100">Ante:</label>
                <input
                  type="number"
                  min={limits.min}
                  max={limits.max}
                  step={5}
                  value={ante}
                  onChange={(event) => setAnte(Number(event.target.value))}
                  className="w-28 rounded-lg border border-amber-200/40 bg-black/30 px-3 py-2 text-sm text-amber-50 outline-none"
                />
                <div className="text-xs text-amber-100/75">Table limits ${limits.min}-${limits.max}</div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {quickAntes.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setAnte(chip)}
                    className="rounded-full border border-amber-100/55 bg-black/20 px-3 py-1 text-xs font-semibold text-amber-100"
                  >
                    ${chip}
                  </button>
                ))}
              </div>

              {state.phase === "ready" ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDeal}
                    disabled={!canPlaceAnte(state, clampAnte(ante))}
                    className="rounded-full border border-amber-50/80 bg-gradient-to-b from-amber-100 to-amber-300 px-7 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-emerald-900 shadow-lg disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Deal Hand
                  </button>
                  <div className="text-sm text-amber-100/90">Wager ${clampAnte(ante)} on Ante</div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-amber-200/45 bg-amber-500/10 p-4">
                  <div className="text-sm font-semibold text-amber-100">Tie hand. Choose your option:</div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleSurrender}
                      className="rounded-full border border-amber-100/70 bg-black/25 px-5 py-2 text-sm font-semibold text-amber-100"
                    >
                      Surrender (lose half ante)
                    </button>
                    <button
                      type="button"
                      onClick={handleGoToWar}
                      disabled={!canGoToWar(state)}
                      className="rounded-full border border-amber-50/80 bg-gradient-to-b from-amber-100 to-amber-300 px-5 py-2 text-sm font-bold text-emerald-900 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Go To War (match ${state.ante})
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        <section className="mt-5 rounded-xl border border-amber-100/25 bg-black/25 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-amber-100/80">Dealer Log</div>
          <div className="mt-2 max-h-48 overflow-y-auto space-y-1 text-sm text-amber-100/90">
            {events.map((event, index) => (
              <div key={`${event}-${index}`} className="rounded bg-black/25 px-2 py-1">
                {event}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
