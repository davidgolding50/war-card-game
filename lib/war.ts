export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";

export type Card = {
  rank: Rank;
  suit: Suit;
};

export type Deck = Card[];

export type PlayerId = "player" | "computer";

export type RoundResult = {
  state: GameState;
  events: string[];
  pileCount: number;
};

export type GameState = {
  playerDeck: Deck;
  computerDeck: Deck;
  revealedPlayer: Card | null;
  revealedComputer: Card | null;
  round: number;
  winner: PlayerId | null;
};

const RANKS: Rank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A"
];

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];

const RANK_VALUE: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14
};

function compareCards(a: Card, b: Card): number {
  return RANK_VALUE[a.rank] - RANK_VALUE[b.rank];
}

function drawTop(deck: Deck): { card: Card | null; rest: Deck } {
  if (deck.length === 0) {
    return { card: null, rest: [] };
  }
  return { card: deck[0], rest: deck.slice(1) };
}

function formatCard(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function buildDeck(): Deck {
  const deck: Deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffleDeck(deck: Deck, rng: () => number): Deck {
  const next = [...deck];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function createInitialGameState(rng: () => number = Math.random): GameState {
  const deck = shuffleDeck(buildDeck(), rng);
  return {
    playerDeck: deck.slice(0, 26),
    computerDeck: deck.slice(26),
    revealedPlayer: null,
    revealedComputer: null,
    round: 0,
    winner: null
  };
}

function determineWinnerByCards(playerDeck: Deck, computerDeck: Deck): PlayerId | null {
  if (playerDeck.length === 0 && computerDeck.length === 0) {
    return "computer";
  }
  if (playerDeck.length === 0) {
    return "computer";
  }
  if (computerDeck.length === 0) {
    return "player";
  }
  return null;
}

export function playRound(current: GameState): RoundResult {
  if (current.winner) {
    return {
      state: current,
      events: [`Game is over. ${current.winner.toUpperCase()} already won.`],
      pileCount: 0
    };
  }

  let playerDeck = [...current.playerDeck];
  let computerDeck = [...current.computerDeck];
  const events: string[] = [];
  const pile: Card[] = [];

  const startingWinner = determineWinnerByCards(playerDeck, computerDeck);
  if (startingWinner) {
    const state: GameState = {
      ...current,
      winner: startingWinner
    };
    return {
      state,
      events: [`${startingWinner.toUpperCase()} wins. Opponent has no cards left.`],
      pileCount: 0
    };
  }

  const pDraw = drawTop(playerDeck);
  const cDraw = drawTop(computerDeck);
  if (!pDraw.card || !cDraw.card) {
    const winner = pDraw.card ? "player" : "computer";
    return {
      state: {
        ...current,
        winner
      },
      events: [`${winner.toUpperCase()} wins. Opponent cannot draw.`],
      pileCount: 0
    };
  }

  playerDeck = pDraw.rest;
  computerDeck = cDraw.rest;
  let playerFaceUp = pDraw.card;
  let computerFaceUp = cDraw.card;

  pile.push(playerFaceUp, computerFaceUp);
  events.push(
    `Round ${current.round + 1}: Player ${formatCard(playerFaceUp)} vs Computer ${formatCard(computerFaceUp)}`
  );

  let comparison = compareCards(playerFaceUp, computerFaceUp);

  // WAR resolution loop:
  // 1) On a tie, both players place up to 3 face-down cards into the shared pile.
  // 2) Each must then place exactly 1 face-up card to continue comparison.
  // 3) If a player cannot place that face-up card, they immediately lose the game.
  // 4) If face-up cards tie again, repeat until someone wins the pile.
  while (comparison === 0) {
    events.push("WAR! Cards tied, escalating...");

    for (let i = 0; i < 3; i += 1) {
      if (playerDeck.length > 1) {
        pile.push(playerDeck[0]);
        playerDeck = playerDeck.slice(1);
      }
      if (computerDeck.length > 1) {
        pile.push(computerDeck[0]);
        computerDeck = computerDeck.slice(1);
      }
    }

    if (playerDeck.length === 0 || computerDeck.length === 0) {
      const winner: PlayerId = playerDeck.length === 0 ? "computer" : "player";
      events.push(`${winner.toUpperCase()} wins: opponent cannot continue war.`);

      const endState: GameState = {
        playerDeck,
        computerDeck,
        revealedPlayer: playerFaceUp,
        revealedComputer: computerFaceUp,
        round: current.round + 1,
        winner
      };

      return {
        state: endState,
        events,
        pileCount: pile.length
      };
    }

    const pWarDraw = drawTop(playerDeck);
    const cWarDraw = drawTop(computerDeck);

    if (!pWarDraw.card || !cWarDraw.card) {
      const winner: PlayerId = pWarDraw.card ? "player" : "computer";
      events.push(`${winner.toUpperCase()} wins: opponent cannot reveal war card.`);
      return {
        state: {
          playerDeck: pWarDraw.rest,
          computerDeck: cWarDraw.rest,
          revealedPlayer: pWarDraw.card ?? playerFaceUp,
          revealedComputer: cWarDraw.card ?? computerFaceUp,
          round: current.round + 1,
          winner
        },
        events,
        pileCount: pile.length
      };
    }

    playerDeck = pWarDraw.rest;
    computerDeck = cWarDraw.rest;
    playerFaceUp = pWarDraw.card;
    computerFaceUp = cWarDraw.card;
    pile.push(playerFaceUp, computerFaceUp);

    events.push(
      `War reveal: Player ${formatCard(playerFaceUp)} vs Computer ${formatCard(computerFaceUp)}`
    );
    comparison = compareCards(playerFaceUp, computerFaceUp);
  }

  const roundWinner: PlayerId = comparison > 0 ? "player" : "computer";
  events.push(`${roundWinner.toUpperCase()} wins ${pile.length} card(s).`);

  if (roundWinner === "player") {
    playerDeck = [...playerDeck, ...pile];
  } else {
    computerDeck = [...computerDeck, ...pile];
  }

  const winner = determineWinnerByCards(playerDeck, computerDeck);
  if (winner) {
    events.push(`${winner.toUpperCase()} wins the game.`);
  }

  return {
    state: {
      playerDeck,
      computerDeck,
      revealedPlayer: playerFaceUp,
      revealedComputer: computerFaceUp,
      round: current.round + 1,
      winner
    },
    events,
    pileCount: pile.length
  };
}
