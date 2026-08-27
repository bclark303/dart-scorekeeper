"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { LeagueListResponse, LeagueSummary } from "@/lib/league/contracts";
import type {
  SeasonAnalyticsHeadToHead,
  SeasonAnalyticsPartnership,
  SeasonAnalyticsPlayer,
  SeasonAnalyticsSummary,
} from "@/lib/league/seasonAnalytics";
import { ACTIVE_LEAGUE_KEY } from "@/lib/league/useGameNightWorkspace";

type Tab = "overview" | "players" | "attendance" | "partnerships" | "head-to-head" | "segments";
type PlayerSort = "standings" | "average" | "recent" | "attendance" | "100plus";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "players", label: "Players" },
  { id: "attendance", label: "Attendance" },
  { id: "partnerships", label: "Partnerships" },
  { id: "head-to-head", label: "Head-to-Head" },
  { id: "segments", label: "Segments" },
];

function fmt(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.0";
}

function pct(value: number) {
  return `${fmt(value)}%`;
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-4">
      <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
      {hint ? <div className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</div> : null}
    </div>
  );
}

function Leaderboard({
  title,
  players,
  value,
}: {
  title: string;
  players: SeasonAnalyticsPlayer[];
  value: (player: SeasonAnalyticsPlayer) => string;
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-4">
      <h3 className="font-black">{title}</h3>
      <div className="mt-3 space-y-2">
        {players.slice(0, 5).map((player, index) => (
          <div key={player.leaguePlayerId} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0 truncate"><span className="mr-2 text-[var(--color-text-muted)]">{index + 1}.</span><span className="font-bold">{player.displayName}</span></div>
            <div className="shrink-0 font-black">{value(player)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PairTable({ rows }: { rows: SeasonAnalyticsPartnership[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]"><tr><th className="pb-2">Players</th><th className="pb-2">Nights together</th><th className="pb-2">Legs</th><th className="pb-2">W-L</th><th className="pb-2">Leg %</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={`${row.playerAId}-${row.playerBId}`} className="border-t border-[var(--color-panel-border)]"><td className="py-3 font-bold">{row.playerAName} + {row.playerBName}</td><td className="py-3">{row.nightsTogether}</td><td className="py-3">{row.legsTogether}</td><td className="py-3">{row.legWins}-{row.legLosses}</td><td className="py-3 font-black">{pct(row.legWinPercentage)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function HeadTable({ rows }: { rows: SeasonAnalyticsHeadToHead[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]"><tr><th className="pb-2">Players</th><th className="pb-2">Nights opposed</th><th className="pb-2">Legs</th><th className="pb-2">Series</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={`${row.playerAId}-${row.playerBId}`} className="border-t border-[var(--color-panel-border)]"><td className="py-3 font-bold">{row.playerAName} vs {row.playerBName}</td><td className="py-3">{row.nightsOpposed}</td><td className="py-3">{row.legs}</td><td className="py-3 font-black">{row.playerAWins}-{row.playerBWins}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function PlayerDetail({ player, analytics }: { player: SeasonAnalyticsPlayer; analytics: SeasonAnalyticsSummary }) {
  const partners = analytics.partnerships.filter((pair) => pair.playerAId === player.leaguePlayerId || pair.playerBId === player.leaguePlayerId).slice(0, 5);
  const opponents = analytics.headToHead.filter((pair) => pair.playerAId === player.leaguePlayerId || pair.playerBId === player.leaguePlayerId).slice(0, 5);
  const maxTrend = Math.max(1, ...player.trend.map((point) => point.threeDartAverage));

  return (
    <section className="rounded-2xl border border-[var(--color-primary)]/40 bg-[var(--color-panel)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--color-primary)]">Player drill-down</div><h2 className="mt-1 text-2xl font-black">{player.displayName}</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">Rank #{player.standingsRank} · {player.legWins}-{player.legLosses} legs · {pct(player.attendanceRate)} attendance</p></div>
        <Link href={`/players/${encodeURIComponent(player.playerId)}`} className="rounded-xl border border-[var(--color-panel-border)] px-3 py-2 text-sm font-black hover:border-[var(--color-primary)]">Career profile →</Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {[["3-dart avg", fmt(player.threeDartAverage)], ["Last 5", fmt(player.recentThreeDartAverage)], ["Leg %", pct(player.legWinPercentage)], ["100+", String(player.count100Plus)], ["140+", String(player.count140Plus)], ["180s", String(player.count180s)], ["High CO", player.highestCheckout ? String(player.highestCheckout) : "—"]].map(([label, value]) => <div key={label} className="rounded-xl bg-[var(--color-panel-soft)] p-3"><div className="text-[10px] font-black uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div><div className="mt-1 text-lg font-black">{value}</div></div>)}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <h3 className="font-black">Night-by-night 3-dart average</h3>
          {player.trend.length ? <div className="mt-3 flex min-h-40 items-end gap-1 overflow-x-auto rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3">{player.trend.map((point) => <div key={point.gameNightId} className="flex min-w-6 flex-1 flex-col items-center justify-end gap-1" title={`${point.gameNightName}: ${fmt(point.threeDartAverage)} 3DA`}><div className="w-full min-w-5 rounded-t bg-[var(--color-primary)]/80" style={{ height: `${Math.max(4, (point.threeDartAverage / maxTrend) * 120)}px` }} /><div className="text-[9px] font-bold text-[var(--color-text-muted)]">{new Date(point.scheduledAt).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}</div></div>)}</div> : <p className="mt-2 text-sm text-[var(--color-text-muted)]">No scoring turns recorded.</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div><h3 className="font-black">Frequent teammates</h3><div className="mt-2 space-y-2 text-sm">{partners.map((pair) => { const name = pair.playerAId === player.leaguePlayerId ? pair.playerBName : pair.playerAName; return <div key={`${pair.playerAId}-${pair.playerBId}`} className="flex justify-between gap-3"><span>{name}</span><span className="font-black">{pair.nightsTogether} nights · {pair.legWins}-{pair.legLosses}</span></div>; })}</div></div>
          <div><h3 className="font-black">Frequent opponents</h3><div className="mt-2 space-y-2 text-sm">{opponents.map((pair) => { const isA = pair.playerAId === player.leaguePlayerId; const name = isA ? pair.playerBName : pair.playerAName; const wins = isA ? pair.playerAWins : pair.playerBWins; const losses = isA ? pair.playerBWins : pair.playerAWins; return <div key={`${pair.playerAId}-${pair.playerBId}`} className="flex justify-between gap-3"><span>{name}</span><span className="font-black">{wins}-{losses} · {pair.nightsOpposed} nights</span></div>; })}</div></div>
        </div>
      </div>
    </section>
  );
}

export function SeasonAnalyticsHub() {
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [leagueId, setLeagueId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [analytics, setAnalytics] = useState<SeasonAnalyticsSummary | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [playerSort, setPlayerSort] = useState<PlayerSort>("standings");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/leagues", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as LeagueListResponse & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not load leagues.");
        return result.leagues;
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        setLeagues(result);
        const remembered = window.localStorage.getItem(ACTIVE_LEAGUE_KEY);
        setLeagueId(result.find((league) => league.id === remembered)?.id ?? result[0]?.id ?? "");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setErrorMessage(error instanceof Error ? error.message : "Could not load leagues.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingLeagues(false);
      });
    return () => controller.abort();
  }, []);

  const league = leagues.find((item) => item.id === leagueId) ?? null;
  const resolvedSeasonId = useMemo(() => {
    if (!league) return "";
    if (league.seasons.some((season) => season.id === seasonId)) return seasonId;
    const preferred = league.seasons.find((season) => season.status === "active") ?? [...league.seasons].sort((a, b) => (b.startsAt ?? b.createdAt) - (a.startsAt ?? a.createdAt))[0];
    return preferred?.id ?? "";
  }, [league, seasonId]);

  useEffect(() => {
    if (!resolvedSeasonId) return;
    const controller = new AbortController();
    fetch(`/api/leagues/season-analytics?seasonId=${encodeURIComponent(resolvedSeasonId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as { analytics?: SeasonAnalyticsSummary; error?: string };
        if (!response.ok || !result.analytics) throw new Error(result.error ?? "Could not load season analytics.");
        return result.analytics;
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        setAnalytics(result);
        setSelectedPlayerId("");
        setErrorMessage("");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setErrorMessage(error instanceof Error ? error.message : "Could not load season analytics.");
      });
    return () => controller.abort();
  }, [resolvedSeasonId]);

  const sortedPlayers = useMemo(() => {
    if (!analytics) return [];
    const rows = [...analytics.players];
    if (playerSort === "average") return rows.sort((a, b) => b.threeDartAverage - a.threeDartAverage);
    if (playerSort === "recent") return rows.sort((a, b) => b.recentThreeDartAverage - a.recentThreeDartAverage);
    if (playerSort === "attendance") return rows.sort((a, b) => b.attendanceRate - a.attendanceRate || b.nightsAttended - a.nightsAttended);
    if (playerSort === "100plus") return rows.sort((a, b) => b.count100Plus - a.count100Plus || b.threeDartAverage - a.threeDartAverage);
    return rows.sort((a, b) => a.standingsRank - b.standingsRank);
  }, [analytics, playerSort]);

  const selectedPlayer = analytics?.players.find((player) => player.leaguePlayerId === selectedPlayerId) ?? null;
  const analyticsLoading = Boolean(resolvedSeasonId && analytics?.seasonId !== resolvedSeasonId);
  const averageAttendance = analytics?.players.length ? analytics.players.reduce((sum, player) => sum + player.attendanceRate, 0) / analytics.players.length : 0;
  const maxBucket = analytics ? Math.max(1, ...analytics.scoreBuckets.map((bucket) => bucket.count)) : 1;

  function changeLeague(nextLeagueId: string) {
    setLeagueId(nextLeagueId);
    setSeasonId("");
    setAnalytics(null);
    setSelectedPlayerId("");
    window.localStorage.setItem(ACTIVE_LEAGUE_KEY, nextLeagueId);
  }

  function changeSeason(nextSeasonId: string) {
    setSeasonId(nextSeasonId);
    setAnalytics(null);
    setSelectedPlayerId("");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-bold">League<select value={leagueId} onChange={(event) => changeLeague(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2">{leagues.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-bold">Season<select value={resolvedSeasonId} onChange={(event) => changeSeason(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2">{league?.seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
        </div>
        <div className="mt-3 text-xs text-[var(--color-text-muted)]">Game type: <strong>X01</strong> · Statistics are scoped to this league and season only.</div>
      </section>

      {errorMessage ? <section className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">{errorMessage}</section> : null}
      {(loadingLeagues || analyticsLoading) ? <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-[var(--color-text-muted)]">Loading league analytics…</section> : null}

      {analytics && analytics.seasonId === resolvedSeasonId ? <>
        <div className="flex gap-2 overflow-x-auto pb-1">{TABS.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-black ${tab === item.id ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-black" : "border-[var(--color-panel-border)] bg-[var(--color-panel)]"}`}>{item.label}</button>)}</div>

        {tab === "overview" ? <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"><Card label="Players" value={String(analytics.totalPlayers)} /><Card label="Game Nights" value={`${analytics.completedNights}/${analytics.totalNights}`} hint="completed / scheduled" /><Card label="Legs" value={analytics.totalLegs.toLocaleString()} /><Card label="League 3DA" value={fmt(analytics.leagueThreeDartAverage)} /><Card label="Avg attendance" value={pct(averageAttendance)} /><Card label="Detailed darts" value={pct(analytics.detailedDartCoverage)} hint={`${analytics.detailedDartsRecorded.toLocaleString()} darts with segment detail`} /></div>
          <div className="grid gap-4 lg:grid-cols-3"><Leaderboard title="Standings" players={[...analytics.players].sort((a, b) => a.standingsRank - b.standingsRank)} value={(player) => `${player.legWins}-${player.legLosses}`} /><Leaderboard title="Scoring average" players={[...analytics.players].sort((a, b) => b.threeDartAverage - a.threeDartAverage)} value={(player) => fmt(player.threeDartAverage)} /><Leaderboard title="Recent form · last 5" players={[...analytics.players].sort((a, b) => b.recentThreeDartAverage - a.recentThreeDartAverage)} value={(player) => fmt(player.recentThreeDartAverage)} /><Leaderboard title="Attendance" players={[...analytics.players].sort((a, b) => b.attendanceRate - a.attendanceRate)} value={(player) => pct(player.attendanceRate)} /><Leaderboard title="100+ turns" players={[...analytics.players].sort((a, b) => b.count100Plus - a.count100Plus)} value={(player) => String(player.count100Plus)} /><Leaderboard title="Highest checkout" players={[...analytics.players].sort((a, b) => b.highestCheckout - a.highestCheckout)} value={(player) => player.highestCheckout ? String(player.highestCheckout) : "—"} /></div>
          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5"><h2 className="text-xl font-black">Turn-score distribution</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">Busts count as zero points, matching scoring-average calculation.</p><div className="mt-4 space-y-2">{analytics.scoreBuckets.map((bucket) => <div key={bucket.label} className="grid grid-cols-[72px_1fr_90px] items-center gap-3 text-sm"><div className="font-bold">{bucket.label}</div><div className="h-5 overflow-hidden rounded-full bg-[var(--color-panel-soft)]"><div className="h-full rounded-full bg-[var(--color-primary)]/80" style={{ width: `${(bucket.count / maxBucket) * 100}%` }} /></div><div className="text-right font-black">{bucket.count.toLocaleString()} · {pct(bucket.percentage)}</div></div>)}</div></section>
        </div> : null}

        {tab === "players" ? <div className="space-y-4"><section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Player rankings</h2><p className="text-sm text-[var(--color-text-muted)]">Click a player to drill into trends, teammates and opponents.</p></div><select value={playerSort} onChange={(event) => setPlayerSort(event.target.value as PlayerSort)} className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 text-sm font-bold"><option value="standings">Sort: Standings</option><option value="average">Sort: 3-dart average</option><option value="recent">Sort: Recent form</option><option value="attendance">Sort: Attendance</option><option value="100plus">Sort: 100+ turns</option></select></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]"><tr><th className="pb-2">Rank</th><th className="pb-2">Player</th><th className="pb-2">Legs</th><th className="pb-2">Leg %</th><th className="pb-2">3DA</th><th className="pb-2">Last 5</th><th className="pb-2">Attendance</th><th className="pb-2">100+</th><th className="pb-2">140+</th><th className="pb-2">180</th><th className="pb-2">High CO</th></tr></thead><tbody>{sortedPlayers.map((player) => <tr key={player.leaguePlayerId} onClick={() => setSelectedPlayerId(player.leaguePlayerId)} className="cursor-pointer border-t border-[var(--color-panel-border)] hover:bg-[var(--color-panel-soft)]"><td className="py-3 font-black">#{player.standingsRank}</td><td className="py-3 font-bold">{player.displayName}</td><td className="py-3">{player.legWins}-{player.legLosses}</td><td className="py-3">{pct(player.legWinPercentage)}</td><td className="py-3 font-black">{fmt(player.threeDartAverage)}</td><td className="py-3">{fmt(player.recentThreeDartAverage)}</td><td className="py-3">{pct(player.attendanceRate)}</td><td className="py-3">{player.count100Plus}</td><td className="py-3">{player.count140Plus}</td><td className="py-3">{player.count180s}</td><td className="py-3">{player.highestCheckout || "—"}</td></tr>)}</tbody></table></div></section>{selectedPlayer ? <PlayerDetail player={selectedPlayer} analytics={analytics} /> : null}</div> : null}

        {tab === "attendance" ? <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5"><h2 className="text-xl font-black">Season attendance</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">Checked-in nights divided by non-cancelled Game Nights in this season.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]"><tr><th className="pb-2">Player</th><th className="pb-2">Attended</th><th className="pb-2">Missed</th><th className="pb-2">Attendance</th><th className="pb-2">Legs played</th></tr></thead><tbody>{[...analytics.players].sort((a, b) => b.attendanceRate - a.attendanceRate || b.nightsAttended - a.nightsAttended).map((player) => <tr key={player.leaguePlayerId} className="border-t border-[var(--color-panel-border)]"><td className="py-3 font-bold">{player.displayName}</td><td className="py-3">{player.nightsAttended}</td><td className="py-3">{Math.max(0, player.totalNights - player.nightsAttended)}</td><td className="py-3 font-black">{pct(player.attendanceRate)}</td><td className="py-3">{player.legWins + player.legLosses}</td></tr>)}</tbody></table></div></section> : null}
        {tab === "partnerships" ? <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5"><h2 className="text-xl font-black">Partnerships</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">How often players shared a nightly team, plus their shared leg results.</p><div className="mt-4"><PairTable rows={analytics.partnerships} /></div></section> : null}
        {tab === "head-to-head" ? <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5"><h2 className="text-xl font-black">Head-to-head</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">Every completed leg where two players appeared on opposing teams.</p><div className="mt-4"><HeadTable rows={analytics.headToHead} /></div></section> : null}
        {tab === "segments" ? <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5"><h2 className="text-xl font-black">Segment hit frequency</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">Only darts entered graphically have trustworthy segment information. Total-score turns are never reverse-engineered.</p>{analytics.detailedDartsRecorded === 0 ? <div className="mt-4 rounded-xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-5 text-sm text-[var(--color-text-muted)]">This season has no dart-by-dart segment records yet. Scoring averages and all other tabs remain complete because they use authoritative turn totals.</div> : <div className="mt-4 space-y-2">{analytics.segments.map((segment) => <div key={`${segment.segment}-${segment.multiplier}`} className="grid grid-cols-[64px_1fr_110px] items-center gap-3 text-sm"><div className="font-black">{segment.label}</div><div className="h-5 overflow-hidden rounded-full bg-[var(--color-panel-soft)]"><div className="h-full rounded-full bg-[var(--color-primary)]/80" style={{ width: `${segment.percentage}%` }} /></div><div className="text-right font-black">{segment.count.toLocaleString()} · {pct(segment.percentage)}</div></div>)}</div>}</section> : null}
      </> : null}
    </div>
  );
}
