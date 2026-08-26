"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  GameNightReadinessCheck,
  GameNightReadinessResponse,
} from "@/lib/league/gameNightReadiness";
import type { GameNightSummary } from "@/lib/league/gameNightContracts";

function statusStyles(status: GameNightReadinessCheck["status"]) {
  if (status === "pass") {
    return {
      card: "border-emerald-500/35 bg-emerald-500/8",
      icon: "bg-emerald-500/15 text-emerald-200",
      symbol: "✓",
      label: "Ready",
    };
  }
  if (status === "warn") {
    return {
      card: "border-amber-500/40 bg-amber-500/10",
      icon: "bg-amber-500/15 text-amber-100",
      symbol: "!",
      label: "Review",
    };
  }
  return {
    card: "border-red-500/40 bg-red-500/10",
    icon: "bg-red-500/15 text-red-100",
    symbol: "×",
    label: "Fix",
  };
}

type Props = {
  night: GameNightSummary;
  working: boolean;
  onStart: () => void;
};

export function GameNightReadinessPanel({ night, working, onStart }: Props) {
  const [readiness, setReadiness] = useState<GameNightReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadReadiness = useCallback(async () => {
    try {
      const params = new URLSearchParams({ gameNightId: night.id });
      const response = await fetch(`/api/leagues/game-nights/readiness?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as GameNightReadinessResponse;
      if (!response.ok || !result.checks) {
        throw new Error(result.error ?? "Could not check Game Night readiness.");
      }
      setReadiness(result);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not check Game Night readiness.",
      );
    } finally {
      setLoading(false);
    }
  }, [night.id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadReadiness(), 0);
    const interval = window.setInterval(() => void loadReadiness(), 5000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [loadReadiness]);

  const requiredPassed = readiness?.requiredPassed ?? 0;
  const requiredTotal = readiness?.requiredTotal ?? 7;
  const progress = requiredTotal ? Math.round((requiredPassed / requiredTotal) * 100) : 0;
  const blockers = useMemo(
    () => readiness?.checks?.filter((check) => check.blocksStart && check.status === "block") ?? [],
    [readiness],
  );
  const warnings = useMemo(
    () => readiness?.checks?.filter((check) => check.status === "warn") ?? [],
    [readiness],
  );
  const nextBlocker = blockers[0] ?? null;
  const ready = Boolean(readiness?.ready);

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--color-panel-border)] bg-[var(--color-panel)]">
      <div className={`p-5 sm:p-6 ${ready ? "bg-emerald-500/8" : "bg-[var(--color-panel)]"}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-primary)]">
              Game Night Readiness
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-black sm:text-4xl">
                {loading && !readiness
                  ? "Checking tonight…"
                  : ready
                    ? "Ready to play"
                    : `${blockers.length} ${blockers.length === 1 ? "item" : "items"} to fix`}
              </h2>
              {!loading && readiness && (
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${
                    ready
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-100"
                  }`}
                >
                  {requiredPassed}/{requiredTotal} required checks
                </span>
              )}
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)] sm:text-base">
              {ready
                ? warnings.length
                  ? `Everything required for play is ready. ${warnings.length} non-blocking ${warnings.length === 1 ? "item still needs" : "items still need"} review.`
                  : "Venue, players, teams, boards, scorers, and Round 1 are ready. Starting releases the round to the assigned scoring devices."
                : "Work from the top down. Each item takes you directly to the screen that fixes it; return here and the preflight updates automatically."}
            </p>
          </div>

          <div className="min-w-52 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4">
            <div className="flex items-center justify-between gap-3 text-sm font-black">
              <span>Preflight</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/20">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => void loadReadiness()}
              disabled={loading}
              className="mt-3 text-xs font-black text-[var(--color-primary)] disabled:opacity-50"
            >
              {loading ? "Checking…" : "Check again"}
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mx-5 mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100 sm:mx-6">
          <strong>Readiness could not be refreshed.</strong> {errorMessage}
        </div>
      )}

      {nextBlocker && (
        <div className="mx-5 mb-5 rounded-2xl border border-red-500/40 bg-red-500/10 p-5 sm:mx-6">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-red-200">
            Do this next
          </div>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-black">{nextBlocker.title}: {nextBlocker.summary}</h3>
              {nextBlocker.detail && (
                <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">
                  {nextBlocker.detail}
                </p>
              )}
            </div>
            <Link
              href={nextBlocker.href}
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 py-3 font-black text-white"
            >
              {nextBlocker.action} →
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 sm:px-6 sm:pb-6 xl:grid-cols-4">
        {(readiness?.checks ?? []).map((check) => {
          const style = statusStyles(check.status);
          return (
            <Link
              key={check.id}
              href={check.href}
              className={`group rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] ${style.card}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                    {check.title}
                  </div>
                  <div className="mt-2 font-black">{check.summary}</div>
                </div>
                <div className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-black ${style.icon}`}>
                  {style.symbol}
                </div>
              </div>
              {check.detail && (
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--color-text-muted)]">
                  {check.detail}
                </p>
              )}
              <div className="mt-3 text-xs font-black text-[var(--color-primary)]">
                {check.status === "pass" ? "Open" : check.action} <span className="transition group-hover:translate-x-0.5">→</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="border-t border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-black">
              {ready ? "Everything required is green." : "Start stays locked until the blocking checks are green."}
            </div>
            <div className="mt-1 text-sm text-[var(--color-text-muted)]">
              {warnings.length
                ? `${warnings.length} warning${warnings.length === 1 ? " does" : "s do"} not block play.`
                : "Non-blocking administrative items will appear as warnings."}
            </div>
          </div>
          <button
            type="button"
            disabled={!ready || working || loading}
            onClick={onStart}
            className={`min-h-14 rounded-2xl px-7 py-4 text-lg font-black text-white ${
              ready ? "bg-emerald-600" : "cursor-not-allowed bg-slate-600/60"
            } disabled:opacity-70`}
          >
            {working ? "Starting…" : ready ? "Start Game Night →" : "Game Night Not Ready"}
          </button>
        </div>
      </div>
    </section>
  );
}
