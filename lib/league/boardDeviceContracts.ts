import type { LeagueMatchSummary } from "./matchContracts";

export type VenueStatus = "active" | "archived";
export type PhysicalBoardStatus = "active" | "out_of_service";
export type BoardDeviceStatus = "active" | "disabled";

export type VenueSummary = {
  id: string;
  name: string;
  status: VenueStatus;
  createdAt: number;
  updatedAt: number;
};

export type PhysicalBoardSummary = {
  id: string;
  venueId: string;
  boardNumber: number;
  name: string;
  status: PhysicalBoardStatus;
  createdAt: number;
  updatedAt: number;
};

export type BoardDeviceSummary = {
  id: string;
  venueId: string;
  venueName: string;
  name: string;
  /** The permanent board currently served by this device, or null for a spare. */
  physicalBoardId: string | null;
  /** Convenience snapshot derived from physicalBoardId; not device identity. */
  boardNumber: number | null;
  boardName: string | null;
  status: BoardDeviceStatus;
  lastSeenAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type VenueHardwareResponse = {
  /** Venues already linked to the selected league. */
  venues?: VenueSummary[];
  /** Venues the current administrator may link to this league. */
  availableVenues?: VenueSummary[];
  venue?: VenueSummary;
  boards?: PhysicalBoardSummary[];
  devices?: BoardDeviceSummary[];
  device?: BoardDeviceSummary;
  board?: PhysicalBoardSummary;
  /** Returned only once after register/rotate. Never persisted or returned by list. */
  deviceKey?: string;
  error?: string;
};

export type BoardDeviceAssignmentSummary = {
  gameNightId: string;
  gameNightName: string;
  gameNightStatus: string;
  scheduledAt: number;
  boardId: string;
  physicalBoardId: string;
  boardName: string;
  boardNumber: number;
  roundNumber?: number;
  matchSessionId: string | null;
  matchStatus: "scheduled" | "active" | "completed" | null;
  teamAName: string | null;
  teamBName: string | null;
};

/** Backward-compatible response alias used by existing route/client code. */
export type BoardDeviceAdminResponse = VenueHardwareResponse;

export type BoardDeviceConnectionResponse = {
  device?: BoardDeviceSummary;
  assignment?: BoardDeviceAssignmentSummary | null;
  match?: LeagueMatchSummary | null;
  error?: string;
};

export type RegisterBoardDeviceRequest = {
  /** leagueId authorizes access; it does not become device ownership. */
  leagueId: string;
  venueId?: string;
  name: string;
  physicalBoardId?: string | null;
  /** Legacy convenience accepted while old clients migrate. */
  boardNumber?: number;
};

export type UpdateBoardDeviceRequest = {
  deviceId: string;
  name?: string;
  physicalBoardId?: string | null;
  /** Legacy convenience accepted while old clients migrate. */
  boardNumber?: number;
  status?: BoardDeviceStatus;
};
