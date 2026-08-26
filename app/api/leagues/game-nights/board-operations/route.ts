import { getRequestSession } from "@/lib/auth/server";
import {
  LeaguePermissionError,
  listGameNightBoardUsagesForUser,
  relocateGameNightBoardForUser,
} from "@/lib/db";

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
    console.error("Authentication service unavailable during Game Night board operations.", error);
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
  const message = error instanceof Error ? error.message : "Game Night board operation failed.";
  console.error("Game Night board operation failed.", error);
  return noStoreJson({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) return authFailureResponse(authState.unavailable);
  const gameNightId = new URL(request.url).searchParams.get("gameNightId");
  if (!gameNightId) {
    return noStoreJson({ error: "gameNightId is required." }, { status: 400 });
  }

  try {
    return noStoreJson({
      usages: await listGameNightBoardUsagesForUser(gameNightId, authState.user.id),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) return authFailureResponse(authState.unavailable);

  let input: {
    action?: "relocateBoard";
    gameNightId?: string;
    gameNightBoardId?: string;
    physicalBoardId?: string;
  };
  try {
    input = await request.json();
  } catch {
    return noStoreJson({ error: "Invalid board operation request." }, { status: 400 });
  }

  if (
    input.action !== "relocateBoard" ||
    !input.gameNightId ||
    !input.gameNightBoardId ||
    !input.physicalBoardId
  ) {
    return noStoreJson(
      { error: "A Game Night, board slot, and destination physical board are required." },
      { status: 400 },
    );
  }

  try {
    const gameNight = await relocateGameNightBoardForUser({
      gameNightId: input.gameNightId,
      gameNightBoardId: input.gameNightBoardId,
      physicalBoardId: input.physicalBoardId,
      userId: authState.user.id,
    });
    return noStoreJson({
      gameNight,
      usages: await listGameNightBoardUsagesForUser(input.gameNightId, authState.user.id),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
