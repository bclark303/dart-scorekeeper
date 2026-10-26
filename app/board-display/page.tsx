"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { authClient } from "@/lib/auth/client";
import type { GameNightSummary } from "@/lib/league/gameNightContracts";
import type { LeagueMatchResponse, LeagueMatchSummary } from "@/lib/league/matchContracts";
import type { LeagueListResponse } from "@/lib/league/contracts";

const ACTIVE_LEAGUE_KEY = "dart-scorekeeper:active-league-id";
const REFRESH_MS = 3000;

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Display data unavailable.");
  return body;
}

function statusText(status: string) {
  return status === "active" ? "LIVE MATCH" : status === "completed" ? "MATCH COMPLETE" : "UP NEXT";
}

function BoardDisplayContent() {
  const params = useSearchParams();
  const requestedBoard = Number(params.get("board") ?? "1");
  const boardNumber = Number.isInteger(requestedBoard) && requestedBoard > 0 ? requestedBoard : 1;
  const { data: session, isPending } = authClient.useSession();
  const [match, setMatch] = useState<LeagueMatchSummary | null>(null);
  const [nightName, setNightName] = useState("");
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!session?.user) return;
    try {
      const leagues = await readJson<LeagueListResponse>("/api/leagues");
      const remembered = window.localStorage.getItem(ACTIVE_LEAGUE_KEY);
      const league = leagues.leagues.find((item) => item.id === remembered) ?? leagues.leagues[0];
      if (!league) {
        setMatch(null);
        setNightName("");
        setConnected(true);
        setError("");
        return;
      }
      const data = await readJson<{ gameNights: GameNightSummary[] }>(
        `/api/leagues/game-nights?leagueId=${encodeURIComponent(league.id)}`,
      );
      const night = data.gameNights.find((item) => item.status === "active") ??
        data.gameNights.find((item) => ["ready", "checkin"].includes(item.status)) ??
        null;
      if (!night) {
        setMatch(null);
        setNightName("");
        setRoundNumber(null);
        setConnected(true);
        setError("");
        return;
      }
      setNightName(night.name);
      const currentRound = night.activeRoundNumber ?? night.currentRoundNumber ?? 1;
      setRoundNumber(currentRound);
      const pairing = night.pairings.find(
        (item) => item.boardNumber === boardNumber && item.roundNumber === currentRound,
      );
      if (pairing?.matchSessionId) {
        const result = await readJson<LeagueMatchResponse>(
          `/api/league-matches?matchId=${encodeURIComponent(pairing.matchSessionId)}`,
        );
        if (!result.match) throw new Error("The assigned match is unavailable.");
        setMatch(result.match);
      } else {
        setMatch(null);
      }
      setLastUpdated(Date.now());
      setConnected(true);
      setError("");
    } catch (cause) {
      setConnected(false);
      setError(cause instanceof Error ? cause.message : "Display connection lost.");
      // Keep last confirmed match visible, but make its stale state unambiguous.
    }
  }, [boardNumber, session?.user]);

  useEffect(() => {
    if (!session?.user) return;
    const timer = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [refresh, session?.user]);

  if (isPending) return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-2xl text-white">Loading board display…</main>;
  if (!session?.user) return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-center text-white">
      <div><h1 className="text-4xl font-black">Board {boardNumber}</h1>
      <p className="mt-4 text-xl text-slate-300">Sign in to the league account before opening this monitor.</p>
      <a className="mt-5 inline-block rounded-lg bg-emerald-600 px-6 py-3 font-bold" href="/">Open scorekeeper</a></div>
    </main>
  );

  const lastTurn = match?.turns[0];
  const winner = match?.winnerTeamId === match?.teamA.id ? match.teamA :
    match?.winnerTeamId === match?.teamB.id ? match.teamB : null;
  const sides = match ? [match.teamA, match.teamB] : [];

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 p-5 text-white sm:p-7">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-4">
        <div><div className="text-sm font-bold uppercase tracking-widest text-emerald-300">League Board Monitor</div>
        <h1 className="text-5xl font-black sm:text-6xl">BOARD {boardNumber}</h1></div>
        <div className="text-right"><div className="text-xl font-bold">{nightName || "Waiting for league night"}</div>
        <div className="text-base text-slate-300">{roundNumber ? `Round ${roundNumber}` : "No current round"} · {match ? statusText(match.status) : "WAITING"}</div></div>
      </header>
      {!connected && (
        <div role="alert" className="mt-4 rounded-lg border border-amber-400 bg-amber-900 p-3 text-center text-lg font-bold text-amber-100">
          CONNECTION LOST · Display may be out of date{error ? ` · ${error}` : ""}
        </div>
      )}
      {match ? (
        <>
          <div className="mt-4 flex justify-between text-base font-bold uppercase tracking-wide text-slate-300">
            <span>{match.startingScore} · {match.finishRule === "double" ? "Double out" : "Straight out"}</span>
            <span>Leg {match.currentLegNumber} · Best of {match.legsPerMatch}</span>
          </div>
          <div className="mt-5 grid flex-1 grid-cols-2 gap-4">
            {sides.map((team) => {
              const current = match.status === "active" && match.currentTeamId === team.id;
              return (
                <section key={team.id} className={`flex flex-col rounded-2xl border-4 p-4 sm:p-6 ${current ? "border-emerald-400 bg-emerald-950" : "border-slate-700 bg-slate-900"}`}>
                  <div className="text-xl font-black leading-tight sm:text-3xl">{team.name}</div>
                  <div className="mt-3 space-y-1 text-base text-slate-200 sm:text-xl">
                    {team.members.map((member) => <div key={member.id} className={member.id === match.currentMemberId ? "font-black text-emerald-300" : ""}>{member.displayName}</div>)}
                  </div>
                  <div className="my-auto py-6 text-center text-7xl font-black tabular-nums sm:text-8xl">{team.score}</div>
                  <div className="text-center text-lg font-bold text-slate-300">
                    {winner?.id === team.id ? "WINNER" : current ? "● THROWING" : `Legs won: ${team.legsWon}`}
                  </div>
                </section>
              );
            })}
          </div>
          <footer className="mt-4 rounded-xl bg-slate-800 p-4 text-center">
            <div className="text-2xl font-black sm:text-3xl">{match.status === "completed" ?
              (winner ? `${winner.name} wins!` : "Match complete") :
              match.status === "active" ? `NOW THROWING: ${match.currentMemberName ?? "Current player"}` : "Match is ready"}</div>
            <div className="mt-2 text-base text-slate-300">
              {lastTurn ? `Last turn: ${lastTurn.displayName} · ${lastTurn.scoreEntered} points${lastTurn.isBust ? " (bust)" : ""}` : "No turns scored yet"}
            </div>
          </footer>
        </>
      ) : (
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <h2 className="text-4xl font-black sm:text-5xl">Waiting for board assignment</h2>
          <p className="mt-4 text-xl text-slate-300">This screen automatically follows Board {boardNumber}.</p>
        </section>
      )}
      <div className="mt-3 text-right text-xs text-slate-400">
        {connected ? "LIVE DATA" : "STALE DATA"}{lastUpdated ? ` · Last update ${new Date(lastUpdated).toLocaleTimeString()}` : ""}
      </div>
    </main>
  );
}

export default function BoardDisplayPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-950 p-8 text-white">Opening monitor…</main>}><BoardDisplayContent /></Suspense>;
}
