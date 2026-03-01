import { describe, expect, it } from "vitest";
import {
  Card,
  CasinoWarState,
  dealHand,
  goToWar,
  surrender
} from "./casinoWar";

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });

function state(overrides: Partial<CasinoWarState>): CasinoWarState {
  return {
    bankroll: 100,
    phase: "ready",
    shoe: [
      c("A", "♠"),
      c("K", "♣"),
      c("2", "♦"),
      c("3", "♦"),
      c("4", "♦"),
      c("5", "♦"),
      c("6", "♦"),
      c("7", "♦"),
      c("8", "♦"),
      c("9", "♦")
    ],
    discard: [],
    handNumber: 0,
    ante: 0,
    warBet: 0,
    playerCard: null,
    dealerCard: null,
    ...overrides
  };
}

describe("casino war engine", () => {
  it("pays 1:1 on a player win", () => {
    const start = state({
      shoe: [
        c("A", "♠"),
        c("K", "♣"),
        c("2", "♦"),
        c("3", "♦"),
        c("4", "♦"),
        c("5", "♦"),
        c("6", "♦"),
        c("7", "♦"),
        c("8", "♦"),
        c("9", "♦")
      ]
    });
    const result = dealHand(start, 10);

    expect(result.outcome).toBe("player_win");
    expect(result.state.bankroll).toBe(110);
    expect(result.state.phase).toBe("ready");
  });

  it("offers war on tie", () => {
    const start = state({
      shoe: [
        c("8", "♠"),
        c("8", "♥"),
        c("2", "♦"),
        c("3", "♦"),
        c("4", "♦"),
        c("5", "♦"),
        c("6", "♦"),
        c("7", "♦"),
        c("9", "♦"),
        c("10", "♦")
      ]
    });
    const result = dealHand(start, 10);

    expect(result.outcome).toBe("war_offered");
    expect(result.state.phase).toBe("awaiting_war_choice");
    expect(result.state.bankroll).toBe(90);
  });

  it("surrender returns half of ante", () => {
    const tieState = state({
      phase: "awaiting_war_choice",
      bankroll: 90,
      ante: 10,
      playerCard: c("8", "♠"),
      dealerCard: c("8", "♥")
    });

    const result = surrender(tieState);

    expect(result.outcome).toBe("surrender");
    expect(result.state.bankroll).toBe(95);
    expect(result.state.phase).toBe("ready");
  });

  it("war win pushes ante and pays war bet 1:1", () => {
    const tieState = state({
      phase: "awaiting_war_choice",
      bankroll: 90,
      ante: 10,
      playerCard: c("9", "♠"),
      dealerCard: c("9", "♥"),
      shoe: [
        c("2", "♠"),
        c("3", "♠"),
        c("4", "♠"),
        c("2", "♥"),
        c("3", "♥"),
        c("4", "♥"),
        c("A", "♣"),
        c("K", "♦"),
        c("7", "♣"),
        c("6", "♦")
      ]
    });

    const result = goToWar(tieState);

    expect(result.outcome).toBe("war_player_win");
    expect(result.state.bankroll).toBe(110);
    expect(result.state.phase).toBe("ready");
  });
});
