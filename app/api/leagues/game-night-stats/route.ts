import { and, eq } from "drizzle-orm";

import { getRequestSession } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { gameNights } from "@/lib/db/game-night-schema";
import {
  leagueMatchSessions,
  leagueMatchTurns,
} from "@/lib/db/league-match-schema";
import { leagueMemberships, seasons } from "@/lib/db/schema";
import { buildGameNightStats } from "@/lib/league/gameNightStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

export async function GET(request: Request) {
  let session;
  try {
    session = await getRequestSession(request);
  } catch (error) {
    console.error("Authentication service unavailable during stats request.", error);
    return noStoreJson(
      { error: "Account service is unavailable." },
      { status: 503 },
    );
  }

  if (!session?.user) {
    return noStoreJson({ error: "Authentication required." }, { status: 401 });
  }

  const gameNightId = new URL(request.url).searchParams.get("gameNightId");
  if (!gameNightId) {
    return noStoreJson({ error: "gameNightId is required." }, { status: 400 });
  }

  const database = getDatabase();
  const [night] = await database
    .select({ leagueId: seasons.leagueId })
    .from(gameNights)
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .where(eq(gameNights.id, gameNightId))
    .limit(1);

  if (!night) {
    return noStoreJson({ error: "Game night was not found." }, { status: 404 });
  }

  const [membership] = await database
    .select({ id: leagueMemberships.id })
    .from(leagueMemberships)
    .where(
      and(
        eq(leagueMemberships.leagueId, night.leagueId),
        eq(leagueMemberships.userId, session.user.id),
        eq(leagueMemberships.status, "active"),
      ),
    )
    .limit(1);

  if (!membership) {
    return noStoreJson(
      { error: "League membership is required." },
      { status: 403 },
    );
  }

  const turns = await database
    .select({
      leaguePlayerId: leagueMatchTurns.leaguePlayerId,
      displayName: leagueMatchTurns.displayName,
      scoreEntered: leagueMatchTurns.scoreEntered,
      isBust: leagueMatchTurns.isBust,
      isCheckout: leagueMatchTurns.isCheckout,
      isDummy: leagueMatchTurns.isDummy,
      voidedAt: leagueMatchTurns.voidedAt,
      finishRule: leagueMatchSessions.finishRule,
    })
    .from(leagueMatchTurns)
    .innerJoin(
      leagueMatchSessions,
      eq(leagueMatchTurns.matchSessionId, leagueMatchSessions.id),
    )
    .where(eq(leagueMatchSessions.gameNightId, gameNightId));

  return noStoreJson({ stats: buildGameNightStats(turns) });
}
