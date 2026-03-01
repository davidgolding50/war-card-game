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

export type HandPhase = "ready" | "awaiting_war_choice";

export type HandOutcome =
  | "player_win"
  | "dealer_win"
  | "war_offered"
  | "war_player_win"
  | "war_dealer_win"
  | "war_push"
  | "surrender";

export type CasinoWarState = {
  bankroll: number;
  phase: HandPhase;
  shoe: Deck;
  discard: Deck;
  handNumber: number;
  ante: number;
  warBet: number;
  playerCard: Card | null;
  dealerCard: Card | null;
};

export type DealResult = {
  state: CasinoWarState;
  outcome: HandOutcome;
  events: string[];
};

export type WarResult = {
  state: CasinoWarState;
  outcome: HandOutcome;
  events: string[];
  burnPlayer: Card[];
  burnDealer: Card[];
  warPlayerCard: Card;
  warDealerCard: Card;
};

const TABLE_MIN = 5;
const TABLE_MAX = 500;

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

function compareCards(a: Card, b: Card): number {
  return RANK_VALUE[a.rank] - RANK_VALUE[b.rank];
}

function drawTop(shoe: Deck): { card: Card; shoe: Deck } {
  if (shoe.length === 0) {
    throw new Error("Shoe is empty");
  }
  return { card: shoe[0], shoe: shoe.slice(1) };
}

function ensureShoe(state: CasinoWarState, rng: () => number): CasinoWarState {
  if (state.shoe.length >= 10) {
    return state;
  }
  const mixed = shuffleDeck([...state.shoe, ...state.discard], rng);
  return {
    ...state,
    shoe: mixed,
    discard: []
  };
}

export function createCasinoWarState(bankroll: number, rng: () => number = Math.random): CasinoWarState {
  if (bankroll <= 0) {
    throw new Error("Bankroll must be positive");
  }

  return {
    bankroll: Math.floor(bankroll),
    phase: "ready",
    shoe: shuffleDeck(buildDeck(), rng),
    discard: [],
    handNumber: 0,
    ante: 0,
    warBet: 0,
    playerCard: null,
    dealerCard: null
  };
}

export function clampAnte(amount: number): number {
  return Math.min(TABLE_MAX, Math.max(TABLE_MIN, Math.floor(amount)));
}

export function canPlaceAnte(state: CasinoWarState, ante: number): boolean {
  return state.phase === "ready" && ante >= TABLE_MIN && ante <= TABLE_MAX && state.bankroll >= ante;
}

export function dealHand(
  current: CasinoWarState,
  anteInput: number,
  rng: () => number = Math.random
): DealResult {
  const ante = clampAnte(anteInput);
  if (!canPlaceAnte(current, ante)) {
    throw new Error("Ante is invalid for current bankroll/state");
  }

  let state = ensureShoe(current, rng);

  const playerDraw = drawTop(state.shoe);
  const dealerDraw = drawTop(playerDraw.shoe);

  state = {
    ...state,
    bankroll: state.bankroll - ante,
    shoe: dealerDraw.shoe,
    handNumber: state.handNumber + 1,
    ante,
    warBet: 0,
    playerCard: playerDraw.card,
    dealerCard: dealerDraw.card
  };

  const compare = compareCards(playerDraw.card, dealerDraw.card);
  const events = [
    `Hand ${state.handNumber}: Player ${formatCard(playerDraw.card)} vs Dealer ${formatCard(dealerDraw.card)}`
  ];

  if (compare > 0) {
    state = {
      ...state,
      bankroll: state.bankroll + ante * 2,
      phase: "ready",
      discard: [...state.discard, playerDraw.card, dealerDraw.card]
    };
    events.push(`Player wins hand. Paid 1:1 on ante (${ante}).`);
    return { state, outcome: "player_win", events };
  }

  if (compare < 0) {
    state = {
      ...state,
      phase: "ready",
      discard: [...state.discard, playerDraw.card, dealerDraw.card]
    };
    events.push("Dealer wins hand. Ante lost.");
    return { state, outcome: "dealer_win", events };
  }

  state = {
    ...state,
    phase: "awaiting_war_choice"
  };
  events.push("Tie. Choose Surrender (lose half ante) or Go To War.");

  return { state, outcome: "war_offered", events };
}

