import { getRequestSession } from "@/lib/auth/server";
import {
  getLeagueMatchForUser,
  LeagueMatchStateError,
  LeaguePermissionError,
  startLeagueMatchForUser,
  submitLeagueMatchTurnForUser,
  undoLastLeagueMatchTurnForUser,
} from "@/lib/db";
import type { LeagueMatchMutationRequest } from "@/lib/league/matchContracts";

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
    console.error("Authentication service unavailable during league-match request.", error);
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
  if (error instanceof LeagueMatchStateError) {
    return noStoreJson({ error: error.message }, { status: 409 });
  }
  const message = error instanceof Error ? error.message : "League match service is unavailable.";
  console.error("League-match request failed.", error);
  return noStoreJson({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) return authFailureResponse(authState.unavailable);

  const matchId = new URL(request.url).searchParams.get("matchId");
  if (!matchId) return noStoreJson({ error: "matchId is required." }, { status: 400 });

  try {
    return noStoreJson({ match: await getLeagueMatchForUser(matchId, authState.user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) return authFailureResponse(authState.unavailable);

  let input: LeagueMatchMutationRequest;
  try {
    input = (await request.json()) as LeagueMatchMutationRequest;
  } catch {
    return noStoreJson({ error: "Invalid league-match request." }, { status: 400 });
  }

  if (!input.matchId) {
    return noStoreJson({ error: "matchId is required." }, { status: 400 });
  }

  try {
    if (input.action === "start") {
      return noStoreJson({ match: await startLeagueMatchForUser(input.matchId, authState.user.id) });
    }

    if (input.action === "undo") {
      return noStoreJson({ match: await undoLastLeagueMatchTurnForUser(input.matchId, authState.user.id) });
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
        match: await submitLeagueMatchTurnForUser({
          matchId: input.matchId,
          userId: authState.user.id,
          turnId: input.turnId,
          scoreEntered: input.scoreEntered,
          dartsThrown: input.dartsThrown,
          checkoutConfirmed: input.checkoutConfirmed,
        }),
      });
    }

    return noStoreJson({ error: "Unknown league-match action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
