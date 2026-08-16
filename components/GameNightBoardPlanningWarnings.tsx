"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  GameNightBoardOperationsResponse,
  GameNightBoardUsageSummary,
} from "@/lib/league/gameNightBoardOperations";
import type { GameNightSummary } from "@/lib/league/gameNightContracts";

function formatScheduledAt(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function GameNightBoardPlanningWarnings({ night }: { night: GameNightSummary }) {
  const [usages, setUsages] = useState<GameNightBoardUsageSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams({ gameNightId: night.id });
    const response = await fetch(
      `/api/leagues/game-nights/board-operations?${params.toString()}`,
      { cache: "no-store" },
    );
    const result = (await response.json()) as GameNightBoardOperationsResponse;
    if (!response.ok) throw new Error(result.error ?? "Could not check board allocations.");
    setUsages(result.usages ?? []);
    setErrorMessage("");
  }, [night.id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load().catch((error) =>
        setErrorMessage(error instanceof Error ? error.message : "Could not check board allocations."),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load, night.boards]);

  const selectedWarnings = useMemo(() => {
    const boardNameByPhysicalId = new Map(
      night.boards
        .filter((board) => board.physicalBoardId)
        .map((board) => [board.physicalBoardId!, board.name]),
    );
    return usages
      .filter((usage) => boardNameByPhysicalId.has(usage.physicalBoardId))
      .map((usage) => ({
        ...usage,
        boardName: boardNameByPhysicalId.get(usage.physicalBoardId) ?? "Selected board",
      }));
  }, [night.boards, usages]);

  if (errorMessage) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
        Could not check other Game Night allocations: {errorMessage}
      </div>
    );
  }
  if (!selectedWarnings.length) return null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-50">
      <div className="font-black">Shared board allocation warning</div>
      <p className="mt-1 text-xs text-amber-100/80">
        Pre-play sharing is allowed because Game Nights do not yet have an end time. The server still blocks two active Game Nights from using the same physical board at once.
      </p>
      <div className="mt-3 space-y-1 text-xs">
        {selectedWarnings.map((usage) => (
          <div key={`${usage.gameNightId}:${usage.physicalBoardId}`}>
            <strong>{usage.boardName}</strong> is also allocated to {usage.gameNightName} · {usage.gameNightStatus} · {formatScheduledAt(usage.scheduledAt)}
          </div>
        ))}
      </div>
    </div>
  );
}
