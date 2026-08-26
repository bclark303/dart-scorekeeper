"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GameNightTemplateManager } from "@/components/GameNightTemplateManager";
import { authClient } from "@/lib/auth/client";
import type { LeagueListResponse, LeagueSummary } from "@/lib/league/contracts";
import {
  DEFAULT_GAME_NIGHT_SETTINGS,
  type GameNightSettingsSummary,
  type GameNightSummary,
} from "@/lib/league/gameNightContracts";
import type {
  GameNightTemplateListResponse,
  GameNightTemplateSummary,
} from "@/lib/league/gameNightTemplates";

export default function GameNightTemplatesPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [leagueId, setLeagueId] = useState("");
  const [templates, setTemplates] = useState<GameNightTemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [gameNights, setGameNights] = useState<GameNightSummary[]>([]);
  const [sourceNightId, setSourceNightId] = useState("");
  const [draft, setDraft] = useState<GameNightSettingsSummary>(DEFAULT_GAME_NIGHT_SETTINGS);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedLeague = leagues.find((league) => league.id === leagueId) ?? null;
  const canManage = selectedLeague?.membershipRole === "owner" || selectedLeague?.membershipRole === "admin";

  const loadTemplates = useCallback(async (selectedLeagueId: string, preferredId?: string) => {
    const response = await fetch(`/api/leagues/game-night-templates?leagueId=${encodeURIComponent(selectedLeagueId)}`, { cache: "no-store" });
    const result = (await response.json()) as GameNightTemplateListResponse;
    if (!response.ok || !result.templates) throw new Error(result.error ?? "Could not load rules templates.");
    setTemplates(result.templates);
    setSelectedTemplateId((current) => {
      const preferred = preferredId ?? current;
      if (preferred && result.templates?.some((template) => template.id === preferred)) return preferred;
      return result.templates?.find((template) => template.isDefault)?.id ?? "";
    });
  }, []);

  const loadLeagueData = useCallback(async (selectedLeagueId: string) => {
    setErrorMessage("");
    try {
      const nightsResponse = await fetch(`/api/leagues/game-nights?leagueId=${encodeURIComponent(selectedLeagueId)}`, { cache: "no-store" });
      const nightsResult = (await nightsResponse.json()) as { gameNights?: GameNightSummary[]; error?: string };
      if (!nightsResponse.ok || !nightsResult.gameNights) throw new Error(nightsResult.error ?? "Could not load Game Nights.");
      setGameNights(nightsResult.gameNights);
      const first = nightsResult.gameNights[0];
      setSourceNightId(first?.id ?? "");
      setDraft(first?.settings ?? DEFAULT_GAME_NIGHT_SETTINGS);
      await loadTemplates(selectedLeagueId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load template data.");
    }
  }, [loadTemplates]);

  const loadLeagues = useCallback(async () => {
    try {
      const response = await fetch("/api/leagues", { cache: "no-store" });
      const result = (await response.json()) as LeagueListResponse & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not load leagues.");
      setLeagues(result.leagues);
      setLeagueId((current) => current || result.leagues[0]?.id || "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load leagues.");
    }
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    const id = window.setTimeout(() => void loadLeagues(), 0);
    return () => window.clearTimeout(id);
  }, [loadLeagues, session?.user]);

  useEffect(() => {
    if (!leagueId) return;
    const id = window.setTimeout(() => void loadLeagueData(leagueId), 0);
    return () => window.clearTimeout(id);
  }, [leagueId, loadLeagueData]);

  const summary = useMemo(() => ({
    game: draft.startingScore,
    finish: draft.finishRule === "double" ? "Double Out" : "Straight Out",
    legs: draft.legsPerMatch,
    rounds: draft.roundCount ?? 3,
    pairing: (draft.pairingStrategy ?? "random").replaceAll("_", " "),
    teams: `${draft.targetTeamCount} teams · ${draft.minTeamPlayers}-${draft.maxTeamPlayers} players`,
    boards: `${draft.boardCount} board${draft.boardCount === 1 ? "" : "s"} · ${draft.boardRotationType}`,
  }), [draft]);

  function chooseSource(id: string) {
    setSourceNightId(id);
    const night = gameNights.find((item) => item.id === id);
    setDraft(night?.settings ?? DEFAULT_GAME_NIGHT_SETTINGS);
    setStatusMessage(id ? `Using rules from ${night?.name ?? "selected Game Night"}.` : "Using standard app defaults as the source.");
  }

  if (sessionPending) return <main className="mx-auto max-w-5xl p-6 text-[var(--color-text-muted)]">Loading account…</main>;
  if (!session?.user) return <main className="mx-auto max-w-3xl p-6"><Link href="/" className="font-bold text-[var(--color-primary)]">← Back to scorekeeper</Link><section className="mt-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6"><h1 className="text-3xl font-bold">League Rules Templates</h1><p className="mt-2 text-[var(--color-text-muted)]">Sign in through Connected Storage to manage league templates.</p></section></main>;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div><Link href="/game-nights" className="text-sm font-bold text-[var(--color-primary)]">← Game Nights</Link><h1 className="mt-2 text-3xl font-bold">League Rules Templates</h1><p className="mt-1 text-sm text-[var(--color-text-muted)]">Save a known-good Game Night rule set once, make it the league default, and reuse it for future nights.</p></div>
        <Link href="/leagues" className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 text-sm font-bold">League Center</Link>
      </div>

      {errorMessage && <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">{errorMessage}</div>}
      {statusMessage && <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">{statusMessage}</div>}

      <section className="mb-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold">League<select value={leagueId} onChange={(event) => { setLeagueId(event.target.value); setTemplates([]); setSelectedTemplateId(""); }} className="mt-2 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3"><option value="">Select league</option>{leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}</select></label>
          <label className="text-sm font-bold">Rule source<select value={sourceNightId} onChange={(event) => chooseSource(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3"><option value="">Standard app defaults</option>{gameNights.map((night) => <option key={night.id} value={night.id}>{night.name} · {night.seasonName}</option>)}</select></label>
        </div>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">Detailed rule editing still happens on a Game Night. Choose a configured night here to capture its complete rule snapshot as a reusable preset.</p>
      </section>

      {leagueId && <div className="space-y-6">
        <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5"><h2 className="text-xl font-bold">Source Rule Snapshot</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(summary).map(([key, value]) => <div key={key} className="rounded-xl bg-[var(--color-panel-soft)] p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{key}</div><div className="mt-1 font-bold capitalize">{value}</div></div>)}</div></section>
        <GameNightTemplateManager leagueId={leagueId} templates={templates} selectedTemplateId={selectedTemplateId} settings={draft} canManage={Boolean(canManage)} disabled={false} onSelect={setSelectedTemplateId} onApply={setDraft} onReload={(preferredId) => loadTemplates(leagueId, preferredId)} onMessage={(message) => { setErrorMessage(""); setStatusMessage(message); }} onError={(message) => { setStatusMessage(""); setErrorMessage(message); }} />
      </div>}
    </main>
  );
}
