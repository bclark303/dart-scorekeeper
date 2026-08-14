"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { GameNightWorkspacePicker } from "@/components/GameNightWorkspacePicker";
import { authClient } from "@/lib/auth/client";
import type {
  GameNightDuesStatus,
  GameNightSummary,
} from "@/lib/league/gameNightContracts";
import { useGameNightWorkspace } from "@/lib/league/useGameNightWorkspace";

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
  const [workingPlayerId, setWorkingPlayerId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  async function updateAttendance(
    leaguePlayerId: string,
    displayName: string,
    checkedIn: boolean,
    duesStatus: GameNightDuesStatus,
  ) {
    if (!workspace.night) return;

    setWorkingPlayerId(leaguePlayerId);
    workspace.setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch("/api/leagues/game-nights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "attendance",
          gameNightId: workspace.night.id,
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

      workspace.applyNight(result.gameNight);
      setStatusMessage(
        `${displayName} ${checkedIn ? "checked in" : "checked out"}.`,
      );
    } catch (error) {
      workspace.setErrorMessage(
        error instanceof Error ? error.message : "Attendance update failed.",
      );
    } finally {
      setWorkingPlayerId(null);
    }
  }

  const filteredAttendance = useMemo(() => {
    if (!workspace.night) return [];
    const normalized = query.trim().toLocaleLowerCase();
    const attendance = [...workspace.night.attendance].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
    if (!normalized) return attendance;
    return attendance.filter((player) =>
      player.displayName.toLocaleLowerCase().includes(normalized),
    );
  }, [query, workspace.night]);

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

  const night = workspace.night;
  const checkedInCount =
    night?.attendance.filter((player) => player.status === "checked_in").length ??
    0;
  const duesPaidCount =
    night?.attendance.filter((player) => player.duesStatus === "paid").length ?? 0;
  const duesPendingCount =
    night?.attendance.filter(
      (player) => player.status === "checked_in" && player.duesStatus === "unpaid",
    ).length ?? 0;
  const readOnly = night
    ? ["active", "completed", "cancelled"].includes(night.status)
    : true;

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
              Attendance and dues apply only to this Game Night. League and season
              roster membership are not changed here.
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
            workspace.selectLeague(leagueId);
            setQuery("");
            setStatusMessage("");
          }}
          onNightChange={(nightId) => {
            workspace.selectNight(nightId);
            setQuery("");
            setStatusMessage("");
          }}
        />

        {night ? (
          <>
            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-[var(--color-primary)]">
                    {niceStatus(night.status)}
                  </div>
                  <h2 className="mt-1 text-2xl font-black">{night.name}</h2>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {workspace.league?.name} · {night.seasonName} · {formatDate(night.scheduledAt)}
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

              {duesPendingCount > 0 && (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  {duesPendingCount} checked-in player{duesPendingCount === 1 ? " has" : "s have"} dues outstanding.
                </div>
              )}
              {readOnly && (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  Attendance is locked while this Game Night is active or closed.
                </div>
              )}
            </section>

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
                          {isCheckedIn ? "Present" : "Not checked in"}
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
                          className={`rounded-lg px-3 py-2 text-sm font-black disabled:opacity-50 ${
                            isCheckedIn
                              ? "bg-emerald-500/20 text-emerald-100"
                              : "bg-[var(--color-panel-soft)]"
                          }`}
                        >
                          {isCheckedIn ? "Checked In ✓" : "Check In"}
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
                          className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 text-sm disabled:opacity-50"
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
                  <p className="text-sm text-[var(--color-text-muted)]">
                    This season has no active roster players yet.
                  </p>
                )}
                {night.attendance.length > 0 && !filteredAttendance.length && (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    No players match that search.
                  </p>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                  Next step
                </div>
                <div className="mt-1 font-black">Prepare teams from checked-in players</div>
              </div>
              <Link
                href="/game-nights/teams"
                className="rounded-xl bg-[var(--color-primary)] px-5 py-3 text-center font-black text-white"
              >
                Open Teams →
              </Link>
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
