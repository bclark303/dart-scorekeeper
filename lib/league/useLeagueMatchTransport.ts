"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  LeagueMatchMutationRequest,
  LeagueMatchResponse,
  LeagueMatchScoreRequest,
  LeagueMatchSummary,
} from "@/lib/league/matchContracts";
import {
  applyOfflineLeagueMatchMutation,
  expectedStateForLeagueMatch,
  rebuildOfflineLeagueMatch,
} from "@/lib/league/offlineMatchReplica";
import {
  acknowledgeBoardMutation,
  clearBoardSyncProblem,
  enqueueBoardMutation,
  getBoardOfflineMatch,
  markBoardSyncProblem,
  queuedRequests,
  removeLatestQueuedScore,
  saveBoardMatchCheckpoint,
  type BoardOfflineMatchRecord,
  type BoardQueuedMutation,
} from "@/lib/persistence/boardMatchQueueStore";

export type BoardConnectionState =
  | "online"
  | "offline"
  | "syncing"
  | "conflict"
  | "credential";

export type LeagueMatchTransportState = {
  match: LeagueMatchSummary | null;
  loading: boolean;
  working: boolean;
  errorMessage: string;
  connectionState: BoardConnectionState | null;
  queue: BoardQueuedMutation[];
  syncProgress: { completed: number; total: number } | null;
  refresh: () => Promise<void>;
  mutate: (body: LeagueMatchMutationRequest) => Promise<LeagueMatchSummary | null>;
  retrySync: () => Promise<void>;
};

type TransportHttpError = Error & {
  status: number;
  errorCode: string | null;
};

function httpError(message: string, status: number, errorCode?: string | null) {
  const error = new Error(message) as TransportHttpError;
  error.status = status;
  error.errorCode = errorCode ?? null;
  return error;
}

function isHttpError(error: unknown): error is TransportHttpError {
  return (
    error instanceof Error &&
    "status" in error &&
    typeof (error as TransportHttpError).status === "number"
  );
}

function projectRecord(record: BoardOfflineMatchRecord) {
  return rebuildOfflineLeagueMatch(record.checkpoint, queuedRequests(record));
}

