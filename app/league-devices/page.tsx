"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const [newVenueName, setNewVenueName] = useState("");
  const [venueNameDraft, setVenueNameDraft] = useState("");
  const [newDeviceName, setNewDeviceName] = useState("Spare Scorer");
  const [newDeviceBoardId, setNewDeviceBoardId] = useState("");
  const [newBoardNumber, setNewBoardNumber] = useState(1);
  const [newBoardName, setNewBoardName] = useState("");
  const [linkVenueId, setLinkVenueId] = useState("");
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingVenue, setCreatingVenue] = useState(false);
  const [savingVenue, setSavingVenue] = useState(false);
  const [removingVenue, setRemovingVenue] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [addingBoard, setAddingBoard] = useState(false);
  const [linkingVenue, setLinkingVenue] = useState(false);
  const [savingDeviceIds, setSavingDeviceIds] = useState<Set<string>>(() => new Set());
  const [savingBoardIds, setSavingBoardIds] = useState<Set<string>>(() => new Set());
  const [pairingDeviceId, setPairingDeviceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [targetBoardId, setTargetBoardId] = useState("");
  const [targetDeviceId, setTargetDeviceId] = useState("");
  const deepLinkAppliedRef = useRef(false);

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
  const venueArchived = selectedVenue?.status === "archived";

  const deviceByBoard = useMemo(
    () => new Map(
      devices
        .filter((device) => device.physicalBoardId)
        .map((device) => [device.physicalBoardId!, device]),
    ),
    [devices],
  );

  const loadLeagues = useCallback(async () => {
    const response = await fetch("/api/leagues", { cache: "no-store" });
    const result = (await response.json()) as LeagueListResponse & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Could not load leagues.");
    setLeagues(result.leagues);
    const requestedLeagueId = new URLSearchParams(window.location.search).get("leagueId");
    setLeagueId((current) =>
      current ||
      (requestedLeagueId && result.leagues.some((league) => league.id === requestedLeagueId)
        ? requestedLeagueId
        : result.leagues[0]?.id || ""),
    );
  }, []);

  const loadHardware = useCallback(async (selectedLeagueId: string, requestedVenueId?: string) => {
    if (!selectedLeagueId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ leagueId: selectedLeagueId });
      if (requestedVenueId) params.set("venueId", requestedVenueId);
      const response = await fetch(`/api/leagues/board-devices?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as VenueHardwareResponse;
      if (!response.ok) throw new Error(result.error ?? "Could not load venue hardware.");

      const nextLinked = result.venues ?? [];
      const nextVenue = result.venue ?? null;
      const nextBoards = result.boards ?? [];
      const nextDevices = result.devices ?? [];
      setLinkedVenues(nextLinked);
      setAvailableVenues(result.availableVenues ?? []);
      setVenueId(nextVenue?.id ?? "");
      setVenueNameDraft(nextVenue?.name ?? "");
      setBoards(nextBoards);
      setDevices(nextDevices);
      setDeviceNames(Object.fromEntries(nextDevices.map((device) => [device.id, device.name])));
      setBoardNames(Object.fromEntries(nextBoards.map((board) => [board.id, board.name])));
      setNewBoardNumber(Math.max(0, ...nextBoards.map((board) => board.boardNumber)) + 1);
      setLinkVenueId(result.availableVenues?.[0]?.id ?? "");
      setErrorMessage("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setTargetBoardId(params.get("boardId") ?? "");
      setTargetDeviceId(params.get("deviceId") ?? "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    const timer = window.setTimeout(() => {
      void loadLeagues().catch((error) =>
        setErrorMessage(error instanceof Error ? error.message : "Could not load leagues."),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLeagues, session?.user]);

  useEffect(() => {
    if (!leagueId) return;
    const requestedVenueId = !deepLinkAppliedRef.current
      ? new URLSearchParams(window.location.search).get("venueId") ?? undefined
      : undefined;
    deepLinkAppliedRef.current = true;
    const timer = window.setTimeout(() => {
      void loadHardware(leagueId, requestedVenueId).catch((error) =>
        setErrorMessage(error instanceof Error ? error.message : "Could not load venue hardware."),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [leagueId, loadHardware]);

  useEffect(() => {
    const targetId = targetDeviceId
      ? `device-${targetDeviceId}`
      : targetBoardId
        ? `board-${targetBoardId}`
        : "";
    if (!targetId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [boards, devices, targetBoardId, targetDeviceId]);

  function clearNotices() {
    setErrorMessage("");
    setStatusMessage("");
  }

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

  async function createVenue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leagueId) return;
    setCreatingVenue(true);
    clearNotices();
    try {
      const response = await fetch("/api/leagues/board-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createVenue", leagueId, name: newVenueName }),
      });
      const result = (await response.json()) as VenueHardwareResponse;
      if (!response.ok || !result.venue) throw new Error(result.error ?? "Venue could not be created.");
      setNewVenueName("");
      await loadHardware(leagueId, result.venue.id);
      setStatusMessage(`${result.venue.name} created and made available to this league.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Venue could not be created.");
    } finally {
      setCreatingVenue(false);
    }
  }

  async function updateVenue(body: { name?: string; status?: "active" | "archived" }) {
    if (!selectedVenue) return;
    setSavingVenue(true);
    clearNotices();
    try {
      const response = await fetch("/api/leagues/board-devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "venue", venueId: selectedVenue.id, ...body }),
      });
      const result = (await response.json()) as VenueHardwareResponse;
      if (!response.ok || !result.venue) throw new Error(result.error ?? "Venue could not be updated.");
      await loadHardware(leagueId, result.venue.id);
      setStatusMessage(`${result.venue.name} updated.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Venue could not be updated.");
    } finally {
      setSavingVenue(false);
    }
  }

  async function toggleVenueArchive() {
    if (!selectedVenue) return;
    const archiving = selectedVenue.status === "active";
    if (archiving && !window.confirm(
      `Archive ${selectedVenue.name}? It will no longer be available for new Game Nights. Historical records and hardware will be preserved.`,
    )) return;
    await updateVenue({ status: archiving ? "archived" : "active" });
  }

  async function removeVenueFromLeague() {
    if (!selectedVenue || !leagueId) return;
    if (!window.confirm(
      `Remove ${selectedVenue.name} from this league? Other leagues using the venue will not be affected.`,
    )) return;
    setRemovingVenue(true);
    clearNotices();
    try {
      const response = await fetch("/api/leagues/board-devices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlinkVenue", leagueId, venueId: selectedVenue.id }),
      });
      const result = (await response.json()) as { removed?: boolean; error?: string };
      if (!response.ok || !result.removed) throw new Error(result.error ?? "Venue could not be removed from this league.");
      await loadHardware(leagueId);
      setStatusMessage(`${selectedVenue.name} removed from this league.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Venue could not be removed from this league.");
    } finally {
      setRemovingVenue(false);
    }
  }

  async function deleteEmptyVenue() {
    if (!selectedVenue) return;
    if (!window.confirm(
      `Permanently delete ${selectedVenue.name}? This only succeeds if the venue has no boards, devices, or Game Night history.`,
    )) return;
    setRemovingVenue(true);
    clearNotices();
    try {
      const response = await fetch("/api/leagues/board-devices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteVenue", venueId: selectedVenue.id }),
      });
      const result = (await response.json()) as { removed?: boolean; error?: string };
      if (!response.ok || !result.removed) throw new Error(result.error ?? "Venue could not be deleted.");
      await loadHardware(leagueId);
      setStatusMessage(`${selectedVenue.name} permanently deleted.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Venue could not be deleted.");
    } finally {
      setRemovingVenue(false);
    }
  }

  async function linkVenue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leagueId || !linkVenueId) return;
    setLinkingVenue(true);
    clearNotices();
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
    if (venueArchived) return;
    const board = boards.find((item) => item.id === physicalBoardId) ?? null;
    const snapshot = devices;
    markDeviceSaving(device.id, true);
    clearNotices();
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
    if (venueArchived) return;
    const snapshot = devices;
    const nextStatus = device.status === "active" ? "disabled" : "active";
    markDeviceSaving(device.id, true);
    setDevices((current) => current.map((item) =>
      item.id === device.id ? { ...item, status: nextStatus } : item,
    ));
    clearNotices();
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
    if (venueArchived) return;
    markDeviceSaving(device.id, true);
    clearNotices();
    try {
      const updated = await requestDeviceUpdate(device.id, {
        name: deviceNames[device.id] ?? device.name,
      });
      setDevices((current) => current.map((item) => item.id === updated.id ? updated : item));
      setStatusMessage(`${updated.name} updated.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Scoring device update failed.");
    } finally {
      markDeviceSaving(device.id, false);
    }
  }

  async function saveBoard(board: PhysicalBoardSummary, status = board.status) {
    if (venueArchived) return;
    markBoardSaving(board.id, true);
    clearNotices();
    try {
      const response = await fetch("/api/leagues/board-devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "board",
          boardId: board.id,
          name: boardNames[board.id] ?? board.name,
          status,
        }),
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
    if (!leagueId || !venueId || venueArchived) return;
    setAddingBoard(true);
    clearNotices();
    try {
      const response = await fetch("/api/leagues/board-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "board",
          leagueId,
          venueId,
          boardNumber: newBoardNumber,
          name: newBoardName || undefined,
        }),
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

  async function createPairing(device: BoardDeviceSummary) {
    const response = await fetch("/api/leagues/board-devices/pairing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: device.id }),
    });
    const result = (await response.json()) as { code?: string; expiresAt?: number; error?: string };
    if (!response.ok || !result.code || !result.expiresAt) throw new Error(result.error ?? "Could not create a pairing code.");
    setPairing({
      deviceId: device.id,
      deviceName: device.name,
      code: result.code,
      expiresAt: result.expiresAt,
      url: `${window.location.origin}/board-device#pair=${result.code}`,
    });
    setStatusMessage(`${device.name} is ready to pair.`);
  }

  async function registerDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leagueId || !venueId || venueArchived) return;
    setRegistering(true);
    clearNotices();
    setPairing(null);
    try {
      const response = await fetch("/api/leagues/board-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "device",
          leagueId,
          venueId,
          name: newDeviceName,
          physicalBoardId: newDeviceBoardId || null,
        }),
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

  async function pairExisting(device: BoardDeviceSummary) {
    if (venueArchived) return;
    setPairingDeviceId(device.id);
    clearNotices();
    try {
      await createPairing(device);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not create a pairing code.");
    } finally {
      setPairingDeviceId(null);
    }
  }

  if (sessionPending) {
    return <main className="mx-auto max-w-6xl p-6 text-[var(--color-text-muted)]">Loading account…</main>;
  }
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-3xl font-black">Venues, Dartboards & Scoring Devices</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">Sign in to manage venues, boards, and scoring devices.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/league-play" className="text-sm font-bold text-[var(--color-primary)]">← League Administration</Link>
          <h1 className="mt-2 text-3xl font-black">Venues, Dartboards & Scoring Devices</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
            Set up the club or hall, its dartboards, and the tablet or computer used to score each board.
            The same venue can be used by more than one league.
          </p>
        </div>
        <Link href="/board-device" className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold">Open a Scoring Screen</Link>
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

      <section className="mb-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">Venues</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Add a club or hall, rename it, or take an old venue out of use.</p>
          </div>
          {selectedVenue && (
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${selectedVenue.status === "active" ? "bg-emerald-500/20" : "bg-amber-500/20"}`}>
              {selectedVenue.status}
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">League</span>
            <select
              value={leagueId}
              onChange={(event) => {
                setLeagueId(event.target.value);
                setVenueId("");
                setPairing(null);
              }}
              className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
            >
              {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
            </select>
            <span className="mt-1 block text-xs text-[var(--color-text-muted)]">Choose the league you are managing. The same venue can be used by more than one league.</span>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-bold">Venue</span>
            <select
              value={venueId}
              disabled={loading || linkedVenues.length === 0}
              onChange={(event) => {
                setVenueId(event.target.value);
                setPairing(null);
                void loadHardware(leagueId, event.target.value).catch((error) =>
                  setErrorMessage(error instanceof Error ? error.message : "Could not load venue."),
                );
              }}
              className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3 disabled:opacity-60"
            >
              {linkedVenues.map((venue) => (
                <option key={venue.id} value={venue.id}>{venue.name}{venue.status === "archived" ? " — archived" : ""}</option>
              ))}
            </select>
            {linkedVenues.length === 0 && <span className="mt-1 block text-xs text-[var(--color-text-muted)]">No venues are linked to this league yet.</span>}
          </label>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <form onSubmit={createVenue} className="rounded-xl border border-dashed border-[var(--color-panel-border)] p-4">
            <div className="font-black">Create a new venue</div>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">The new venue is immediately available to the selected league.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input required maxLength={100} value={newVenueName} onChange={(event) => setNewVenueName(event.target.value)} placeholder="Venue name" className="flex-1 rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3" />
              <button disabled={creatingVenue || !leagueId} className="rounded-lg bg-[var(--color-primary)] px-4 py-3 font-black text-white disabled:opacity-60">{creatingVenue ? "Creating…" : "Create Venue"}</button>
            </div>
          </form>

          <form onSubmit={linkVenue} className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
            <div className="font-black">Use an existing venue</div>
            <p className="mt-1 text-xs opacity-80">Already set up for another league? Make this venue available here too.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select value={linkVenueId} disabled={availableVenues.length === 0} onChange={(event) => setLinkVenueId(event.target.value)} className="flex-1 rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3 disabled:opacity-60">
                {availableVenues.length === 0 && <option value="">No other venues available</option>}
                {availableVenues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}{venue.status === "archived" ? " — archived" : ""}</option>)}
              </select>
              <button disabled={linkingVenue || !linkVenueId} className="rounded-lg bg-[var(--color-primary)] px-4 py-3 font-black text-white disabled:opacity-60">{linkingVenue ? "Linking…" : "Make Available"}</button>
            </div>
          </form>
        </div>

        {selectedVenue && (
          <div className="mt-5 rounded-xl border border-[var(--color-panel-border)] p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Venue name</span>
                <input maxLength={100} value={venueNameDraft} onChange={(event) => setVenueNameDraft(event.target.value)} className="w-full rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3" />
              </label>
              <button type="button" disabled={savingVenue || !venueNameDraft.trim()} onClick={() => void updateVenue({ name: venueNameDraft })} className="self-end rounded-lg bg-[var(--color-panel-soft)] px-4 py-3 font-black disabled:opacity-60">{savingVenue ? "Saving…" : "Save Venue Name"}</button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-panel-border)] pt-4">
              <button type="button" disabled={savingVenue || removingVenue} onClick={() => void toggleVenueArchive()} className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm font-bold disabled:opacity-50">{selectedVenue.status === "active" ? "Archive Venue" : "Restore Venue"}</button>
              {linkedVenues.length > 1 && (
                <button type="button" disabled={removingVenue || savingVenue} onClick={() => void removeVenueFromLeague()} className="rounded-lg border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold disabled:opacity-50">Remove from This League</button>
              )}
              <button type="button" disabled={removingVenue || savingVenue} onClick={() => void deleteEmptyVenue()} className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-bold text-red-200 disabled:opacity-50">Delete Empty Venue</button>
            </div>
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
              Delete is intentionally limited to venues with no boards, devices, or Game Night history. Archive preserves all historical records. A shared venue can be removed from just this league while other leagues keep using it.
            </p>
          </div>
        )}
      </section>

      {!selectedVenue && (
        <section className="rounded-2xl border border-dashed border-[var(--color-panel-border)] p-6 text-center text-sm text-[var(--color-text-muted)]">
          Create or choose a venue before adding dartboards and scoring devices.
        </section>
      )}

      {selectedVenue && venueArchived && (
        <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
          <div className="font-black">This venue is archived.</div>
          <p className="mt-1 text-sm opacity-80">Its boards and devices are preserved below for reference, but hardware changes and new Game Night use are disabled until the venue is restored.</p>
        </div>
      )}

      {selectedVenue && (
        <>
          <section className="mb-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Dartboards at {selectedVenue.name}</h2>
                <p className="text-sm text-[var(--color-text-muted)]">These are the actual dartboards at this venue. Mark one out of service if it cannot be used.</p>
              </div>
              <span className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1 text-xs font-bold">{boards.length} configured</span>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {boards.map((board) => {
                const scorer = deviceByBoard.get(board.id) ?? null;
                const saving = savingBoardIds.has(board.id) || Boolean(scorer && savingDeviceIds.has(scorer.id));
                return (
                  <article
                    id={`board-${board.id}`}
                    key={board.id}
                    className={`scroll-mt-6 rounded-xl border p-4 transition ${
                      targetBoardId === board.id
                        ? "border-[var(--color-primary)] bg-blue-500/10 ring-2 ring-[var(--color-primary)]/40"
                        : "border-[var(--color-panel-border)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-black">Board {board.boardNumber}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{board.status === "active" ? "Available for play" : "Out of service"}</div>
                      </div>
                      <button type="button" disabled={saving || venueArchived} onClick={() => void saveBoard(board, board.status === "active" ? "out_of_service" : "active")} className="rounded-lg border border-[var(--color-panel-border)] px-3 py-2 text-xs font-bold disabled:opacity-50">{board.status === "active" ? "Mark Out of Service" : "Restore"}</button>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input disabled={venueArchived} value={boardNames[board.id] ?? board.name} onChange={(event) => setBoardNames((current) => ({ ...current, [board.id]: event.target.value }))} className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 disabled:opacity-60" />
                      <button type="button" disabled={savingBoardIds.has(board.id) || venueArchived} onClick={() => void saveBoard(board)} className="rounded-lg bg-[var(--color-panel-soft)] px-3 py-2 font-bold disabled:opacity-50">Save Name</button>
                    </div>
                    <label className="mt-3 block">
                      <span className="mb-1 block text-xs font-bold">Scorer for this board</span>
                      <select value={scorer?.id ?? ""} disabled={saving || venueArchived} onChange={(event) => void setBoardScorer(board, event.target.value)} className="w-full rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 disabled:opacity-60">
                        <option value="">No scorer assigned</option>
                        {devices.map((device) => (
                          <option key={device.id} value={device.id}>
                            {device.name}{device.physicalBoardId && device.physicalBoardId !== board.id ? ` — move from ${device.boardName}` : device.status === "disabled" ? " — disabled" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    {scorer && (
                      <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                        Scorer:{" "}
                        <Link
                          href={`/league-devices?leagueId=${encodeURIComponent(leagueId)}&venueId=${encodeURIComponent(venueId)}&deviceId=${encodeURIComponent(scorer.id)}`}
                          className="font-black hover:text-[var(--color-primary)] hover:underline"
                        >
                          {scorer.name}
                        </Link>{" "}
                        · {scorer.status === "active" ? "Enabled" : "Disabled"} · {seenLabel(scorer.lastSeenAt)}{savingDeviceIds.has(scorer.id) ? " · Saving…" : ""}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <form onSubmit={addBoard} className="mt-4 grid gap-2 rounded-xl border border-dashed border-[var(--color-panel-border)] p-4 sm:grid-cols-[120px_1fr_auto]">
              <label className="text-xs font-bold">Board number<input disabled={venueArchived} type="number" min={1} max={128} value={newBoardNumber} onChange={(event) => setNewBoardNumber(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2 disabled:opacity-60" /></label>
              <label className="text-xs font-bold">Name (optional)<input disabled={venueArchived} value={newBoardName} onChange={(event) => setNewBoardName(event.target.value)} placeholder={`Board ${newBoardNumber}`} className="mt-1 w-full rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2 disabled:opacity-60" /></label>
              <button disabled={addingBoard || venueArchived} className="self-end rounded-lg bg-[var(--color-primary)] px-4 py-2.5 font-black text-white disabled:opacity-60">{addingBoard ? "Adding…" : "Add Board"}</button>
            </form>
          </section>

          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
            <div>
              <h2 className="text-2xl font-black">Scoring Devices at {selectedVenue.name}</h2>
              <p className="text-sm text-[var(--color-text-muted)]">A device may serve one board at a time or remain unassigned as a ready spare.</p>
            </div>
            <div className="mt-4 space-y-3">
              {devices.map((device) => {
                const saving = savingDeviceIds.has(device.id);
                return (
                  <article
                    id={`device-${device.id}`}
                    key={device.id}
                    className={`scroll-mt-6 rounded-xl border p-4 transition ${
                      targetDeviceId === device.id
                        ? "border-[var(--color-primary)] bg-blue-500/10 ring-2 ring-[var(--color-primary)]/40"
                        : "border-[var(--color-panel-border)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black">{device.name}</span>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${device.status === "active" ? "bg-emerald-500/20" : "bg-red-500/20"}`}>{device.status}</span>
                          {saving && <span className="text-xs text-[var(--color-text-muted)]">Saving…</span>}
                        </div>
                        <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                          {device.physicalBoardId && device.boardName ? (
                            <Link
                              href={`/league-devices?leagueId=${encodeURIComponent(leagueId)}&venueId=${encodeURIComponent(venueId)}&boardId=${encodeURIComponent(device.physicalBoardId)}`}
                              className="font-bold hover:text-[var(--color-primary)] hover:underline"
                            >
                              {device.boardName}
                            </Link>
                          ) : (
                            "Spare / unassigned"
                          )}{" "}
                          · {seenLabel(device.lastSeenAt)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" disabled={saving || device.status !== "active" || venueArchived} onClick={() => void pairExisting(device)} className="rounded-lg border border-[var(--color-panel-border)] px-3 py-2 text-sm font-bold disabled:opacity-50">{pairingDeviceId === device.id ? "Pairing…" : "Pair / Re-pair"}</button>
                        <button type="button" disabled={saving || venueArchived} onClick={() => void toggleDevice(device)} className="rounded-lg border border-[var(--color-panel-border)] px-3 py-2 text-sm font-bold disabled:opacity-50">{device.status === "active" ? "Disable" : "Enable"}</button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_220px_auto]">
                      <input disabled={venueArchived} value={deviceNames[device.id] ?? device.name} onChange={(event) => setDeviceNames((current) => ({ ...current, [device.id]: event.target.value }))} className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 disabled:opacity-60" />
                      <select value={device.physicalBoardId ?? ""} disabled={saving || venueArchived} onChange={(event) => void assignDevice(device, event.target.value || null)} className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 disabled:opacity-60">
                        <option value="">Spare / unassigned</option>
                        {boards.map((board) => <option key={board.id} value={board.id}>{board.name}{deviceByBoard.get(board.id) && deviceByBoard.get(board.id)?.id !== device.id ? ` — replace ${deviceByBoard.get(board.id)?.name}` : ""}</option>)}
                      </select>
                      <button type="button" disabled={saving || venueArchived} onClick={() => void saveDeviceName(device)} className="rounded-lg bg-[var(--color-panel-soft)] px-3 py-2 font-bold disabled:opacity-50">Save Name</button>
                    </div>
                  </article>
                );
              })}
              {devices.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">No scoring devices registered yet.</p>}
            </div>

            <form onSubmit={registerDevice} className="mt-4 grid gap-2 rounded-xl border border-dashed border-[var(--color-panel-border)] p-4 sm:grid-cols-[1fr_220px_auto]">
              <input disabled={venueArchived} required maxLength={80} value={newDeviceName} onChange={(event) => setNewDeviceName(event.target.value)} placeholder="Spare Scorer" className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3 disabled:opacity-60" />
              <select disabled={venueArchived} value={newDeviceBoardId} onChange={(event) => setNewDeviceBoardId(event.target.value)} className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3 disabled:opacity-60">
                <option value="">Register as spare</option>
                {boards.map((board) => <option key={board.id} value={board.id}>{board.name}{deviceByBoard.has(board.id) ? " — replace current scorer" : ""}</option>)}
              </select>
              <button disabled={registering || venueArchived} className="rounded-lg bg-[var(--color-primary)] px-4 py-3 font-black text-white disabled:opacity-60">{registering ? "Registering…" : "Register & Pair"}</button>
            </form>
          </section>
        </>
      )}
    </main>
  );
}
