import { describe, expect, it } from "vitest";
import { GameState, Card, playRound } from "./war";

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });

function state(playerDeck: Card[], computerDeck: Card[]): GameState {
  return {
    playerDeck,
    computerDeck,
    revealedPlayer: null,
    revealedComputer: null,
    round: 0,
    winner: null
  };
}

describe("playRound", () => {
  it("resolves a normal non-war round", () => {
    const start = state([c("A", "♠"), c("2", "♣")], [c("K", "♥"), c("3", "♦")]);

    const result = playRound(start);

    expect(result.state.playerDeck).toEqual([c("2", "♣"), c("A", "♠"), c("K", "♥")]);
    expect(result.state.computerDeck).toEqual([c("3", "♦")]);
    expect(result.state.winner).toBeNull();
  });

  it("handles chained wars and awards the full pile", () => {
    const start = state(
      [c("5", "♠"), c("9", "♠"), c("8", "♠"), c("7", "♠"), c("6", "♠"), c("4", "♠"), c("2", "♠")],
      [c("5", "♥"), c("9", "♥"), c("8", "♥"), c("7", "♥"), c("6", "♥"), c("3", "♥"), c("A", "♥")]
    );

    const result = playRound(start);

    expect(result.pileCount).toBe(14);
    expect(result.state.winner).toBe("computer");
    expect(result.state.playerDeck).toEqual([]);
    expect(result.state.computerDeck).toHaveLength(14);
    expect(result.events.some((e) => e.includes("WAR!"))).toBe(true);
  });

  it("ends game when a player cannot continue a war", () => {
    const start = state([c("7", "♠")], [c("7", "♥"), c("4", "♦")]);

    const result = playRound(start);

    expect(result.state.winner).toBe("computer");
    expect(result.events.join(" ")).toContain("cannot continue war");
  });
});
