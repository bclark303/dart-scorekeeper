import { getRequestSession } from "@/lib/auth/server";
import {
  BoardDeviceCredentialError,
  LeaguePermissionError,
  listBoardDevicesForUser,
  registerBoardDeviceForUser,
  rotateBoardDeviceKeyForUser,
  updateBoardDeviceForUser,
} from "@/lib/db";
import type { BoardDeviceStatus } from "@/lib/league/boardDeviceContracts";

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
    console.error("Authentication service unavailable during board-device administration.", error);
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
  const message = error instanceof Error ? error.message : "Board-device administration failed.";
  console.error("Board-device administration failed.", error);
  return noStoreJson({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) return authFailureResponse(authState.unavailable);
  const leagueId = new URL(request.url).searchParams.get("leagueId");
  if (!leagueId) return noStoreJson({ error: "leagueId is required." }, { status: 400 });

  try {
    return noStoreJson({ devices: await listBoardDevicesForUser(leagueId, authState.user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) return authFailureResponse(authState.unavailable);

  let input: { leagueId?: string; name?: string; boardNumber?: number };
  try {
    input = await request.json();
  } catch {
    return noStoreJson({ error: "Invalid board-device registration request." }, { status: 400 });
  }

  if (!input.leagueId || typeof input.name !== "string") {
    return noStoreJson({ error: "League and device name are required." }, { status: 400 });
  }
  if (!Number.isInteger(input.boardNumber)) {
    return noStoreJson({ error: "A board number is required." }, { status: 400 });
  }

  try {
    const result = await registerBoardDeviceForUser({
      leagueId: input.leagueId,
      userId: authState.user.id,
      name: input.name,
      boardNumber: input.boardNumber as number,
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
    | { action: "update"; deviceId: string; name?: string; boardNumber?: number; status?: BoardDeviceStatus }
    | { action: "rotate"; deviceId: string };
  try {
    input = await request.json();
  } catch {
    return noStoreJson({ error: "Invalid board-device update request." }, { status: 400 });
  }
  if (!input.deviceId) return noStoreJson({ error: "deviceId is required." }, { status: 400 });

  try {
    if (input.action === "rotate") {
      return noStoreJson(await rotateBoardDeviceKeyForUser({
        deviceId: input.deviceId,
        userId: authState.user.id,
      }));
    }
    if (input.action === "update") {
      if (input.status && input.status !== "active" && input.status !== "disabled") {
        return noStoreJson({ error: "Invalid device status." }, { status: 400 });
      }
      const device = await updateBoardDeviceForUser({
        deviceId: input.deviceId,
        userId: authState.user.id,
        name: input.name,
        boardNumber: input.boardNumber,
        status: input.status,
      });
      return noStoreJson({ device });
    }
    return noStoreJson({ error: "Unknown board-device action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
