"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { authClient } from "@/lib/auth/client";
import type { LeagueListResponse, LeagueSummary } from "@/lib/league/contracts";
import type {
  GameNightDuesStatus,
  GameNightSummary,
} from "@/lib/league/gameNightContracts";

const ACTIVE_LEAGUE_KEY = "dart-scorekeeper:active-league-id";

function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function niceStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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

export default function GameNightCheckInPage() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [leagueId, setLeagueId] = useState("");
  const [nights, setNights] = useState<GameNightSummary[]>([]);
  const [nightId, setNightId] = useState("");
  const [query, setQuery] = useState("");
  const [workingPlayerId, setWorkingPlayerId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const league = useMemo(
    () => leagues.find((item) => item.id === leagueId) ?? null,
    [leagueId, leagues],
  );
  const night = useMemo(
    () => nights.find((item) => item.id === nightId) ?? null,
    [nightId, nights],
  );

  const loadLeagues = useCallback(async () => {
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
  }, []);

  const loadNights = useCallback(async (selectedLeagueId: string) => {
    if (!selectedLeagueId) {
      setNights([]);
      setNightId("");
      return;
    }

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
    setNightId((current) => {
      if (current && sorted.some((item) => item.id === current)) return current;
      return chooseCurrentNight(sorted)?.id ?? "";
    });
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    const timer = window.setTimeout(() => {
      void loadLeagues().catch((error: unknown) => {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load leagues.",
        );
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLeagues, session?.user]);

  useEffect(() => {
    if (!leagueId) return;
    const timer = window.setTimeout(() => {
      void loadNights(leagueId).catch((error: unknown) => {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load Game Nights.",
        );
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [leagueId, loadNights]);

  async function updateAttendance(
    leaguePlayerId: string,
    displayName: string,
    checkedIn: boolean,
    duesStatus: GameNightDuesStatus,
  ) {
    if (!night) return;

    setWorkingPlayerId(leaguePlayerId);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch("/api/leagues/game-nights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "attendance",
          gameNightId: night.id,
          leaguePlayerId,
          checkedIn,
          duesStatus,
        }),
      });
      const result = (await response.json()) as {
        gameNight?: GameNightSummary;
        error?: string;
      };
      if (!response.ok || !result.gameNight) {
        throw new Error(result.error ?? "Attendance update failed.");
      }

      setNights((current) =>
        current.map((item) =>
          item.id === result.gameNight?.id ? result.gameNight : item,
        ),
      );
      setStatusMessage(
        `${displayName} ${checkedIn ? "checked in" : "checked out"}.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Attendance update failed.",
      );
    } finally {
      setWorkingPlayerId(null);
    }
  }

  const filteredAttendance = useMemo(() => {
    if (!night) return [];
    const normalized = query.trim().toLocaleLowerCase();
    const attendance = [...night.attendance].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
    if (!normalized) return attendance;
    return attendance.filter((player) =>
      player.displayName.toLocaleLowerCase().includes(normalized),
    );
  }, [night, query]);

  const checkedInCount =
    night?.attendance.filter((player) => player.status === "checked_in").length ??
    0;
  const duesPaidCount =
    night?.attendance.filter((player) => player.duesStatus === "paid").length ?? 0;
  const readOnly = night
    ? ["completed", "cancelled"].includes(night.status)
    : true;

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/game-nights/control"
              className="text-sm font-black text-[var(--color-primary)]"
            >
              ← Game Night Control
            </Link>
            <div className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
              Game Night
            </div>
            <h1 className="mt-1 text-3xl font-black">Player Check-in</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">
              Attendance belongs to a specific Game Night. League membership and
              season roster membership stay unchanged when a player checks in or
              out.
            </p>
          </div>
          <Link
            href="/league-roster"
            className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-4 py-2.5 text-sm font-black"
          >
            Player Directory
          </Link>
        </header>

        {isSessionPending && (
          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-[var(--color-text-muted)]">
            Checking account session…
          </section>
        )}

        {!isSessionPending && !session?.user && (
          <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6">
            <h2 className="text-xl font-black">Sign in to check players in</h2>
            <p className="mt-2 text-sm opacity-80">
              Game Night attendance is connected league data.
            </p>
          </section>
        )}

        {!isSessionPending && session?.user && leagues.length > 0 && (
          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-1 block text-sm font-bold">League</span>
                <select
                  value={leagueId}
                  onChange={(event) => {
                    const nextLeagueId = event.target.value;
                    setLeagueId(nextLeagueId);
                    setNightId("");
                    setQuery("");
                    setErrorMessage("");
                    setStatusMessage("");
                    window.localStorage.setItem(
                      ACTIVE_LEAGUE_KEY,
                      nextLeagueId,
                    );
                  }}
                  className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3 font-bold"
                >
                  {leagues.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1 block text-sm font-bold">Game Night</span>
                <select
                  value={nightId}
                  onChange={(event) => {
                    setNightId(event.target.value);
                    setQuery("");
                    setErrorMessage("");
                    setStatusMessage("");
                  }}
                  className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3 font-bold"
                >
                  {nights.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.seasonName} · {niceStatus(item.status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        )}

        {!isSessionPending && session?.user && league && nights.length === 0 && (
          <section className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
            <h2 className="text-xl font-black">No Game Night to check into</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Create a Game Night for {league.name} first. Its season roster will
              become the check-in list.
            </p>
            <Link
              href="/game-nights"
              className="mt-4 inline-flex rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-black text-white"
            >
              Create / manage Game Nights
            </Link>
          </section>
        )}

        {night && (
          <>
            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-[var(--color-primary)]">
                    {niceStatus(night.status)}
                  </div>
                  <h2 className="mt-1 text-2xl font-black">{night.name}</h2>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {league?.name} · {night.seasonName} · {formatDate(night.scheduledAt)}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-xl bg-[var(--color-panel-soft)] px-3 py-2">
                    <div className="text-lg font-black">{night.attendance.length}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Roster</div>
                  </div>
                  <div className="rounded-xl bg-[var(--color-panel-soft)] px-3 py-2">
                    <div className="text-lg font-black">{checkedInCount}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Checked in</div>
                  </div>
                  <div className="rounded-xl bg-[var(--color-panel-soft)] px-3 py-2">
                    <div className="text-lg font-black">{duesPaidCount}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Dues paid</div>
                  </div>
                </div>
              </div>

              {readOnly && (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  This Game Night is {niceStatus(night.status).toLocaleLowerCase()}.
                  Attendance is shown for reference and can no longer be changed.
                </div>
              )}
            </section>

            {statusMessage && !errorMessage && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
                {statusMessage}
              </div>
            )}
            {errorMessage && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm">
                {errorMessage}
              </div>
            )}

            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <label className="block flex-1">
                  <span className="mb-1 block text-sm font-bold">Find player</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search this season roster…"
                    className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
                  />
                </label>
                <div className="text-sm font-black">
                  {checkedInCount} / {night.attendance.length} checked in
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {filteredAttendance.map((player) => {
                  const isCheckedIn = player.status === "checked_in";
                  const isWorking = workingPlayerId === player.leaguePlayerId;
                  return (
                    <div
                      key={player.leaguePlayerId}
                      className="flex flex-col gap-3 rounded-xl border border-[var(--color-panel-border)] p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="font-black">{player.displayName}</div>
                        <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                          {isCheckedIn ? "Present tonight" : "Not checked in"}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={readOnly || isWorking}
                          onClick={() =>
                            void updateAttendance(
                              player.leaguePlayerId,
                              player.displayName,
                              !isCheckedIn,
                              player.duesStatus,
                            )
                          }
                          className={`rounded-lg px-4 py-2.5 text-sm font-black disabled:opacity-50 ${
                            isCheckedIn
                              ? "bg-emerald-500/20 text-emerald-100"
                              : "bg-[var(--color-primary)] text-white"
                          }`}
                        >
                          {isWorking
                            ? "Saving…"
                            : isCheckedIn
                              ? "Checked In ✓"
                              : "Check In"}
                        </button>
                        <select
                          value={player.duesStatus}
                          disabled={readOnly || isWorking}
                          onChange={(event) =>
                            void updateAttendance(
                              player.leaguePlayerId,
                              player.displayName,
                              isCheckedIn,
                              event.target.value as GameNightDuesStatus,
                            )
                          }
                          className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2.5 text-sm"
                        >
                          <option value="unpaid">Dues: Unpaid</option>
                          <option value="paid">Dues: Paid</option>
                          <option value="waived">Dues: Waived</option>
                        </select>
                      </div>
                    </div>
                  );
                })}

                {night.attendance.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[var(--color-panel-border)] p-5 text-sm text-[var(--color-text-muted)]">
                    This Game Night&apos;s season has no roster players. Add players
                    to {night.seasonName} in the Player Directory first.
                  </div>
                )}

                {night.attendance.length > 0 && filteredAttendance.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[var(--color-panel-border)] p-5 text-sm text-[var(--color-text-muted)]">
                    No roster players match that search.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
