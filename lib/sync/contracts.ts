import type { X01MatchArchive } from "@/lib/persistence/contracts";

export type MatchSyncError = {
  id: string;
  message: string;
};

export type MatchSyncUploadResponse = {
  accepted: string[];
  errors: MatchSyncError[];
  serverTime: number;
};

export type MatchSyncDownloadResponse = {
  matches: X01MatchArchive[];
  serverTime: number;
};

export type MatchSyncRunResult = {
  status: "synced" | "signed_out" | "offline" | "error";
  uploaded: number;
  downloaded: number;
  pending: number;
  message: string;
};