export function useLeagueMatchTransport(input: {
  matchId: string;
  authMode: "account" | "device";
  deviceKey?: string;
  deviceId?: string;
  accessReady: boolean;
}): LeagueMatchTransportState {
  const deviceMode = input.authMode === "device";
  const apiUrl = deviceMode ? "/api/board-device" : "/api/league-matches";
  const [match, setMatch] = useState<LeagueMatchSummary | null>(null);
  const [record, setRecord] = useState<BoardOfflineMatchRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [connectionState, setConnectionState] = useState<BoardConnectionState | null>(
    deviceMode ? "online" : null,
  );
  const [syncProgress, setSyncProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const syncingRef = useRef(false);

  const request = useCallback(
    async (method: "GET" | "POST", body?: LeagueMatchMutationRequest) => {
      const url =
        method === "GET"
          ? `${apiUrl}?matchId=${encodeURIComponent(input.matchId)}`
          : apiUrl;
      let response: Response;
      try {
        response = await fetch(url, {
          method,
          cache: "no-store",
          headers: {
            ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
            ...(deviceMode && input.deviceKey
              ? { Authorization: `Bearer ${input.deviceKey}` }
              : {}),
          },
          body: method === "POST" ? JSON.stringify(body) : undefined,
        });
      } catch (error) {
        throw httpError(
          error instanceof Error ? error.message : "Network request failed.",
          0,
          "network",
        );
      }

      let result: LeagueMatchResponse & { errorCode?: string };
      try {
        result = (await response.json()) as LeagueMatchResponse & {
          errorCode?: string;
        };
      } catch {
        throw httpError("The board service returned an invalid response.", response.status);
      }
      if (!response.ok || !result.match) {
        throw httpError(
          result.error ?? "League match update failed.",
          response.status,
          result.errorCode,
        );
      }
      return result.match;
    },
    [apiUrl, deviceMode, input.deviceKey, input.matchId],
  );

  const updateFromRecord = useCallback((next: BoardOfflineMatchRecord) => {
    setRecord(next);
    try {
      setMatch(projectRecord(next));
    } catch (error) {
      setConnectionState("conflict");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The local board queue could not be reconstructed.",
      );
    }
  }, []);

  const classifySyncFailure = useCallback(
    async (error: unknown) => {
      if (!deviceMode || !input.deviceId) return;
      const message =
        error instanceof Error ? error.message : "Board synchronization failed.";
      if (!isHttpError(error) || error.status === 0 || error.status >= 500) {
        const next = await markBoardSyncProblem({
          deviceId: input.deviceId,
          matchId: input.matchId,
          kind: "network",
          message,
        });
        setRecord(next);
        setConnectionState("offline");
        return;
      }

      if (
        error.errorCode === "device_credential" ||
        error.status === 401 ||
        (error.status === 403 && /disabled|credential|device key/i.test(message))
      ) {
        const next = await markBoardSyncProblem({
          deviceId: input.deviceId,
          matchId: input.matchId,
          kind: "credential",
          message,
        });
        setRecord(next);
        setConnectionState("credential");
        return;
      }

      const next = await markBoardSyncProblem({
        deviceId: input.deviceId,
        matchId: input.matchId,
        kind: "conflict",
        message,
      });
      setRecord(next);
      setConnectionState("conflict");
    },
    [deviceMode, input.deviceId, input.matchId],
  );

  const syncDeviceQueue = useCallback(
    async (forceConflictRetry = false) => {
      if (!deviceMode || !input.deviceId || !input.deviceKey || syncingRef.current) {
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setConnectionState("offline");
        return;
      }

      let local = await getBoardOfflineMatch(input.deviceId, input.matchId);
      if (local?.conflict?.kind === "conflict" && !forceConflictRetry) {
        setRecord(local);
        setConnectionState("conflict");
        return;
      }
      if (forceConflictRetry && local?.conflict) {
        local = await clearBoardSyncProblem(input.deviceId, input.matchId);
        setRecord(local);
      }

      syncingRef.current = true;
      setWorking(true);
      setErrorMessage("");
      try {
        const total = local?.queue.length ?? 0;
        if (total) {
          setConnectionState("syncing");
          setSyncProgress({ completed: 0, total });
        }

        let completed = 0;
        while (local?.queue.length) {
          const mutation = local.queue[0];
          let serverMatch: LeagueMatchSummary;
          try {
            serverMatch = await request("POST", mutation.request);
          } catch (error) {
            await classifySyncFailure(error);
            setErrorMessage(
              error instanceof Error ? error.message : "Board synchronization failed.",
            );
            return;
          }

          local = await acknowledgeBoardMutation({
            deviceId: input.deviceId,
            matchId: input.matchId,
            mutationId: mutation.id,
            checkpoint: serverMatch,
          });
          completed += 1;
          setSyncProgress({ completed, total });
          updateFromRecord(local);
        }

        try {
          const fresh = await request("GET");
          local = await saveBoardMatchCheckpoint(input.deviceId, fresh);
          updateFromRecord(local);
          setConnectionState("online");
          setErrorMessage("");
        } catch (error) {
          await classifySyncFailure(error);
          if (!local) {
            setErrorMessage(
              error instanceof Error ? error.message : "Could not refresh the board match.",
            );
          }
        }
      } finally {
        setSyncProgress(null);
        setWorking(false);
        syncingRef.current = false;
      }
    },
    [
      classifySyncFailure,
      deviceMode,
      input.deviceId,
      input.deviceKey,
      input.matchId,
      request,
      updateFromRecord,
    ],
  );

  const refresh = useCallback(async () => {
    if (!input.accessReady) return;
    if (!deviceMode) {
      setLoading(true);
      try {
        const fresh = await request("GET");
        setMatch(fresh);
        setErrorMessage("");
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load the board match.",
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!input.deviceId) return;
    setLoading(true);
    try {
      const local = await getBoardOfflineMatch(input.deviceId, input.matchId);
      if (local) updateFromRecord(local);
      if (local?.queue.length || local?.conflict) {
        await syncDeviceQueue(false);
        return;
      }
      try {
        const fresh = await request("GET");
        const next = await saveBoardMatchCheckpoint(input.deviceId, fresh);
        updateFromRecord(next);
        setConnectionState("online");
        setErrorMessage("");
      } catch (error) {
        if (local) {
          await classifySyncFailure(error);
        } else {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not load the board match.",
          );
          setConnectionState("offline");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [
    classifySyncFailure,
    deviceMode,
    input.accessReady,
    input.deviceId,
    input.matchId,
    request,
    syncDeviceQueue,
    updateFromRecord,
  ]);

  const mutate = useCallback(
    async (body: LeagueMatchMutationRequest): Promise<LeagueMatchSummary | null> => {
      if (!deviceMode) {
        setWorking(true);
        setErrorMessage("");
        try {
          const updated = await request("POST", body);
          setMatch(updated);
          return updated;
        } catch (error) {
          setErrorMessage(
            error instanceof Error ? error.message : "League match update failed.",
          );
          return null;
        } finally {
          setWorking(false);
        }
      }

      if (!input.deviceId || !match) return null;
      setErrorMessage("");

      if (body.action === "undo") {
        if (syncingRef.current) {
          setErrorMessage("Finish syncing queued turns before using Undo.");
          return null;
        }
        const local = await getBoardOfflineMatch(input.deviceId, input.matchId);
        if (local?.queue.some((item) => item.action === "score")) {
          const { record: next, removed } = await removeLatestQueuedScore(
            input.deviceId,
            input.matchId,
          );
          if (!removed) return null;
          updateFromRecord(next);
          setConnectionState(next.queue.length ? "offline" : "online");
          return projectRecord(next);
        }
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setConnectionState("offline");
          setErrorMessage(
            "This turn is already synced. Reconnect before undoing a server-confirmed turn.",
          );
          return null;
        }
        setWorking(true);
        try {
          const updated = await request("POST", body);
          const next = await saveBoardMatchCheckpoint(input.deviceId, updated);
          updateFromRecord(next);
          setConnectionState("online");
          return updated;
        } catch (error) {
          await classifySyncFailure(error);
          setErrorMessage(
            error instanceof Error ? error.message : "Undo failed.",
          );
          return null;
        } finally {
          setWorking(false);
        }
      }

      const local = await getBoardOfflineMatch(input.deviceId, input.matchId);
      const checkpoint = local?.checkpoint ?? match;
      const projection = local ? projectRecord(local) : match;
      let queuedRequest: LeagueMatchMutationRequest = body;
      let mutation: BoardQueuedMutation;
      const now = Date.now();

      if (body.action === "score") {
        const scoreRequest: LeagueMatchScoreRequest = {
          ...body,
          expectedState: expectedStateForLeagueMatch(projection),
        };
        queuedRequest = scoreRequest;
        const currentTeam =
          projection.currentTeamId === projection.teamA.id
            ? projection.teamA
            : projection.teamB;
        mutation = {
          id: scoreRequest.turnId,
          action: "score",
          queuedAt: now,
          request: scoreRequest,
          displayName: projection.currentMemberName ?? "Current thrower",
          teamName: currentTeam.name,
          legNumber: projection.currentLegNumber,
        };
      } else {
        mutation = {
          id: `start:${crypto.randomUUID()}`,
          action: "start",
          queuedAt: now,
          request: body,
        };
      }

      try {
        // Validate the local mutation before persisting it. This uses the same
        // X01 evaluator as the server and prevents malformed turns entering the queue.
        applyOfflineLeagueMatchMutation(projection, queuedRequest, now);
        const next = await enqueueBoardMutation({
          deviceId: input.deviceId,
          matchId: input.matchId,
          checkpoint,
          mutation,
        });
        const projected = projectRecord(next);
        updateFromRecord(next);
        setConnectionState(
          typeof navigator !== "undefined" && navigator.onLine ? "syncing" : "offline",
        );
        if (typeof navigator === "undefined" || navigator.onLine) {
          void syncDeviceQueue(false);
        }
        return projected;
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not queue the board update.",
        );
        return null;
      }
    },
    [
      classifySyncFailure,
      deviceMode,
      input.deviceId,
      input.matchId,
      match,
      request,
      syncDeviceQueue,
      updateFromRecord,
    ],
  );

  const retrySync = useCallback(async () => {
    await syncDeviceQueue(true);
  }, [syncDeviceQueue]);

  useEffect(() => {
    if (!input.accessReady) return;
    const timeout = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [input.accessReady, refresh]);

  useEffect(() => {
    if (!deviceMode) return;
    const onOffline = () => setConnectionState("offline");
    const onOnline = () => void syncDeviceQueue(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [deviceMode, syncDeviceQueue]);

  useEffect(() => {
    if (!deviceMode || !record?.queue.length) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [deviceMode, record?.queue.length]);

  return {
    match,
    loading,
    working,
    errorMessage,
    connectionState,
    queue: record?.queue ?? [],
    syncProgress,
    refresh,
    mutate,
    retrySync,
  };
}
