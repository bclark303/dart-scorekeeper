export type GameNightReadinessStatus = "pass" | "warn" | "block";

export type GameNightReadinessCheckId =
  | "venue"
  | "attendance"
  | "teams"
  | "boards"
  | "scorers"
  | "fixtures"
  | "conflicts"
  | "dues";

export type GameNightReadinessCheck = {
  id: GameNightReadinessCheckId;
  title: string;
  status: GameNightReadinessStatus;
  blocksStart: boolean;
  summary: string;
  detail?: string;
  href: string;
  action: string;
};

export type GameNightReadinessResponse = {
  ready?: boolean;
  requiredPassed?: number;
  requiredTotal?: number;
  blockingCount?: number;
  warningCount?: number;
  checkedAt?: number;
  checks?: GameNightReadinessCheck[];
  error?: string;
};

/**
 * A scorer is considered live only when it has checked in recently enough that
 * an administrator can reasonably trust the tablet/browser is still present.
 * Board devices poll every five seconds, so a 20-second window tolerates a few
 * delayed requests without calling a healthy board offline.
 */
export const GAME_NIGHT_SCORER_ONLINE_WINDOW_MS = 20_000;
