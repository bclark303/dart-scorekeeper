"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GameNightWorkspacePicker } from "@/components/GameNightWorkspacePicker";
import { authClient } from "@/lib/auth/client";
import type {
  BoardDeviceSummary,
  PhysicalBoardSummary,
  VenueHardwareResponse,
  VenueSummary,
} from "@/lib/league/boardDeviceContracts";
import type { GameNightSummary } from "@/lib/league/gameNightContracts";
import { useGameNightWorkspace } from "@/lib/league/useGameNightWorkspace";

function lastSeenLabel(value: number | null) {
  if (!value) return "Never connected";
  return `Last seen ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))}`;
}

export default function GameNightBoardsPage() {
  const { data: session, isPending } = authClient.useSession();
  const workspace = useGameNightWorkspace(Boolean(session?.user));
  const [venues, setVenues] = useState<VenueSummary[]>([]);
  const [physicalBoards, setPhysicalBoards] = useState<PhysicalBoardSummary[]>([]);
  const [devices, setDevices] = useState<BoardDeviceSummary[]>([]);
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([]);
  const [savingStructure, setSavingStructure] = useState(false);
  const [savingDeviceIds, setSavingDeviceIds] = useState<Set<string>>(() => new Set());
  const [hardwareError, setHardwareError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const night = workspace.night;
  const structuralLocked = Boolean(night && ["active", "completed", "cancelled"].includes(night.status));
  const requiredBoardCount = night?.settings.boardCount ?? 0;

  const deviceByBoard = useMemo(
    () => new Map(devices.filter((device) => device.physicalBoardId).map((device) => [device.physicalBoardId!, device])),
    [devices],
  );

  const loadHardware = useCallback(async (leagueId: string, venueId?: string | null) => {
    if (!leagueId) {
      setVenues([]);
      setPhysicalBoards([]);
      setDevices([]);
      return;
    }
    const params = new URLSearchParams({ leagueId });
    if (venueId) params.set("venueId", venueId);
    const response = await fetch(`/api/leagues/board-devices?${params.toString()}`, { cache: "no-store" });
    const result = (await response.json()) as VenueHardwareResponse;
    if (!response.ok || !result.venue || !result.boards || !result.devices) {
      throw new Error(result.error ?? "Could not load venue hardware.");
    }
    setVenues((result.venues ?? []).filter((venue) => venue.status === "active"));
    setPhysicalBoards(result.boards);
    setDevices(result.devices);
    setHardwareError("");
  }, []);

  useEffect(() => {
    if (!workspace.leagueId || !night) return;
    const timer = window.setTimeout(() => {
      setSelectedBoardIds(
        night.boards
          .map((board) => board.physicalBoardId)
          .filter((id): id is string => Boolean(id)),
      );
      void loadHardware(workspace.leagueId, night.venueId).catch((error) =>
        setHardwareError(error instanceof Error ? error.message : "Could not load venue hardware."),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadHardware, night, workspace.leagueId]);

  function markDeviceSaving(deviceId: string, saving: boolean) {
    setSavingDeviceIds((current) => {
      const next = new Set(current);
      if (saving) next.add(deviceId);
      else next.delete(deviceId);
      return next;
    });
  }

  async function patchNight(body: object) {
    const response = await fetch("/api/leagues/game-nights", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { gameNight?: GameNightSummary; error?: string };
    if (!response.ok || !result.gameNight) throw new Error(result.error ?? "Game Night update failed.");
    workspace.applyNight(result.gameNight);
    return result.gameNight;
  }

  async function chooseVenue(venueId: string) {
    if (!night || structuralLocked) return;
    setSavingStructure(true);
    setStatusMessage("");
    workspace.setErrorMessage("");
    try {
      const updated = await patchNight({ action: "venue", gameNightId: night.id, venueId });
      setSelectedBoardIds(updated.boards.map((board) => board.physicalBoardId).filter((id): id is string => Boolean(id)));
      await loadHardware(workspace.leagueId, venueId);
      setStatusMessage(`Venue changed to ${updated.venueName ?? "the selected venue"}.`);
    } catch (error) {
      workspace.setErrorMessage(error instanceof Error ? error.message : "Could not change the venue.");
    } finally {
      setSavingStructure(false);
    }
  }

  function toggleBoard(boardId: string) {
    setSelectedBoardIds((current) => {
      if (current.includes(boardId)) return current.filter((id) => id !== boardId);
      if (current.length >= requiredBoardCount) return current;
      return [...current, boardId];
    });
    setStatusMessage("");
  }

  async function saveBoardSelection() {
    if (!night || structuralLocked) return;
    if (selectedBoardIds.length !== requiredBoardCount) {
      workspace.setErrorMessage(`Select exactly ${requiredBoardCount} physical ${requiredBoardCount === 1 ? "board" : "boards"}.`);
      return;
    }
    setSavingStructure(true);
    workspace.setErrorMessage("");
    setStatusMessage("");
    try {
      const updated = await patchNight({ action: "assignPhysicalBoards", gameNightId: night.id, physicalBoardIds: selectedBoardIds });
      setSelectedBoardIds(updated.boards.map((board) => board.physicalBoardId).filter((id): id is string => Boolean(id)));
      setStatusMessage("Physical boards assigned for this Game Night.");
    } catch (error) {
      workspace.setErrorMessage(error instanceof Error ? error.message : "Could not assign physical boards.");
    } finally {
      setSavingStructure(false);
    }
  }

  async function assignDevice(device: BoardDeviceSummary, board: PhysicalBoardSummary | null) {
    const snapshot = devices;
    markDeviceSaving(device.id, true);
    setHardwareError("");
    setStatusMessage("");
    setDevices((current) => current.map((item) => {
      if (board && item.id !== device.id && item.physicalBoardId === board.id) {
        return { ...item, physicalBoardId: null, boardNumber: null, boardName: null };
      }
      if (item.id !== device.id) return item;
      return { ...item, physicalBoardId: board?.id ?? null, boardNumber: board?.boardNumber ?? null, boardName: board?.name ?? null };
    }));
    try {
      const response = await fetch("/api/leagues/board-devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", deviceId: device.id, physicalBoardId: board?.id ?? null }),
      });
      const result = (await response.json()) as VenueHardwareResponse;
      if (!response.ok || !result.device) throw new Error(result.error ?? "Scorer reassignment failed.");
      await loadHardware(workspace.leagueId, night?.venueId);
      setStatusMessage(`${device.name} ${board ? `is now serving ${board.name}` : "is now a spare"}. The match assignment did not change.`);
    } catch (error) {
      setDevices(snapshot);
      setHardwareError(error instanceof Error ? error.message : "Scorer reassignment failed.");
    } finally {
      markDeviceSaving(device.id, false);
    }
  }

  async function setBoardDevice(board: PhysicalBoardSummary, deviceId: string) {
    const current = deviceByBoard.get(board.id) ?? null;
    if (!deviceId) {
      if (current) await assignDevice(current, null);
      return;
    }
    const next = devices.find((device) => device.id === deviceId);
    if (next) await assignDevice(next, board);
  }

  if (isPending) return <main className="mx-auto max-w-6xl p-6 text-[var(--color-text-muted)]">Loading account…</main>;
  if (!session?.user) return <main className="mx-auto max-w-3xl p-6"><h1 className="text-3xl font-black">Boards</h1><p className="mt-2 text-[var(--color-text-muted)]">Sign in before preparing league boards.</p></main>;

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div><Link href="/game-nights" className="text-sm font-bold text-[var(--color-primary)]">← Game Night Hub</Link><h1 className="mt-2 text-3xl font-black">Boards</h1><p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">Choose the real boards this Game Night will use. Scoring devices are attached to those boards independently and can be swapped at any time without moving the match.</p></div>
        <Link href="/league-devices" className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold">Venue Hardware</Link>
      </header>

      <GameNightWorkspacePicker leagues={workspace.leagues} leagueId={workspace.leagueId} nights={workspace.nights} nightId={workspace.nightId} onLeagueChange={workspace.selectLeague} onNightChange={workspace.selectNight}/>

      {(workspace.errorMessage || hardwareError) && <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">{workspace.errorMessage || hardwareError}</div>}
      {statusMessage && <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">{statusMessage}</div>}

      {night && (
        <div className="mt-6 space-y-6">
          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black">Venue & board allocation</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">{structuralLocked ? "The physical board allocation is locked because this Game Night has started or closed." : `Select ${requiredBoardCount} physical ${requiredBoardCount === 1 ? "board" : "boards"} before play.`}</p></div><span className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1 text-xs font-bold">{selectedBoardIds.length}/{requiredBoardCount} selected</span></div>

            <label className="mt-4 block"><span className="mb-1 block text-sm font-bold">Venue</span><select value={night.venueId ?? ""} disabled={structuralLocked || savingStructure || venues.length < 2} onChange={(event) => void chooseVenue(event.target.value)} className="w-full max-w-lg rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3 disabled:opacity-60">{venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {physicalBoards.map((board) => {
                const selected = selectedBoardIds.includes(board.id);
                const scorer = deviceByBoard.get(board.id) ?? null;
                const cannotSelect = !selected && selectedBoardIds.length >= requiredBoardCount;
                return <label key={board.id} className={`rounded-xl border p-4 ${selected ? "border-emerald-500/50 bg-emerald-500/10" : "border-[var(--color-panel-border)] bg-[var(--color-panel-soft)]"} ${board.status !== "active" ? "opacity-55" : ""}`}><div className="flex items-start gap-3"><input type="checkbox" checked={selected} disabled={structuralLocked || savingStructure || board.status !== "active" || cannotSelect} onChange={() => toggleBoard(board.id)} className="mt-1 h-5 w-5"/><div><div className="font-black">{board.name}</div><div className="text-xs text-[var(--color-text-muted)]">Board {board.boardNumber} · {board.status === "active" ? "Available" : "Out of service"}</div><div className="mt-2 text-xs">{scorer ? `${scorer.name} · ${scorer.status}` : "No scorer assigned"}</div></div></div></label>;
              })}
            </div>
            {!structuralLocked && <button type="button" disabled={savingStructure || selectedBoardIds.length !== requiredBoardCount} onClick={() => void saveBoardSelection()} className="mt-4 rounded-xl bg-[var(--color-primary)] px-5 py-3 font-black text-white disabled:opacity-50">{savingStructure ? "Saving…" : "Save Physical Boards"}</button>}
          </section>

          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
            <div><h2 className="text-xl font-black">Scorers serving tonight&apos;s boards</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">This remains editable during live play. Replacing a dead tablet changes only the hardware serving the board; the fixture and match stay on the same physical board.</p></div>
            <div className="mt-4 space-y-3">{night.boards.map((nightBoard) => {
              const physical = physicalBoards.find((board) => board.id === nightBoard.physicalBoardId) ?? null;
              if (!physical) return <div key={nightBoard.id} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><div className="font-black">{nightBoard.name}</div><div className="text-sm">Physical board mapping needs attention.</div></div>;
              const scorer = deviceByBoard.get(physical.id) ?? null;
              const saving = Boolean(scorer && savingDeviceIds.has(scorer.id));
              return <article key={nightBoard.id} className="rounded-xl border border-[var(--color-panel-border)] p-4"><div className="grid gap-3 md:grid-cols-[1fr_280px]"><div><div className="font-black">{physical.name}</div><div className="mt-1 text-sm text-[var(--color-text-muted)]">{scorer ? `${scorer.name} · ${scorer.status === "active" ? "enabled" : "disabled"} · ${lastSeenLabel(scorer.lastSeenAt)}` : "No scoring device assigned"}{saving ? " · Saving…" : ""}</div></div><label><span className="mb-1 block text-xs font-bold">Scoring device</span><select value={scorer?.id ?? ""} disabled={saving} onChange={(event) => void setBoardDevice(physical, event.target.value)} className="w-full rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2"><option value="">No scorer assigned</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}{device.physicalBoardId && device.physicalBoardId !== physical.id ? ` — move from ${device.boardName}` : device.status === "disabled" ? " — disabled" : ""}</option>)}</select></label></div></article>;
            })}</div>
          </section>

          <section className="flex flex-wrap justify-end gap-2"><Link href="/game-nights/teams" className="rounded-xl border border-[var(--color-panel-border)] px-4 py-3 font-bold">← Teams</Link><Link href="/game-nights/fixtures" className="rounded-xl bg-[var(--color-primary)] px-5 py-3 font-black text-white">Open Fixtures & Rounds →</Link></section>
        </div>
      )}
    </main>
  );
}
