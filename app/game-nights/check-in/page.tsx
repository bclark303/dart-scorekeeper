"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { GameNightWorkspacePicker } from "@/components/GameNightWorkspacePicker";
import { authClient } from "@/lib/auth/client";
import type {
  GameNightAttendanceSummary,
  GameNightDuesStatus,
  GameNightSummary,
} from "@/lib/league/gameNightContracts";
import { useGameNightWorkspace } from "@/lib/league/useGameNightWorkspace";

type AttendanceFilter = "all" | "waiting" | "checked_in" | "dues";
type OptimisticAttendanceState = {
  checkedIn: boolean;
  duesStatus: GameNightDuesStatus;
  checkedInAt: number | null;
};

function attendanceMutationKey(gameNightId: string, leaguePlayerId: string) {
  return `${gameNightId}:${leaguePlayerId}`;
}

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

export default function GameNightCheckInPage() {
  const { data: session, isPending } = authClient.useSession();
  const workspace = useGameNightWorkspace(Boolean(session?.user));
  const [query, setQuery] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>("all");
  const [statusMessage, setStatusMessage] = useState("");
  const [optimisticAttendance, setOptimisticAttendance] = useState<
    Record<string, OptimisticAttendanceState>
  >({});
  const optimisticAttendanceRef = useRef<
    Record<string, OptimisticAttendanceState>
  >({});
  const processingMutationKeysRef = useRef(new Set<string>());
  const [savingMutationKeys, setSavingMutationKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const activeNightIdRef = useRef<string | null>(null);
  activeNightIdRef.current = workspace.night?.id ?? null;

  function updateOptimisticAttendance(
    updater: (
      current: Record<string, OptimisticAttendanceState>,
    ) => Record<string, OptimisticAttendanceState>,
  ) {
    const next = updater(optimisticAttendanceRef.current);
    optimisticAttendanceRef.current = next;
    setOptimisticAttendance(next);
  }

  function removeOptimisticAttendance(key: string) {
    updateOptimisticAttendance((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function clearOptimisticAttendance() {
    optimisticAttendanceRef.current = {};
    setOptimisticAttendance({});
  }

  function markMutationSaving(key: string, saving: boolean) {
    setSavingMutationKeys((current) => {
      const next = new Set(current);
      if (saving) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function flushAttendanceUpdates(
    gameNightId: string,
    leaguePlayerId: string,
  ) {
    const key = attendanceMutationKey(gameNightId, leaguePlayerId);
    if (processingMutationKeysRef.current.has(key)) return;

    processingMutationKeysRef.current.add(key);
    markMutationSaving(key, true);
    workspace.setErrorMessage("");

    try {
      while (true) {
        const desired = optimisticAttendanceRef.current[key];
        if (!desired) break;

        const response = await fetch("/api/leagues/game-nights", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "attendance",
            gameNightId,
            leaguePlayerId,
            checkedIn: desired.checkedIn,
            duesStatus: desired.duesStatus,
          }),
        });
        const result = (await response.json()) as {
          gameNight?: GameNightSummary;
          error?: string;
        };
        if (!response.ok || !result.gameNight) {
          throw new Error(result.error ?? "Attendance update failed.");
        }

        // Server responses still contain the authoritative Game Night. Apply them
        // only if the operator has not switched nights while the save was running.
        // Any newer optimistic values remain layered over this response below.
        if (activeNightIdRef.current === gameNightId) {
          workspace.applyNight(result.gameNight);
        }

        const latest = optimisticAttendanceRef.current[key];
        if (!latest) break;
        const serverCaughtUp =
          latest.checkedIn === desired.checkedIn &&
          latest.duesStatus === desired.duesStatus;
        if (serverCaughtUp) {
          removeOptimisticAttendance(key);
          break;
        }

        // The operator changed this same player again before the first request
        // finished. Loop once more with the newest desired state so requests for
        // one player stay ordered without blocking check-ins for other players.
      }
    } catch (error) {
      removeOptimisticAttendance(key);
      if (activeNightIdRef.current === gameNightId) {
        workspace.setErrorMessage(
          error instanceof Error ? error.message : "Attendance update failed.",
        );
        void workspace.refreshNight();
      }
    } finally {
      processingMutationKeysRef.current.delete(key);
      markMutationSaving(key, false);
    }
  }

  function queueAttendanceUpdate(
    player: GameNightAttendanceSummary,
    checkedIn: boolean,
    duesStatus: GameNightDuesStatus,
    message: string,
  ) {
    if (!workspace.night) return;

    const gameNightId = workspace.night.id;
    const key = attendanceMutationKey(gameNightId, player.leaguePlayerId);
    const checkedInAt = checkedIn
      ? player.status === "checked_in"
        ? player.checkedInAt ?? Date.now()
        : Date.now()
      : null;

    updateOptimisticAttendance((current) => ({
      ...current,
      [key]: { checkedIn, duesStatus, checkedInAt },
    }));
    workspace.setErrorMessage("");
    setStatusMessage(message);
    void flushAttendanceUpdates(gameNightId, player.leaguePlayerId);
  }

  const night = useMemo(() => {
    const baseNight = workspace.night;
    if (!baseNight) return null;

    let changed = false;
    const attendance = baseNight.attendance.map((player) => {
      const optimistic =
        optimisticAttendance[
          attendanceMutationKey(baseNight.id, player.leaguePlayerId)
        ];
      if (!optimistic) return player;
      changed = true;
      return {
        ...player,
        status: optimistic.checkedIn ? ("checked_in" as const) : ("absent" as const),
        duesStatus: optimistic.duesStatus,
        checkedInAt: optimistic.checkedInAt,
      };
    });

    return changed ? { ...baseNight, attendance } : baseNight;
  }, [optimisticAttendance, workspace.night]);

  const checkedInCount =
    night?.attendance.filter((player) => player.status === "checked_in").length ??
    0;
  const waitingCount = Math.max(0, (night?.attendance.length ?? 0) - checkedInCount);
  const duesPendingCount =
    night?.attendance.filter(
      (player) => player.status === "checked_in" && player.duesStatus === "unpaid",
    ).length ?? 0;
  const readOnly = night
    ? ["active", "completed", "cancelled"].includes(night.status)
    : true;

  const filteredAttendance = useMemo(() => {
    if (!night) return [];
    const normalized = query.trim().toLocaleLowerCase();
    const attendance = [...night.attendance]
      .filter((player) => {
        if (attendanceFilter === "waiting") {
          return player.status !== "checked_in";
        }
        if (attendanceFilter === "checked_in") {
          return player.status === "checked_in";
        }
        if (attendanceFilter === "dues") {
          return player.status === "checked_in" && player.duesStatus === "unpaid";
        }
        return true;
      })
      .filter(
        (player) =>
          !normalized ||
          player.displayName.toLocaleLowerCase().includes(normalized),
      )
      .sort((a, b) => {
        if (attendanceFilter === "all" && a.status !== b.status) {
          return a.status === "checked_in" ? 1 : -1;
        }
        return a.displayName.localeCompare(b.displayName);
      });
    return attendance;
  }, [attendanceFilter, night, query]);

  if (isPending) {
    return (
      <main className="mx-auto max-w-5xl p-6 text-[var(--color-text-muted)]">
        Loading account…
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-3xl font-black">Player Check-in</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Sign in before managing Game Night attendance.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
              Game Night
            </div>
            <h1 className="mt-1 text-3xl font-black">Player Check-in</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">
              Mark arrivals as they walk in and surface only the players who still
              need attention. This does not change the league roster.
            </p>
          </div>
          <Link
            href="/league-roster"
            className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-4 py-2.5 text-sm font-black"
          >
            Player Directory
          </Link>
        </header>

        {workspace.errorMessage && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm">
            {workspace.errorMessage}
          </div>
        )}
        {statusMessage && !workspace.errorMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
            {statusMessage}
          </div>
        )}

        <GameNightWorkspacePicker
          leagues={workspace.leagues}
          leagueId={workspace.leagueId}
          nights={workspace.nights}
          nightId={workspace.nightId}
          onLeagueChange={(leagueId) => {
            activeNightIdRef.current = null;
            clearOptimisticAttendance();
            workspace.selectLeague(leagueId);
            setQuery("");
            setAttendanceFilter("all");
            setStatusMessage("");
          }}
          onNightChange={(nightId) => {
            activeNightIdRef.current = nightId;
            clearOptimisticAttendance();
            workspace.selectNight(nightId);
            setQuery("");
            setAttendanceFilter("all");
            setStatusMessage("");
          }}
        />

        {night ? (
          <>
            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-[var(--color-primary)]">
                    {niceStatus(night.status)}
                  </div>
                  <h2 className="mt-1 text-2xl font-black">{night.name}</h2>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {workspace.league?.name} · {night.seasonName} · {formatDate(night.scheduledAt)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
                  <div className="rounded-xl bg-[var(--color-panel-soft)] px-3 py-2">
                    <div className="text-lg font-black">{night.attendance.length}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Roster</div>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 px-3 py-2">
                    <div className="text-lg font-black text-emerald-200">{checkedInCount}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Here</div>
                  </div>
                  <div className="rounded-xl bg-[var(--color-panel-soft)] px-3 py-2">
                    <div className="text-lg font-black">{waitingCount}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Still out</div>
                  </div>
                  <div className={`rounded-xl px-3 py-2 ${duesPendingCount ? "bg-amber-500/10" : "bg-[var(--color-panel-soft)]"}`}>
                    <div className={`text-lg font-black ${duesPendingCount ? "text-amber-200" : ""}`}>
                      {duesPendingCount}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">Dues pending</div>
                  </div>
                </div>
              </div>

              {readOnly && (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  Attendance is locked because this Game Night is already active or closed.
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-4 sm:p-5">
              <div className="flex flex-col gap-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Find player</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search this season roster…"
                    className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
                  />
                </label>

                <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Attendance filters">
                  {(
                    [
                      ["all", "All", night.attendance.length],
                      ["waiting", "Still out", waitingCount],
                      ["checked_in", "Here", checkedInCount],
                      ["dues", "Dues pending", duesPendingCount],
                    ] as const
                  ).map(([value, label, count]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={attendanceFilter === value}
                      onClick={() => setAttendanceFilter(value)}
                      className={`shrink-0 rounded-full border px-3 py-2 text-sm font-black ${
                        attendanceFilter === value
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
                          : "border-[var(--color-panel-border)] bg-[var(--color-panel-soft)]"
                      }`}
                    >
                      {label} · {count}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {filteredAttendance.map((player) => {
                  const isCheckedIn = player.status === "checked_in";
                  const mutationKey = attendanceMutationKey(
                    night.id,
                    player.leaguePlayerId,
                  );
                  const isSaving = savingMutationKeys.has(mutationKey);
                  const duesOutstanding = isCheckedIn && player.duesStatus === "unpaid";
                  return (
                    <div
                      key={player.leaguePlayerId}
                      aria-busy={isSaving}
                      className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${
                        isCheckedIn
                          ? "border-emerald-500/25 bg-emerald-500/5"
                          : "border-[var(--color-panel-border)]"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-black">{player.displayName}</div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wide ${
                              isCheckedIn
                                ? "bg-emerald-500/15 text-emerald-200"
                                : "bg-[var(--color-panel-soft)] text-[var(--color-text-muted)]"
                            }`}
                          >
                            {isCheckedIn ? "Here" : "Not here"}
                          </span>
                          {duesOutstanding && (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-amber-200">
                              Dues
                            </span>
                          )}
                          {isSaving && (
                            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-blue-200">
                              Saving…
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          disabled={readOnly}
                          aria-label={`${isCheckedIn ? "Check out" : "Check in"} ${player.displayName}`}
                          onClick={() =>
                            queueAttendanceUpdate(
                              player,
                              !isCheckedIn,
                              player.duesStatus,
                              `${player.displayName} ${isCheckedIn ? "checked out" : "checked in"}.`,
                            )
                          }
                          className={`min-h-11 rounded-xl px-4 py-2 text-sm font-black disabled:opacity-50 ${
                            isCheckedIn
                              ? "border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)]"
                              : "bg-[var(--color-primary)] text-white"
                          }`}
                        >
                          {isCheckedIn ? "Check Out" : "Check In"}
                        </button>
                        <select
                          value={player.duesStatus}
                          aria-label={`Dues for ${player.displayName}`}
                          disabled={readOnly}
                          onChange={(event) => {
                            const duesStatus = event.target.value as GameNightDuesStatus;
                            queueAttendanceUpdate(
                              player,
                              isCheckedIn,
                              duesStatus,
                              `${player.displayName} dues marked ${duesStatus}.`,
                            );
                          }}
                          className="min-h-11 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 text-sm disabled:opacity-50"
                        >
                          <option value="unpaid">Dues: Unpaid</option>
                          <option value="paid">Dues: Paid</option>
                          <option value="waived">Dues: Waived</option>
                        </select>
                      </div>
                    </div>
                  );
                })}

                {!night.attendance.length && (
                  <p className="rounded-xl border border-dashed border-[var(--color-panel-border)] p-4 text-sm text-[var(--color-text-muted)]">
                    This season has no active roster players yet.
                  </p>
                )}
                {night.attendance.length > 0 && !filteredAttendance.length && (
                  <p className="rounded-xl border border-dashed border-[var(--color-panel-border)] p-4 text-sm text-[var(--color-text-muted)]">
                    No players match this search and filter.
                  </p>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                  {readOnly ? "Return to operations" : checkedInCount >= 2 ? "Next step" : "Keep checking in"}
                </div>
                <div className="mt-1 font-black">
                  {readOnly
                    ? "Run this Game Night from the Control Room"
                    : checkedInCount >= 2
                      ? `Prepare teams from ${checkedInCount} checked-in players`
                      : "At least two checked-in players are needed before teams can be prepared"}
                </div>
              </div>
              {readOnly ? (
                <Link
                  href="/game-nights/control"
                  className="rounded-xl bg-[var(--color-primary)] px-5 py-3 text-center font-black text-white"
                >
                  Open Control Room →
                </Link>
              ) : checkedInCount >= 2 ? (
                <Link
                  href="/game-nights/teams"
                  className="rounded-xl bg-[var(--color-primary)] px-5 py-3 text-center font-black text-white"
                >
                  Open Teams →
                </Link>
              ) : null}
            </section>
          </>
        ) : !workspace.loading ? (
          <section className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
            <h2 className="text-xl font-black">No Game Night to check into</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Create a Game Night from the Hub first.
            </p>
            <Link
              href="/game-nights"
              className="mt-4 inline-flex rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-black text-white"
            >
              Open Game Night Hub
            </Link>
          </section>
        ) : null}
      </div>
    </main>
  );
}
