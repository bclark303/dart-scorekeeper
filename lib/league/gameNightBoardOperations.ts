export type GameNightBoardUsageSummary = {
  physicalBoardId: string;
  gameNightId: string;
  gameNightName: string;
  gameNightStatus: string;
  scheduledAt: number;
};

export type GameNightBoardOperationsResponse = {
  usages?: GameNightBoardUsageSummary[];
  error?: string;
};
