"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { authClient } from "@/lib/auth/client";
import type { LeagueListResponse, LeagueSummary } from "@/lib/league/contracts";
import type {
  BoardDeviceSummary,
  PhysicalBoardSummary,
  VenueHardwareResponse,
  VenueSummary,
} from "@/lib/league/boardDeviceContracts";

type Pairing = {
  deviceId: string;
  deviceName: string;
  code: string;
  expiresAt: number;
  url: string;
};

function seenLabel(value: number | null) {
  if (!value) return "Never connected";
  return `Last seen ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))}`;
}

function replaceDevice(
  devices: BoardDeviceSummary[],
  deviceId: string,
  board: PhysicalBoardSummary | null,
) {
  return devices.map((device) => {
    if (board && device.id !== deviceId && device.physicalBoardId === board.id) {
      return { ...device, physicalBoardId: null, boardNumber: null, boardName: null };
    }
    if (device.id !== deviceId) return device;
    return {
      ...device,
      physicalBoardId: board?.id ?? null,
      boardNumber: board?.boardNumber ?? null,
      boardName: board?.name ?? null,
    };
  });
}

export default function VenueHardwarePage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [leagueId, setLeagueId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [linkedVenues, setLinkedVenues] = useState<VenueSummary[]>([]);
  const [availableVenues, setAvailableVenues] = useState<VenueSummary[]>([]);
  const [boards, setBoards] = useState<PhysicalBoardSummary[]>([]);
  const [devices, setDevices] = useState<BoardDeviceSummary[]>([]);
  const [deviceNames, setDeviceNames] = useState<Record<string, string>>({});
  const [boardNames, setBoardNames] = useState<Record<string, string>>({});
  const [newDeviceName, setNewDeviceName] = useState("Spare Scorer");
  const [newDeviceBoardId, setNewDeviceBoardId] = useState("");
  const [newBoardNumber, setNewBoardNumber] = useState(1);
  const [newBoardName, setNewBoardName] = useState("");
  const [linkVenueId, setLinkVenueId] = useState("");
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [addingBoard, setAddingBoard] = useState(false);
  const [linkingVenue, setLinkingVenue] = useState(false);
  const [savingDeviceIds, setSavingDeviceIds] = useState<Set<string>>(() => new Set());
  const [savingBoardIds, setSavingBoardIds] = useState<Set<string>>(() => new Set());
  const [pairingDeviceId, setPairingDeviceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const pairingExpiryLabel = useMemo(() => {
    if (!pairing) return "";
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(pairing.expiresAt));
  }, [pairing]);

  const selectedVenue = useMemo(
    () => linkedVenues.find((venue) => venue.id === venueId) ?? null,
    [linkedVenues, venueId],
  );

  const deviceByBoard = useMemo(
    () => new Map(devices.filter((device) => device.physicalBoardId).map((device) => [device.physicalBoardId!, device])),
    [devices],
  );

  const loadLeagues = useCallback(async () => {
    const response = await fetch("/api/leagues", { cache: "no-store" });
    const result = (await response.json()) as LeagueListResponse & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Could not load leagues.");
    setLeagues(result.leagues);
    setLeagueId((current) => current || result.leagues[0]?.id || "");
  }, []);

  const loadHardware = useCallback(async (selectedLeagueId: string, requestedVenueId?: string) => {
    if (!selectedLeagueId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ leagueId: selectedLeagueId });
      if (requestedVenueId) params.set("venueId", requestedVenueId);
      const response = await fetch(`/api/leagues/board-devices?${params.toString()}`, { cache: "no-store" });
      const result = (await response.json()) as VenueHardwareResponse;
      if (!response.ok || !result.venue || !result.boards || !result.devices) {
        throw new Error(result.error ?? "Could not load venue hardware.");
      }
      setLinkedVenues(result.venues ?? []);
      setAvailableVenues(result.availableVenues ?? []);
      setVenueId(result.venue.id);
      setBoards(result.boards);
      setDevices(result.devices);
      setDeviceNames(Object.fromEntries(result.devices.map((device) => [device.id, device.name])));
      setBoardNames(Object.fromEntries(result.boards.map((board) => [board.id, board.name])));
      setNewBoardNumber(Math.max(0, ...result.boards.map((board) => board.boardNumber)) + 1);
      setLinkVenueId(result.availableVenues?.[0]?.id ?? "");
      setErrorMessage("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    const timer = window.setTimeout(() => {
      void loadLeagues().catch((error) => setErrorMessage(error instanceof Error ? error.message : "Could not load leagues."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLeagues, session?.user]);

  useEffect(() => {
    if (!leagueId) return;
    const timer = window.setTimeout(() => {
      void loadHardware(leagueId).catch((error) => setErrorMessage(error instanceof Error ? error.message : "Could not load venue hardware."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [leagueId, loadHardware]);

  function markDeviceSaving(deviceId: string, saving: boolean) {
    setSavingDeviceIds((current) => {
      const next = new Set(current);
      if (saving) next.add(deviceId);
      else next.delete(deviceId);
      return next;
    });
  }

  function markBoardSaving(boardId: string, saving: boolean) {
    setSavingBoardIds((current) => {
      const next = new Set(current);
      if (saving) next.add(boardId);
      else next.delete(boardId);
      return next;
    });
  }

  async function requestDeviceUpdate(deviceId: string, body: object) {
    const response = await fetch("/api/leagues/board-devices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", deviceId, ...body }),
    });
    const result = (await response.json()) as VenueHardwareResponse;
    if (!response.ok || !result.device) throw new Error(result.error ?? "Scoring device update failed.");
    return result.device;
  }

  async function assignDevice(device: BoardDeviceSummary, physicalBoardId: string | null) {
    const board = boards.find((item) => item.id === physicalBoardId) ?? null;
    const snapshot = devices;
    markDeviceSaving(device.id, true);
    setErrorMessage("");
    setStatusMessage("");
    setDevices((current) => replaceDevice(current, device.id, board));
    try {
      await requestDeviceUpdate(device.id, { physicalBoardId });
      await loadHardware(leagueId, venueId);
      setStatusMessage(`${device.name} ${board ? `assigned to ${board.name}` : "moved to the spare pool"}.`);
    } catch (error) {
      setDevices(snapshot);
      setErrorMessage(error instanceof Error ? error.message : "Scoring device assignment failed.");
    } finally {
      markDeviceSaving(device.id, false);
    }
  }

  async function setBoardScorer(board: PhysicalBoardSummary, nextDeviceId: string) {
    const current = deviceByBoard.get(board.id) ?? null;
    if (!nextDeviceId) {
      if (current) await assignDevice(current, null);
      return;
    }
    const next = devices.find((device) => device.id === nextDeviceId);
    if (next) await assignDevice(next, board.id);
  }

  async function toggleDevice(device: BoardDeviceSummary) {
    const snapshot = devices;
    const nextStatus = device.status === "active" ? "disabled" : "active";
    markDeviceSaving(device.id, true);
    setDevices((current) => current.map((item) => item.id === device.id ? { ...item, status: nextStatus } : item));
    setErrorMessage("");
    try {
      await requestDeviceUpdate(device.id, { status: nextStatus });
      setStatusMessage(`${device.name} ${nextStatus === "active" ? "enabled" : "disabled"}.`);
    } catch (error) {
      setDevices(snapshot);
      setErrorMessage(error instanceof Error ? error.message : "Scoring device update failed.");
    } finally {
      markDeviceSaving(device.id, false);
    }
  }

  async function saveDeviceName(device: BoardDeviceSummary) {
    markDeviceSaving(device.id, true);
    setErrorMessage("");
    try {
      const updated = await requestDeviceUpdate(device.id, { name: deviceNames[device.id] ?? device.name });
      setDevices((current) => current.map((item) => item.id === updated.id ? updated : item));
      setStatusMessage(`${updated.name} updated.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Scoring device update failed.");
    } finally {
      markDeviceSaving(device.id, false);
    }
  }

  async function saveBoard(board: PhysicalBoardSummary, status = board.status) {
    markBoardSaving(board.id, true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/leagues/board-devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "board", boardId: board.id, name: boardNames[board.id] ?? board.name, status }),
      });
      const result = (await response.json()) as VenueHardwareResponse;
      if (!response.ok || !result.board) throw new Error(result.error ?? "Physical board update failed.");
      setBoards((current) => current.map((item) => item.id === result.board!.id ? result.board! : item));
      setStatusMessage(`${result.board.name} updated.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Physical board update failed.");
    } finally {
      markBoardSaving(board.id, false);
    }
  }

  async function addBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leagueId || !venueId) return;
    setAddingBoard(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/leagues/board-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "board", leagueId, venueId, boardNumber: newBoardNumber, name: newBoardName || undefined }),
      });
      const result = (await response.json()) as VenueHardwareResponse;
      if (!response.ok || !result.board) throw new Error(result.error ?? "Physical board could not be added.");
      await loadHardware(leagueId, venueId);
      setNewBoardName("");
      setStatusMessage(`${result.board.name} added.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Physical board could not be added.");
    } finally {
      setAddingBoard(false);
    }
  }

  async function registerDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leagueId || !venueId) return;
    setRegistering(true);
    setErrorMessage("");
    setPairing(null);
    try {
      const response = await fetch("/api/leagues/board-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "device", leagueId, venueId, name: newDeviceName, physicalBoardId: newDeviceBoardId || null }),
      });
      const result = (await response.json()) as VenueHardwareResponse;
      if (!response.ok || !result.device) throw new Error(result.error ?? "Scoring device could not be registered.");
      await loadHardware(leagueId, venueId);
      setNewDeviceName("Spare Scorer");
      setNewDeviceBoardId("");
      await createPairing(result.device);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Scoring device could not be registered.");
    } finally {
      setRegistering(false);
    }
  }

  async function createPairing(device: BoardDeviceSummary) {
    const response = await fetch("/api/leagues/board-devices/pairing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: device.id }),
    });
    const result = (await response.json()) as { code?: string; expiresAt?: number; error?: string };
    if (!response.ok || !result.code || !result.expiresAt) throw new Error(result.error ?? "Could not create a pairing code.");
    setPairing({ deviceId: device.id, deviceName: device.name, code: result.code, expiresAt: result.expiresAt, url: `${window.location.origin}/board-device#pair=${result.code}` });
    setStatusMessage(`${device.name} is ready to pair.`);
  }

  async function pairExisting(device: BoardDeviceSummary) {
    setPairingDeviceId(device.id);
    setErrorMessage("");
    try {
      await createPairing(device);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not create a pairing code.");
    } finally {
      setPairingDeviceId(null);
    }
  }

  async function linkVenue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leagueId || !linkVenueId) return;
    setLinkingVenue(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/leagues/board-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "linkVenue", leagueId, venueId: linkVenueId }),
      });
      const result = (await response.json()) as VenueHardwareResponse;
      if (!response.ok || !result.venue) throw new Error(result.error ?? "Venue could not be shared with this league.");
      await loadHardware(leagueId, result.venue.id);
      setStatusMessage(`${result.venue.name} is now available to this league.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Venue could not be shared with this league.");
    } finally {
      setLinkingVenue(false);
    }
  }

  if (sessionPending) return <main className="mx-auto max-w-6xl p-6 text-[var(--color-text-muted)]">Loading account…</main>;
  if (!session?.user) return <main className="mx-auto max-w-3xl p-6"><h1 className="text-3xl font-black">Venue Hardware</h1><p className="mt-2 text-[var(--color-text-muted)]">Sign in to manage venue boards and scoring devices.</p></main>;

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/league-play" className="text-sm font-bold text-[var(--color-primary)]">← League Play</Link>
          <h1 className="mt-2 text-3xl font-black">Venue Hardware</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">Physical boards belong to a venue. Scoring devices can move between boards or remain as spares. Leagues only receive permission to use venues; devices never belong to a league.</p>
        </div>
        <Link href="/board-device" className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold">Open Device Client</Link>
      </header>

      {errorMessage && <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">{errorMessage}</div>}
      {statusMessage && <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">{statusMessage}</div>}

      {pairing && (
        <section className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
          <div className="text-sm font-bold uppercase tracking-wide">Pair {pairing.deviceName}</div>
          <div className="mt-2 font-mono text-5xl font-black tracking-[0.25em]">{pairing.code}</div>
          <p className="mt-3 text-sm opacity-80">Enter this code on the scoring device. It expires at {pairingExpiryLabel}.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void navigator.clipboard.writeText(pairing.url)} className="rounded-xl bg-amber-200 px-4 py-2 font-bold text-black">Copy Pairing Link</button>
            <button type="button" onClick={() => setPairing(null)} className="rounded-xl border border-amber-500/40 px-4 py-2 font-bold">Done</button>
          </div>
        </section>
      )}

      <section className="mb-6 grid gap-4 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 md:grid-cols-2">
        <label className="block"><span className="mb-1 block text-sm font-bold">Administration context</span><select value={leagueId} onChange={(event) => { setLeagueId(event.target.value); setVenueId(""); setPairing(null); }} className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3">{leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}</select><span className="mt-1 block text-xs text-[var(--color-text-muted)]">This chooses which league grants you access; it does not assign hardware to that league.</span></label>
        <label className="block"><span className="mb-1 block text-sm font-bold">Venue</span><select value={venueId} disabled={loading || linkedVenues.length === 0} onChange={(event) => { setVenueId(event.target.value); setPairing(null); void loadHardware(leagueId, event.target.value).catch((error) => setErrorMessage(error instanceof Error ? error.message : "Could not load venue.")); }} className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3 disabled:opacity-60">{linkedVenues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label>
      </section>

      {availableVenues.length > 0 && (
        <form onSubmit={linkVenue} className="mb-6 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5">
          <div className="font-black">Use an existing venue</div><p className="mt-1 text-sm opacity-80">Share boards and devices already managed through another league.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row"><select value={linkVenueId} onChange={(event) => setLinkVenueId(event.target.value)} className="flex-1 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3">{availableVenues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select><button disabled={linkingVenue} className="rounded-xl bg-[var(--color-primary)] px-4 py-3 font-black text-white disabled:opacity-60">{linkingVenue ? "Linking…" : "Make Available to League"}</button></div>
        </form>
      )}

      {selectedVenue && (
        <>
          <section className="mb-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black">Physical Boards</h2><p className="text-sm text-[var(--color-text-muted)]">These are permanent venue resources. A scorer can be replaced without moving the match.</p></div><span className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1 text-xs font-bold">{boards.length} configured</span></div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {boards.map((board) => {
                const scorer = deviceByBoard.get(board.id) ?? null;
                const saving = savingBoardIds.has(board.id) || Boolean(scorer && savingDeviceIds.has(scorer.id));
                return <article key={board.id} className="rounded-xl border border-[var(--color-panel-border)] p-4"><div className="flex items-center justify-between gap-3"><div><div className="font-black">Board {board.boardNumber}</div><div className="text-xs text-[var(--color-text-muted)]">{board.status === "active" ? "Available for play" : "Out of service"}</div></div><button type="button" disabled={saving} onClick={() => void saveBoard(board, board.status === "active" ? "out_of_service" : "active")} className="rounded-lg border border-[var(--color-panel-border)] px-3 py-2 text-xs font-bold disabled:opacity-50">{board.status === "active" ? "Mark Out of Service" : "Restore"}</button></div><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><input value={boardNames[board.id] ?? board.name} onChange={(event) => setBoardNames((current) => ({ ...current, [board.id]: event.target.value }))} className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2"/><button type="button" disabled={savingBoardIds.has(board.id)} onClick={() => void saveBoard(board)} className="rounded-lg bg-[var(--color-panel-soft)] px-3 py-2 font-bold disabled:opacity-50">Save Name</button></div><label className="mt-3 block"><span className="mb-1 block text-xs font-bold">Scorer for this board</span><select value={scorer?.id ?? ""} disabled={saving} onChange={(event) => void setBoardScorer(board, event.target.value)} className="w-full rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2"><option value="">No scorer assigned</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}{device.physicalBoardId && device.physicalBoardId !== board.id ? ` — move from ${device.boardName}` : device.status === "disabled" ? " — disabled" : ""}</option>)}</select></label>{scorer && <div className="mt-2 text-xs text-[var(--color-text-muted)]">{scorer.status === "active" ? "Enabled" : "Disabled"} · {seenLabel(scorer.lastSeenAt)}{savingDeviceIds.has(scorer.id) ? " · Saving…" : ""}</div>}</article>;
              })}
            </div>
            <form onSubmit={addBoard} className="mt-4 grid gap-2 rounded-xl border border-dashed border-[var(--color-panel-border)] p-4 sm:grid-cols-[120px_1fr_auto]"><label className="text-xs font-bold">Board number<input type="number" min={1} max={128} value={newBoardNumber} onChange={(event) => setNewBoardNumber(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2"/></label><label className="text-xs font-bold">Name (optional)<input value={newBoardName} onChange={(event) => setNewBoardName(event.target.value)} placeholder={`Board ${newBoardNumber}`} className="mt-1 w-full rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2"/></label><button disabled={addingBoard} className="self-end rounded-lg bg-[var(--color-primary)] px-4 py-2.5 font-black text-white disabled:opacity-60">{addingBoard ? "Adding…" : "Add Board"}</button></form>
          </section>

          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
            <div><h2 className="text-2xl font-black">Scoring Devices</h2><p className="text-sm text-[var(--color-text-muted)]">A device may serve one board at a time or stay unassigned as a ready spare.</p></div>
            <div className="mt-4 space-y-3">{devices.map((device) => { const saving = savingDeviceIds.has(device.id); return <article key={device.id} className="rounded-xl border border-[var(--color-panel-border)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="font-black">{device.name}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${device.status === "active" ? "bg-emerald-500/20" : "bg-red-500/20"}`}>{device.status}</span>{saving && <span className="text-xs text-[var(--color-text-muted)]">Saving…</span>}</div><div className="mt-1 text-xs text-[var(--color-text-muted)]">{device.boardName ?? "Spare / unassigned"} · {seenLabel(device.lastSeenAt)}</div></div><div className="flex gap-2"><button type="button" disabled={saving || device.status !== "active"} onClick={() => void pairExisting(device)} className="rounded-lg border border-[var(--color-panel-border)] px-3 py-2 text-sm font-bold disabled:opacity-50">{pairingDeviceId === device.id ? "Pairing…" : "Pair / Re-pair"}</button><button type="button" disabled={saving} onClick={() => void toggleDevice(device)} className="rounded-lg border border-[var(--color-panel-border)] px-3 py-2 text-sm font-bold disabled:opacity-50">{device.status === "active" ? "Disable" : "Enable"}</button></div></div><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_220px_auto]"><input value={deviceNames[device.id] ?? device.name} onChange={(event) => setDeviceNames((current) => ({ ...current, [device.id]: event.target.value }))} className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2"/><select value={device.physicalBoardId ?? ""} disabled={saving} onChange={(event) => void assignDevice(device, event.target.value || null)} className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2"><option value="">Spare / unassigned</option>{boards.map((board) => <option key={board.id} value={board.id}>{board.name}{deviceByBoard.get(board.id) && deviceByBoard.get(board.id)?.id !== device.id ? ` — replace ${deviceByBoard.get(board.id)?.name}` : ""}</option>)}</select><button type="button" disabled={saving} onClick={() => void saveDeviceName(device)} className="rounded-lg bg-[var(--color-panel-soft)] px-3 py-2 font-bold disabled:opacity-50">Save Name</button></div></article>; })}{devices.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">No scoring devices registered yet.</p>}</div>
            <form onSubmit={registerDevice} className="mt-4 grid gap-2 rounded-xl border border-dashed border-[var(--color-panel-border)] p-4 sm:grid-cols-[1fr_220px_auto]"><input required maxLength={80} value={newDeviceName} onChange={(event) => setNewDeviceName(event.target.value)} placeholder="Spare Scorer" className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"/><select value={newDeviceBoardId} onChange={(event) => setNewDeviceBoardId(event.target.value)} className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"><option value="">Register as spare</option>{boards.map((board) => <option key={board.id} value={board.id}>{board.name}{deviceByBoard.has(board.id) ? ` — replace current scorer` : ""}</option>)}</select><button disabled={registering} className="rounded-lg bg-[var(--color-primary)] px-4 py-3 font-black text-white disabled:opacity-60">{registering ? "Registering…" : "Register & Pair"}</button></form>
          </section>
        </>
      )}
    </main>
  );
}
