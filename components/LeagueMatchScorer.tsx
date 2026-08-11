"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { authClient } from "@/lib/auth/client";
import type {
  LeagueMatchMutationRequest,
  LeagueMatchResponse,
  LeagueMatchSummary,
} from "@/lib/league/matchContracts";
import { validateTurnScore } from "@/lib/scoring";

type PendingCheckout = {
  scoreEntered: number;
  dartsThrown: 1 | 2 | 3;
};

const quickScores = [26, 41, 45, 60, 81, 100, 140, 180];

function statusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function LeagueMatchScorer({ matchId }: { matchId: string }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [match, setMatch] = useState<LeagueMatchSummary | null>(null);
  const [scoreInput, setScoreInput] = useState("");
  const [dartsThrown, setDartsThrown] = useState<1 | 2 | 3>(3);
  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckout | null>(null);
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const loadMatch = useCallback(async () => {
    if (!matchId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/league-matches?matchId=${encodeURIComponent(matchId)}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as LeagueMatchResponse;
      if (!response.ok || !result.match) {
        throw new Error(result.error ?? "Could not load the board match.");
      }
      setMatch(result.match);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load the board match.");
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    if (!session?.user) return;
    const timeoutId = window.setTimeout(() => void loadMatch(), 0);
    const intervalId = window.setInterval(() => void loadMatch(), 5000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadMatch, session?.user]);

  const currentTeam = useMemo(() => {
    if (!match?.currentTeamId) return null;
    return match.currentTeamId === match.teamA.id ? match.teamA : match.teamB;
  }, [match]);

  const currentMember = useMemo(
    () => currentTeam?.members.find((member) => member.id === match?.currentMemberId) ?? null,
    [currentTeam, match?.currentMemberId],
  );

  async function mutate(body: LeagueMatchMutationRequest, message?: string) {
    setWorking(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch("/api/league-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as LeagueMatchResponse;
      if (!response.ok || !result.match) {
        throw new Error(result.error ?? "League match update failed.");
      }
      setMatch(result.match);
      if (message) setStatusMessage(message);
      return result.match;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "League match update failed.");
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function sendScore(
    scoreEntered: number,
    darts: 1 | 2 | 3,
    checkoutConfirmed = false,
  ) {
    const turnId = crypto.randomUUID();
    const updated = await mutate({
      action: "score",
      matchId,
      turnId,
      scoreEntered,
      dartsThrown: darts,
      checkoutConfirmed,
    });
    if (updated) {
      setScoreInput("");
      setDartsThrown(3);
      setPendingCheckout(null);
      if (updated.status === "completed") {
        const winner =
          updated.winnerTeamId === updated.teamA.id
            ? updated.teamA.name
            : updated.winnerTeamId === updated.teamB.id
              ? updated.teamB.name
              : null;
        setStatusMessage(winner ? `${winner} wins the board match.` : "Board match completed as a tie.");
      }
    }
  }

  async function submitScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!match || !currentTeam) return;

    const validationError = validateTurnScore(scoreInput);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const scoreEntered = Number(scoreInput);
    if (match.finishRule === "double" && scoreEntered === currentTeam.score) {
      setPendingCheckout({ scoreEntered, dartsThrown });
      setErrorMessage("");
      return;
    }

    await sendScore(scoreEntered, dartsThrown);
  }

  if (sessionPending) {
    return <main className="mx-auto max-w-5xl p-6 text-[var(--color-text-muted)]">Loading account…</main>;
  }

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Link href="/" className="text-sm font-semibold text-[var(--color-primary)]">← Back to scorekeeper</Link>
        <section className="mt-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
          <h1 className="text-3xl font-bold">League Board Scorer</h1>
          <p className="mt-2 text-[var(--color-text-muted)]">Sign in before opening a centrally managed league match.</p>
        </section>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <Link href="/game-nights" className="text-sm font-semibold text-[var(--color-primary)]">← Back to Game Nights</Link>
        <section className="mt-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
          <h1 className="text-3xl font-bold">League Board Scorer</h1>
          <p className="mt-2 text-[var(--color-text-muted)]">{loading ? "Loading board assignment…" : errorMessage || "Match not found."}</p>
        </section>
      </main>
    );
  }

  const winner =
    match.winnerTeamId === match.teamA.id
      ? match.teamA
      : match.winnerTeamId === match.teamB.id
        ? match.teamB
        : null;

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/game-nights" className="text-sm font-semibold text-[var(--color-primary)]">← Back to Game Nights</Link>
          <div className="mt-2 text-sm uppercase tracking-wide text-[var(--color-text-muted)]">
            {match.gameNightName} · {match.seasonName}
          </div>
          <h1 className="text-3xl font-bold">{match.boardName}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {match.startingScore} · {match.finishRule === "double" ? "Double out" : "Straight out"} · {match.legsPerMatch} legs total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[var(--color-panel-border)] px-3 py-1 text-xs font-bold uppercase">
            {statusLabel(match.status)}
          </span>
          <button type="button" disabled={loading || working} onClick={() => void loadMatch()} className="rounded-xl border border-[var(--color-panel-border)] px-3 py-2 text-sm font-bold disabled:opacity-50">
            Refresh
          </button>
        </div>
      </div>

      {errorMessage && <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">{errorMessage}</div>}
      {statusMessage && <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">{statusMessage}</div>}

      {match.status === "scheduled" && (
        <section className="mb-5 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
          <h2 className="text-xl font-bold">Board assignment ready</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            This match is centrally assigned to {match.boardName}. Start the overall game night first, then start this board match.
          </p>
          {match.gameNightStatus !== "active" && (
            <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
              Game night status is currently {match.gameNightStatus}. Return to Game Nights and press Start Game Night first.
            </p>
          )}
          <button
            type="button"
            disabled={working || match.gameNightStatus !== "active"}
            onClick={() => void mutate({ action: "start", matchId }, "Board match started.")}
            className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            Start Board Match
          </button>
        </section>
      )}

      <section className="mb-5 grid gap-4 sm:grid-cols-2">
        {[match.teamA, match.teamB].map((team) => {
          const isCurrent = match.currentTeamId === team.id;
          const isWinner = match.winnerTeamId === team.id;
          return (
            <div key={team.id} className={`rounded-2xl border p-5 ${isCurrent ? "border-[var(--color-primary)] bg-[var(--color-panel-soft)]" : "border-[var(--color-panel-border)] bg-[var(--color-panel)]"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-[var(--color-text-muted)]">{team === match.teamA ? "Team A" : "Team B"}</div>
                  <h2 className="text-2xl font-bold">{team.name}</h2>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black tabular-nums">{team.score}</div>
                  <div className="text-sm text-[var(--color-text-muted)]">{team.legsWon} legs</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {team.members.map((member) => (
                  <span key={member.id} className={`rounded-full border px-3 py-1 text-sm ${match.currentMemberId === member.id ? "border-[var(--color-primary)] font-bold" : "border-[var(--color-panel-border)] text-[var(--color-text-muted)]"}`}>
                    {member.displayName}{member.isDummy ? " · dummy" : ""}
                  </span>
                ))}
              </div>
              {isWinner && <div className="mt-3 text-sm font-bold text-emerald-300">Winner</div>}
            </div>
          );
        })}
      </section>

      {match.status === "active" && currentTeam && currentMember && (
        <section className="mb-5 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm uppercase tracking-wide text-[var(--color-text-muted)]">Leg {match.currentLegNumber} · Current thrower</div>
              <h2 className="text-2xl font-bold">{currentMember.displayName} <span className="text-base font-normal text-[var(--color-text-muted)]">({currentTeam.name})</span></h2>
            </div>
            <div className="text-3xl font-black tabular-nums">{currentTeam.score}</div>
          </div>

          {currentMember.isDummy ? (
            <div className="mt-5">
              <p className="text-sm text-[var(--color-text-muted)]">This slot is a dummy player. The configured dummy turn is {match.dummyScore}.</p>
              <button type="button" disabled={working} onClick={() => void sendScore(match.dummyScore, 3)} className="mt-3 rounded-xl bg-[var(--color-primary)] px-5 py-3 font-bold text-white disabled:opacity-50">
                Apply Dummy Score ({match.dummyScore})
              </button>
            </div>
          ) : (
            <form onSubmit={submitScore} className="mt-5">
              <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={scoreInput}
                  onChange={(event) => setScoreInput(event.target.value)}
                  placeholder="Turn score"
                  className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-4 py-3 text-2xl font-bold"
                />
                <select value={dartsThrown} onChange={(event) => setDartsThrown(Number(event.target.value) as 1 | 2 | 3)} className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3">
                  <option value={3}>3 darts</option>
                  <option value={2}>2 darts</option>
                  <option value={1}>1 dart</option>
                </select>
                <button disabled={working} className="rounded-xl bg-[var(--color-primary)] px-6 py-3 font-bold text-white disabled:opacity-50">Submit</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {quickScores.map((score) => (
                  <button key={score} type="button" onClick={() => setScoreInput(String(score))} className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 text-sm font-bold">
                    {score}
                  </button>
                ))}
              </div>
            </form>
          )}

          {pendingCheckout && (
            <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
              <div className="font-bold text-amber-100">Double-out confirmation</div>
              <p className="mt-1 text-sm text-amber-100/80">{currentMember.displayName} reached zero. Was the final dart a double?</p>
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={working} onClick={() => void sendScore(pendingCheckout.scoreEntered, pendingCheckout.dartsThrown, true)} className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-50">Yes — Checkout</button>
                <button type="button" disabled={working} onClick={() => void sendScore(pendingCheckout.scoreEntered, pendingCheckout.dartsThrown, false)} className="rounded-lg border border-[var(--color-panel-border)] px-4 py-2 font-bold disabled:opacity-50">No — Bust</button>
                <button type="button" disabled={working} onClick={() => setPendingCheckout(null)} className="rounded-lg px-4 py-2 text-sm font-bold text-[var(--color-text-muted)]">Cancel</button>
              </div>
            </div>
          )}
        </section>
      )}

      {match.status === "completed" && (
        <section className="mb-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
          <h2 className="text-2xl font-bold text-emerald-100">Match complete</h2>
          <p className="mt-1 text-emerald-100/80">
            {winner ? `${winner.name} wins ${winner.legsWon}–${winner.id === match.teamA.id ? match.teamB.legsWon : match.teamA.legsWon}.` : `The match finished tied ${match.teamA.legsWon}–${match.teamB.legsWon}.`}
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Central Turn History</h2>
            <p className="text-sm text-[var(--color-text-muted)]">Turns are stored in the league database with idempotent IDs so a future board client can safely retry submissions.</p>
          </div>
          <button type="button" disabled={working || !match.canUndo || match.status === "scheduled"} onClick={() => void mutate({ action: "undo", matchId }, "Last turn undone. Match state recalculated from central history.")} className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 font-bold disabled:opacity-50">
            Undo Last Turn
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {match.turns.slice(0, 12).map((turn) => (
            <div key={turn.id} className="grid gap-1 rounded-xl border border-[var(--color-panel-border)] p-3 text-sm sm:grid-cols-[90px_1fr_auto] sm:items-center">
              <div className="text-[var(--color-text-muted)]">Leg {turn.legNumber}</div>
              <div><span className="font-bold">{turn.displayName}</span> · {turn.scoreEntered} <span className="text-[var(--color-text-muted)]">({turn.scoreBefore} → {turn.scoreAfter})</span></div>
              <div className="font-semibold">{turn.isCheckout ? "Checkout" : turn.isBust ? "Bust" : `${turn.dartsThrown} darts`}</div>
            </div>
          ))}
          {!match.turns.length && <p className="text-sm text-[var(--color-text-muted)]">No turns have been recorded yet.</p>}
        </div>
      </section>
    </main>
  );
}
