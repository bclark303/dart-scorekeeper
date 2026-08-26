import { getRequestSession } from "@/lib/auth/server";
import { LeaguePermissionError, listPlayerDirectoryForUser } from "@/lib/db";
import { getPlayerCareerStatsForUser } from "@/lib/db/repositories";
import type { PlayerCareerStatsResponse } from "@/lib/league/playerStatsContracts";
import type { PlayerDirectoryListResponse } from "@/lib/league/rosterContracts";

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
    console.error("Authentication service unavailable during player-directory request.", error);
    return null;
  }
}

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return noStoreJson({ error: "Authentication required." }, { status: 401 });

  const playerId = new URL(request.url).searchParams.get("playerId")?.trim() ?? "";

  try {
    if (playerId) {
      const player = await getPlayerCareerStatsForUser(playerId, user.id);
      return noStoreJson({ player } satisfies PlayerCareerStatsResponse);
    }

    const players = await listPlayerDirectoryForUser(user.id);
    return noStoreJson({ players } satisfies PlayerDirectoryListResponse);
  } catch (error) {
    if (error instanceof LeaguePermissionError) {
      return noStoreJson({ error: error.message }, { status: 403 });
    }
    console.error("Could not load player data.", error);
    return noStoreJson({ error: "Player service is unavailable." }, { status: 503 });
  }
}
