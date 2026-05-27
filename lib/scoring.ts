export type StartingScore = 301 | 501 | 701;

export type FinishRule = "straight_out" | "double_out";

export type Player = {
  id: string;
  name: string;
  score: number;
};

export type Turn = {
  id: string;
  playerId: string;
  playerName: string;
  throwerId?: string;
  throwerName?: string;
  isDummy?: boolean;
  scoreEntered: number;
  scoreBefore: number;
  scoreAfter: number;
  dartsThrown: 1 | 2 | 3;
  isBust: boolean;
  isCheckout: boolean;
  finishRule: FinishRule;
};

export type ScoreResult = {
  turn: Turn;
  updatedPlayer: Player;
  isLegComplete: boolean;
  needsDoubleOutConfirmation: boolean;
  message: string;
};

export function validateTurnScore(scoreInput: string): string | null {
  const score = Number(scoreInput);

  if (scoreInput.trim() === "") {
    return "Enter a score first.";
  }

  if (!Number.isInteger(score)) {
    return "Enter a whole number.";
  }

  if (score < 0) {
    return "Score cannot be negative.";
  }

  if (score > 180) {
    return "Maximum score is 180.";
  }

  return null;
}

export function scoreTurn(
  player: Player,
  scoreEntered: number,
  finishRule: FinishRule,
): ScoreResult {
  const calculatedScore = player.score - scoreEntered;

  const isBust =
    calculatedScore < 0 ||
    (finishRule === "double_out" && calculatedScore === 1);

  const scoreAfter = isBust ? player.score : calculatedScore;
  const isCheckout = scoreAfter === 0 && !isBust;

  const turn: Turn = {
    id: crypto.randomUUID(),
    playerId: player.id,
    playerName: player.name,
    scoreEntered,
    scoreBefore: player.score,
    scoreAfter,
    dartsThrown: 3,
    isBust,
    isCheckout,
    finishRule,
  };

  const updatedPlayer: Player = {
    ...player,
    score: scoreAfter,
  };

  if (isBust) {
    return {
      turn,
      updatedPlayer,
      isLegComplete: false,
      needsDoubleOutConfirmation: false,
      message: `${player.name} busts!`,
    };
  }

  if (isCheckout && finishRule === "double_out") {
    return {
      turn,
      updatedPlayer,
      isLegComplete: false,
      needsDoubleOutConfirmation: true,
      message: `${player.name} reached zero. Was the final dart a double?`,
    };
  }

  if (isCheckout) {
    return {
      turn,
      updatedPlayer,
      isLegComplete: true,
      needsDoubleOutConfirmation: false,
      message: `${player.name} wins the leg!`,
    };
  }

  return {
    turn,
    updatedPlayer,
    isLegComplete: false,
    needsDoubleOutConfirmation: false,
    message: `${player.name} scored ${scoreEntered}.`,
  };
}
const checkoutSuggestions: Record<number, string> = {
  170: "T20 T20 Bull",
  167: "T20 T19 Bull",
  164: "T20 T18 Bull",
  161: "T20 T17 Bull",
  160: "T20 T20 D20",
  158: "T20 T20 D19",
  157: "T20 T19 D20",
  156: "T20 T20 D18",
  155: "T20 T19 D19",
  154: "T20 T18 D20",
  153: "T20 T19 D18",
  152: "T20 T20 D16",
  151: "T20 T17 D20",
  150: "T20 T18 D18",
  149: "T20 T19 D16",
  148: "T20 T16 D20",
  147: "T20 T17 D18",
  146: "T20 T18 D16",
  145: "T20 T15 D20",
  144: "T20 T20 D12",
  143: "T20 T17 D16",
  142: "T20 T14 D20",
  141: "T20 T19 D12",
  140: "T20 T20 D10",
  139: "T19 T14 D20",
  138: "T20 T18 D12",
  137: "T20 T19 D10",
  136: "T20 T20 D8",
  135: "T20 T17 D12",
  134: "T20 T14 D16",
  133: "T20 T19 D8",
  132: "T20 T16 D12",
  131: "T20 T13 D16",
  130: "T20 T20 D5",
  129: "T19 T16 D12",
  128: "T18 T18 D10",
  127: "T20 T17 D8",
  126: "T19 T19 D6",
  125: "T20 T15 D10",
  124: "T20 T16 D8",
  123: "T19 T16 D9",
  122: "T18 T18 D7",
  121: "T20 T11 D14",
  120: "T20 20 D20",
  119: "T19 T12 D13",
  118: "T20 18 D20",
  117: "T20 17 D20",
  116: "T20 16 D20",
  115: "T20 15 D20",
  114: "T20 14 D20",
  113: "T20 13 D20",
  112: "T20 12 D20",
  111: "T20 11 D20",
  110: "T20 10 D20",
  109: "T20 9 D20",
  108: "T20 8 D20",
  107: "T19 10 D20",
  106: "T20 6 D20",
  105: "T20 5 D20",
  104: "T18 18 D16",
  103: "T19 6 D20",
  102: "T20 10 D16",
  101: "T17 10 D20",
  100: "T20 D20",
  99: "T19 10 D16",
  98: "T20 D19",
  97: "T19 D20",
  96: "T20 D18",
  95: "T19 D19",
  94: "T18 D20",
  93: "T19 D18",
  92: "T20 D16",
  91: "T17 D20",
  90: "T18 D18",
  89: "T19 D16",
  88: "T16 D20",
  87: "T17 D18",
  86: "T18 D16",
  85: "T15 D20",
  84: "T20 D12",
  83: "T17 D16",
  82: "Bull D16",
  81: "T19 D12",
  80: "T20 D10",
  79: "T19 D11",
  78: "T18 D12",
  77: "T19 D10",
  76: "T20 D8",
  75: "T17 D12",
  74: "T14 D16",
  73: "T19 D8",
  72: "T16 D12",
  71: "T13 D16",
  70: "T10 D20",
  69: "T19 D6",
  68: "T20 D4",
  67: "T17 D8",
  66: "T10 D18",
  65: "T19 D4",
  64: "T16 D8",
  63: "T13 D12",
  62: "T10 D16",
  61: "T15 D8",
  60: "20 D20",
  59: "19 D20",
  58: "18 D20",
  57: "17 D20",
  56: "16 D20",
  55: "15 D20",
  54: "14 D20",
  53: "13 D20",
  52: "12 D20",
  51: "11 D20",
  50: "Bull",
  49: "17 D16",
  48: "16 D16",
  47: "15 D16",
  46: "14 D16",
  45: "13 D16",
  44: "12 D16",
  43: "11 D16",
  42: "10 D16",
  41: "9 D16",
  40: "D20",
  38: "D19",
  36: "D18",
  34: "D17",
  32: "D16",
  30: "D15",
  28: "D14",
  26: "D13",
  24: "D12",
  22: "D11",
  20: "D10",
  18: "D9",
  16: "D8",
  14: "D7",
  12: "D6",
  10: "D5",
  8: "D4",
  6: "D3",
  4: "D2",
  2: "D1",
};

export function getCheckoutSuggestion(score: number): string | null {
  return checkoutSuggestions[score] ?? null;
}
