import { getRequestSession } from "@/lib/auth/server";
import { getSeasonLegStandingsForUser } from "@/lib/db/repositories/seasonLegStandings";
import { LeaguePermissionError } from "@/lib/db/repositories/leagues";

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
    console.error("Authentication service unavailable during standings request.", error);
    return noStoreJson({ error: "Account service is unavailable." }, { status: 503 });
  }

  if (!session?.user) {
    return noStoreJson({ error: "Authentication required." }, { status: 401 });
  }

  const seasonId = new URL(request.url).searchParams.get("seasonId");
  if (!seasonId) {
    return noStoreJson({ error: "seasonId is required." }, { status: 400 });
  }

  try {
    return noStoreJson({
      standings: await getSeasonLegStandingsForUser(seasonId, session.user.id),
    });
  } catch (error) {
    if (error instanceof LeaguePermissionError) {
      return noStoreJson({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Could not load season standings.";
    return noStoreJson({ error: message }, { status: 400 });
  }
}
