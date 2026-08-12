import type { LeagueMatchSummary } from "./matchContracts";

export type BoardDeviceStatus = "active" | "disabled";

export type BoardDeviceSummary = {
  id: string;
  leagueId: string;
  leagueName: string;
  name: string;
  boardNumber: number;
  status: BoardDeviceStatus;
  lastSeenAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type BoardDeviceAssignmentSummary = {
  gameNightId: string;
  gameNightName: string;
  gameNightStatus: string;
  scheduledAt: number;
  boardId: string;
  boardName: string;
  boardNumber: number;
  roundNumber?: number;
  matchSessionId: string | null;
  matchStatus: "scheduled" | "active" | "completed" | null;
  teamAName: string | null;
  teamBName: string | null;
};

export type BoardDeviceAdminResponse = {
  devices?: BoardDeviceSummary[];
  device?: BoardDeviceSummary;
  /** Returned only once after register/rotate. Never persisted or returned by list. */
  deviceKey?: string;
  error?: string;
};

export type BoardDeviceConnectionResponse = {
  device?: BoardDeviceSummary;
  assignment?: BoardDeviceAssignmentSummary | null;
  match?: LeagueMatchSummary | null;
  error?: string;
};

export type RegisterBoardDeviceRequest = {
  leagueId: string;
  name: string;
  boardNumber: number;
};

export type UpdateBoardDeviceRequest = {
  deviceId: string;
  name?: string;
  boardNumber?: number;
  status?: BoardDeviceStatus;
};
