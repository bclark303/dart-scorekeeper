import { getRequestSession } from "@/lib/auth/server";
import { getGameNightReadinessForUser, LeaguePermissionError } from "@/lib/db";

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
    console.error("Authentication service unavailable during Game Night readiness.", error);
    return { user: null, unavailable: true };
  }
}

export async function GET(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) {
    return authState.unavailable
      ? noStoreJson({ error: "Account service is unavailable." }, { status: 503 })
      : noStoreJson({ error: "Authentication required." }, { status: 401 });
  }

  const gameNightId = new URL(request.url).searchParams.get("gameNightId");
  if (!gameNightId) {
    return noStoreJson({ error: "gameNightId is required." }, { status: 400 });
  }

  try {
    return noStoreJson(
      await getGameNightReadinessForUser({
        gameNightId,
        userId: authState.user.id,
      }),
    );
  } catch (error) {
    if (error instanceof LeaguePermissionError) {
      return noStoreJson({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Game Night readiness failed.";
    console.error("Game Night readiness failed.", error);
    return noStoreJson({ error: message }, { status: 400 });
  }
}
