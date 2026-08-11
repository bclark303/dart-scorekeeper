import {
  BoardDeviceAssignmentError,
  BoardDeviceCredentialError,
  getBoardDeviceConnectionForCredential,
  getBoardDeviceMatchForCredential,
  LeagueMatchStateError,
  startBoardDeviceMatchForCredential,
  submitBoardDeviceTurnForCredential,
  undoBoardDeviceTurnForCredential,
} from "@/lib/db";
import type { LeagueMatchMutationRequest } from "@/lib/league/matchContracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

function getDeviceKey(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

function credentialFailure() {
  return noStoreJson({ error: "A valid board device key is required." }, { status: 401 });
}

function errorResponse(error: unknown) {
  if (error instanceof BoardDeviceCredentialError) {
    return noStoreJson(
      { error: error.message },
      { status: error.reason === "disabled" ? 403 : 401 },
    );
  }
  if (error instanceof BoardDeviceAssignmentError) {
    return noStoreJson({ error: error.message }, { status: 403 });
  }
  if (error instanceof LeagueMatchStateError) {
    return noStoreJson({ error: error.message }, { status: 409 });
  }
  const message = error instanceof Error ? error.message : "Board device service is unavailable.";
  console.error("Board device request failed.", error);
  return noStoreJson({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  const deviceKey = getDeviceKey(request);
  if (!deviceKey) return credentialFailure();
  const matchId = new URL(request.url).searchParams.get("matchId");

  try {
    if (matchId) {
      return noStoreJson({ match: await getBoardDeviceMatchForCredential(deviceKey, matchId) });
    }
    return noStoreJson(await getBoardDeviceConnectionForCredential(deviceKey));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const deviceKey = getDeviceKey(request);
  if (!deviceKey) return credentialFailure();

  let input: LeagueMatchMutationRequest;
  try {
    input = (await request.json()) as LeagueMatchMutationRequest;
  } catch {
    return noStoreJson({ error: "Invalid board device match request." }, { status: 400 });
  }
  if (!input.matchId) return noStoreJson({ error: "matchId is required." }, { status: 400 });

  try {
    if (input.action === "start") {
      return noStoreJson({ match: await startBoardDeviceMatchForCredential(deviceKey, input.matchId) });
    }
    if (input.action === "undo") {
      return noStoreJson({ match: await undoBoardDeviceTurnForCredential(deviceKey, input.matchId) });
    }
    if (input.action === "score") {
      if (
        !input.turnId ||
        !Number.isInteger(input.scoreEntered) ||
        input.scoreEntered < 0 ||
        input.scoreEntered > 180 ||
        ![1, 2, 3].includes(input.dartsThrown)
      ) {
        return noStoreJson(
          { error: "A turn ID, score from 0-180, and 1-3 darts are required." },
          { status: 400 },
        );
      }
      return noStoreJson({
        match: await submitBoardDeviceTurnForCredential({
          deviceKey,
          matchId: input.matchId,
          turnId: input.turnId,
          scoreEntered: input.scoreEntered,
          dartsThrown: input.dartsThrown,
          checkoutConfirmed: input.checkoutConfirmed,
        }),
      });
    }
    return noStoreJson({ error: "Unknown board device match action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
