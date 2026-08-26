"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { LeagueListResponse, LeagueSummary } from "@/lib/league/contracts";
import type { GameNightSummary } from "@/lib/league/gameNightContracts";

export const ACTIVE_LEAGUE_KEY = "dart-scorekeeper:active-league-id";
export const ACTIVE_GAME_NIGHT_KEY = "dart-scorekeeper:active-game-night-id";

function chooseCurrentNight(nights: GameNightSummary[]) {
  const active = nights.find((night) => night.status === "active");
  if (active) return active;

  const now = Date.now();
  const open = nights.filter(
    (night) => !["completed", "cancelled"].includes(night.status),
  );
  if (open.length) {
    return open.reduce((closest, night) =>
      Math.abs(night.scheduledAt - now) < Math.abs(closest.scheduledAt - now)
        ? night
        : closest,
    );
  }

  return nights.at(-1) ?? null;
}

export function useGameNightWorkspace(enabled: boolean) {
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [leagueId, setLeagueId] = useState("");
  const [nights, setNights] = useState<GameNightSummary[]>([]);
  const [nightId, setNightId] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const league = useMemo(
    () => leagues.find((item) => item.id === leagueId) ?? null,
    [leagueId, leagues],
  );
  const night = useMemo(
    () => nights.find((item) => item.id === nightId) ?? null,
    [nightId, nights],
  );

  const loadLeagues = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/leagues", { cache: "no-store" });
      const result = (await response.json()) as LeagueListResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Could not load leagues.");
      }

      setLeagues(result.leagues);
      const remembered = window.localStorage.getItem(ACTIVE_LEAGUE_KEY);
      const resolved =
        (remembered &&
          result.leagues.some((item) => item.id === remembered) &&
          remembered) ||
        result.leagues[0]?.id ||
        "";
      setLeagueId(resolved);
      if (resolved) window.localStorage.setItem(ACTIVE_LEAGUE_KEY, resolved);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load leagues.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNights = useCallback(async (selectedLeagueId: string) => {
    if (!selectedLeagueId) {
      setNights([]);
      setNightId("");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/leagues/game-nights?leagueId=${encodeURIComponent(selectedLeagueId)}`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as {
        gameNights?: GameNightSummary[];
        error?: string;
      };
      if (!response.ok || !result.gameNights) {
        throw new Error(result.error ?? "Could not load Game Nights.");
      }

      const sorted = [...result.gameNights].sort(
        (a, b) => a.scheduledAt - b.scheduledAt,
      );
      setNights(sorted);

      const remembered = window.localStorage.getItem(ACTIVE_GAME_NIGHT_KEY);
      const resolved =
        (remembered && sorted.find((item) => item.id === remembered)) ||
        chooseCurrentNight(sorted);
      setNightId(resolved?.id ?? "");
      if (resolved) {
        window.localStorage.setItem(ACTIVE_GAME_NIGHT_KEY, resolved.id);
      }
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load Game Nights.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => void loadLeagues(), 0);
    return () => window.clearTimeout(timer);
  }, [enabled, loadLeagues]);

  useEffect(() => {
    if (!enabled || !leagueId) return;
    const timer = window.setTimeout(() => void loadNights(leagueId), 0);
    return () => window.clearTimeout(timer);
  }, [enabled, leagueId, loadNights]);

  const selectLeague = useCallback((nextLeagueId: string) => {
    setLeagueId(nextLeagueId);
    setNights([]);
    setNightId("");
    setErrorMessage("");
    if (nextLeagueId) {
      window.localStorage.setItem(ACTIVE_LEAGUE_KEY, nextLeagueId);
    } else {
      window.localStorage.removeItem(ACTIVE_LEAGUE_KEY);
    }
    window.localStorage.removeItem(ACTIVE_GAME_NIGHT_KEY);
  }, []);

  const selectNight = useCallback((nextNightId: string) => {
    setNightId(nextNightId);
    setErrorMessage("");
    if (nextNightId) {
      window.localStorage.setItem(ACTIVE_GAME_NIGHT_KEY, nextNightId);
    } else {
      window.localStorage.removeItem(ACTIVE_GAME_NIGHT_KEY);
    }
  }, []);

  const applyNight = useCallback((updated: GameNightSummary) => {
    setNights((current) => {
      const exists = current.some((item) => item.id === updated.id);
      const next = exists
        ? current.map((item) => (item.id === updated.id ? updated : item))
        : [...current, updated];
      return next.sort((a, b) => a.scheduledAt - b.scheduledAt);
    });
    setNightId(updated.id);
    window.localStorage.setItem(ACTIVE_GAME_NIGHT_KEY, updated.id);
  }, []);

  const refreshNight = useCallback(async () => {
    if (!nightId) return null;
    try {
      const response = await fetch(
        `/api/leagues/game-nights?gameNightId=${encodeURIComponent(nightId)}`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as {
        gameNight?: GameNightSummary;
        error?: string;
      };
      if (!response.ok || !result.gameNight) {
        throw new Error(result.error ?? "Could not refresh Game Night.");
      }
      applyNight(result.gameNight);
      setErrorMessage("");
      return result.gameNight;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not refresh Game Night.",
      );
      return null;
    }
  }, [applyNight, nightId]);

  return {
    leagues,
    league,
    leagueId,
    nights,
    night,
    nightId,
    loading,
    errorMessage,
    setErrorMessage,
    selectLeague,
    selectNight,
    applyNight,
    refreshNight,
    reloadNights: () => loadNights(leagueId),
  };
}
