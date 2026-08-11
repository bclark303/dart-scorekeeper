import { getRequestSession } from "@/lib/auth/server";
import {
  createLeaguePlayerForUser,
  LeaguePermissionError,
  listLeaguePlayersForUser,
} from "@/lib/db";
import type {
  CreateLeaguePlayerRequest,
  CreateLeaguePlayerResponse,
  LeaguePlayerListResponse,
} from "@/lib/league/rosterContracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

async function authenticatedUser(request: Request) {
  try {
    return (await getRequestSession(request))?.user ?? null;
  } catch (error) {
    console.error("Authentication service unavailable during player request.", error);
    return null;
  }
}

function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 80;
}

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return noStoreJson({ error: "Authentication required." }, { status: 401 });

  const leagueId = new URL(request.url).searchParams.get("leagueId")?.trim() ?? "";
  if (!leagueId) return noStoreJson({ error: "leagueId is required." }, { status: 400 });

  try {
    const players = await listLeaguePlayersForUser(leagueId, user.id);
    return noStoreJson({ players } satisfies LeaguePlayerListResponse);
  } catch (error) {
    if (error instanceof LeaguePermissionError) {
      return noStoreJson({ error: error.message }, { status: 403 });
    }
    console.error("Could not list league players.", error);
    return noStoreJson({ error: "Player service is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return noStoreJson({ error: "Authentication required." }, { status: 401 });

  let input: CreateLeaguePlayerRequest;
  try {
    input = (await request.json()) as CreateLeaguePlayerRequest;
  } catch {
    return noStoreJson({ error: "Invalid player request." }, { status: 400 });
  }

  if (!input.leagueId?.trim() || !validName(input.displayName)) {
    return noStoreJson(
      { error: "League and a player name between 1 and 80 characters are required." },
      { status: 400 },
    );
  }

  try {
    const player = await createLeaguePlayerForUser({
      playerId: crypto.randomUUID(),
      leaguePlayerId: crypto.randomUUID(),
      leagueId: input.leagueId,
      userId: user.id,
      displayName: input.displayName,
    });
    return noStoreJson({ player } satisfies CreateLeaguePlayerResponse, { status: 201 });
  } catch (error) {
    if (error instanceof LeaguePermissionError) {
      return noStoreJson({ error: error.message } satisfies CreateLeaguePlayerResponse, { status: 403 });
    }
    console.error("Could not create league player.", error);
    return noStoreJson({ error: "The player could not be created." } satisfies CreateLeaguePlayerResponse, { status: 503 });
  }
}
