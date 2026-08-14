import { getRequestSession } from "@/lib/auth/server";
import {
  BoardDeviceCredentialError,
  createPhysicalBoardForUser,
  getVenueHardwareForUser,
  LeaguePermissionError,
  registerBoardDeviceForUser,
  rotateBoardDeviceKeyForUser,
  updateBoardDeviceForUser,
  updatePhysicalBoardForUser,
} from "@/lib/db";
import type {
  BoardDeviceStatus,
  PhysicalBoardStatus,
} from "@/lib/league/boardDeviceContracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

async function getAuthenticatedUser(request: Request) {
  try {
    const session = await getRequestSession(request);
    return { user: session?.user ?? null, unavailable: false };
  } catch (error) {
    console.error("Authentication service unavailable during venue hardware administration.", error);
    return { user: null, unavailable: true };
  }
}

function authFailureResponse(unavailable: boolean) {
  return unavailable
    ? noStoreJson({ error: "Account service is unavailable." }, { status: 503 })
    : noStoreJson({ error: "Authentication required." }, { status: 401 });
}

function errorResponse(error: unknown) {
  if (error instanceof LeaguePermissionError) {
    return noStoreJson({ error: error.message }, { status: 403 });
  }
  if (error instanceof BoardDeviceCredentialError) {
    return noStoreJson({ error: error.message }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "Venue hardware administration failed.";
  console.error("Venue hardware administration failed.", error);
  return noStoreJson({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) return authFailureResponse(authState.unavailable);
  const url = new URL(request.url);
  const leagueId = url.searchParams.get("leagueId");
  const venueId = url.searchParams.get("venueId");
  if (!leagueId) return noStoreJson({ error: "leagueId is required." }, { status: 400 });

  try {
    return noStoreJson(
      await getVenueHardwareForUser({
        leagueId,
        venueId,
        userId: authState.user.id,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) return authFailureResponse(authState.unavailable);

  let input:
    | {
        action?: "device";
        leagueId?: string;
        venueId?: string;
        name?: string;
        physicalBoardId?: string | null;
        boardNumber?: number;
      }
    | {
        action: "board";
        leagueId?: string;
        venueId?: string;
        boardNumber?: number;
        name?: string;
      };
  try {
    input = await request.json();
  } catch {
    return noStoreJson({ error: "Invalid venue hardware request." }, { status: 400 });
  }

  if (!input.leagueId || !input.venueId) {
    return noStoreJson({ error: "League and venue are required." }, { status: 400 });
  }

  try {
    if (input.action === "board") {
      if (!Number.isInteger(input.boardNumber)) {
        return noStoreJson({ error: "A board number is required." }, { status: 400 });
      }
      const board = await createPhysicalBoardForUser({
        leagueId: input.leagueId,
        venueId: input.venueId,
        userId: authState.user.id,
        boardNumber: input.boardNumber as number,
        name: input.name,
      });
      return noStoreJson({ board }, { status: 201 });
    }

    if (typeof input.name !== "string") {
      return noStoreJson({ error: "Device name is required." }, { status: 400 });
    }
    const result = await registerBoardDeviceForUser({
      leagueId: input.leagueId,
      venueId: input.venueId,
      userId: authState.user.id,
      name: input.name,
      physicalBoardId: input.physicalBoardId,
      boardNumber: input.boardNumber,
    });
    return noStoreJson(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) return authFailureResponse(authState.unavailable);

  let input:
    | {
        action: "update";
        deviceId: string;
        name?: string;
        physicalBoardId?: string | null;
        boardNumber?: number;
        status?: BoardDeviceStatus;
      }
    | { action: "rotate"; deviceId: string }
    | {
        action: "board";
        boardId: string;
        name?: string;
        status?: PhysicalBoardStatus;
      };
  try {
    input = await request.json();
  } catch {
    return noStoreJson({ error: "Invalid venue hardware update request." }, { status: 400 });
  }

  try {
    if (input.action === "rotate") {
      return noStoreJson(
        await rotateBoardDeviceKeyForUser({
          deviceId: input.deviceId,
          userId: authState.user.id,
        }),
      );
    }
    if (input.action === "board") {
      if (input.status && input.status !== "active" && input.status !== "out_of_service") {
        return noStoreJson({ error: "Invalid physical board status." }, { status: 400 });
      }
      const board = await updatePhysicalBoardForUser({
        boardId: input.boardId,
        userId: authState.user.id,
        name: input.name,
        status: input.status,
      });
      return noStoreJson({ board });
    }
    if (input.action === "update") {
      if (!input.deviceId) return noStoreJson({ error: "deviceId is required." }, { status: 400 });
      if (input.status && input.status !== "active" && input.status !== "disabled") {
        return noStoreJson({ error: "Invalid device status." }, { status: 400 });
      }
      const device = await updateBoardDeviceForUser({
        deviceId: input.deviceId,
        userId: authState.user.id,
        name: input.name,
        physicalBoardId: input.physicalBoardId,
        boardNumber: input.boardNumber,
        status: input.status,
      });
      return noStoreJson({ device });
    }
    return noStoreJson({ error: "Unknown venue hardware action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
