"use client";

import {
  listPendingLocalX01MatchArchives,
  markLocalX01MatchArchiveSynced,
  markLocalX01MatchArchiveSyncError,
  storeSyncedLocalX01MatchArchive,
} from "@/lib/persistence";
import type {
  MatchSyncDownloadResponse,
  MatchSyncRunResult,
  MatchSyncUploadResponse,
} from "./contracts";

const SYNC_ENDPOINT = "/api/sync/matches";
const MAX_UPLOAD_BATCH = 25;

let activeSync: Promise<MatchSyncRunResult> | null = null;

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim()) {
      return body.error;
    }
  } catch {
    // Fall back to a status-based message below.
  }
  return `Sync request failed (${response.status}).`;
}

async function runSyncPass(): Promise<MatchSyncRunResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const pending = await listPendingLocalX01MatchArchives();
    return {
      status: "offline",
      uploaded: 0,
      downloaded: 0,
      pending: pending.length,
      message: "Offline. Completed matches will remain queued on this device.",
    };
  }

  let uploaded = 0;
  let downloaded = 0;

  try {
    const pendingRecords = await listPendingLocalX01MatchArchives();

    for (let index = 0; index < pendingRecords.length; index += MAX_UPLOAD_BATCH) {
      const batch = pendingRecords.slice(index, index + MAX_UPLOAD_BATCH);
      const response = await fetch(SYNC_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matches: batch.map((record) => record.archive),
        }),
      });

      if (response.status === 401) {
        return {
          status: "signed_out",
          uploaded,
          downloaded,
          pending: pendingRecords.length - uploaded,
          message: "Sign in to synchronize completed matches.",
        };
      }

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const result = (await response.json()) as MatchSyncUploadResponse;
      const syncedAt = result.serverTime || Date.now();

      for (const matchId of result.accepted) {
        await markLocalX01MatchArchiveSynced(matchId, syncedAt);
        uploaded += 1;
      }

      for (const syncError of result.errors) {
        await markLocalX01MatchArchiveSyncError(
          syncError.id,
          syncError.message,
          syncedAt,
        );
      }
    }

    const downloadResponse = await fetch(SYNC_ENDPOINT, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (downloadResponse.status === 401) {
      const pending = await listPendingLocalX01MatchArchives();
      return {
        status: "signed_out",
        uploaded,
        downloaded,
        pending: pending.length,
        message: "Sign in to synchronize completed matches.",
      };
    }

    if (!downloadResponse.ok) {
      throw new Error(await readErrorMessage(downloadResponse));
    }

    const download = (await downloadResponse.json()) as MatchSyncDownloadResponse;
    const downloadedAt = download.serverTime || Date.now();

    for (const archive of download.matches) {
      await storeSyncedLocalX01MatchArchive(archive, downloadedAt);
      downloaded += 1;
    }

    const remaining = await listPendingLocalX01MatchArchives();

    return {
      status: "synced",
      uploaded,
      downloaded,
      pending: remaining.length,
      message:
        remaining.length === 0
          ? "Completed match history is synchronized."
          : `${remaining.length} completed ${remaining.length === 1 ? "match is" : "matches are"} still pending.`,
    };
  } catch (error) {
    const pending = await listPendingLocalX01MatchArchives().catch(() => []);
    return {
      status: "error",
      uploaded,
      downloaded,
      pending: pending.length,
      message:
        error instanceof Error
          ? error.message
          : "Completed-match synchronization failed.",
    };
  }
}

/**
 * Synchronize completed match archives without allowing overlapping passes.
 * Active scoring is intentionally unrelated to this promise.
 */
export function syncCompletedMatches(): Promise<MatchSyncRunResult> {
  activeSync ??= runSyncPass().finally(() => {
    activeSync = null;
  });

  return activeSync;
}