export function surrender(current: CasinoWarState): DealResult {
  if (current.phase !== "awaiting_war_choice") {
    throw new Error("Surrender only available when war is offered");
  }
  if (!current.playerCard || !current.dealerCard) {
    throw new Error("Missing face-up cards for surrender");
  }

  const surrenderLoss = Math.ceil(current.ante / 2);
  const returnAmount = current.ante - surrenderLoss;

  const state: CasinoWarState = {
    ...current,
    bankroll: current.bankroll + returnAmount,
    phase: "ready",
    warBet: 0,
    discard: [...current.discard, current.playerCard, current.dealerCard]
  };

  return {
    state,
    outcome: "surrender",
    events: [`Player surrenders. Returns ${returnAmount}, loses ${surrenderLoss}.`]
  };
}

export function canGoToWar(current: CasinoWarState): boolean {
  return current.phase === "awaiting_war_choice" && current.bankroll >= current.ante;
}

export function goToWar(current: CasinoWarState, rng: () => number = Math.random): WarResult {
  if (current.phase !== "awaiting_war_choice") {
    throw new Error("War only available when war is offered");
  }
  if (!current.playerCard || !current.dealerCard) {
    throw new Error("Missing face-up cards for war");
  }
  if (!canGoToWar(current)) {
    throw new Error("Insufficient bankroll to place war bet");
  }

  let state = ensureShoe(current, rng);
  state = {
    ...state,
    bankroll: state.bankroll - state.ante,
    warBet: state.ante
  };

  const burnPlayer: Card[] = [];
  const burnDealer: Card[] = [];

  for (let i = 0; i < 3; i += 1) {
    const p = drawTop(state.shoe);
    const d = drawTop(p.shoe);
    burnPlayer.push(p.card);
    burnDealer.push(d.card);
    state = {
      ...state,
      shoe: d.shoe
    };
  }

  const pFinal = drawTop(state.shoe);
  const dFinal = drawTop(pFinal.shoe);
  const warPlayerCard = pFinal.card;
  const warDealerCard = dFinal.card;

  state = {
    ...state,
    shoe: dFinal.shoe,
    phase: "ready"
  };

  const compare = compareCards(warPlayerCard, warDealerCard);
  const events = [
    `WAR: Player ${formatCard(warPlayerCard)} vs Dealer ${formatCard(warDealerCard)} after 3 burn cards each.`
  ];

  const warPile = [
    current.playerCard,
    current.dealerCard,
    ...burnPlayer,
    ...burnDealer,
    warPlayerCard,
    warDealerCard
  ];

  if (compare > 0) {
    state = {
      ...state,
      bankroll: state.bankroll + current.ante + state.warBet * 2,
      discard: [...state.discard, ...warPile],
      warBet: 0
    };
    events.push(`Player wins WAR. Ante pushes; war bet pays 1:1 (${state.ante}).`);
    return {
      state,
      outcome: "war_player_win",
      events,
      burnPlayer,
      burnDealer,
      warPlayerCard,
      warDealerCard
    };
  }

  if (compare < 0) {
    state = {
      ...state,
      discard: [...state.discard, ...warPile],
      warBet: 0
    };
    events.push("Dealer wins WAR. Ante and war bet lost.");
    return {
      state,
      outcome: "war_dealer_win",
      events,
      burnPlayer,
      burnDealer,
      warPlayerCard,
      warDealerCard
    };
  }

  state = {
    ...state,
    bankroll: state.bankroll + current.ante + state.warBet,
    discard: [...state.discard, ...warPile],
    warBet: 0
  };
  events.push("WAR push. Ante and war bet returned.");
  return {
    state,
    outcome: "war_push",
    events,
    burnPlayer,
    burnDealer,
    warPlayerCard,
    warDealerCard
  };
}

export function tableLimits() {
  return { min: TABLE_MIN, max: TABLE_MAX };
}
