import { getRequestSession } from "@/lib/auth/server";
import { createSeasonForUser, LeaguePermissionError } from "@/lib/db";
import type {
  CreateSeasonRequest,
  CreateSeasonResponse,
} from "@/lib/league/contracts";

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
    console.error("Authentication service unavailable during season request.", error);
    return { user: null, unavailable: true };
  }
}

function authFailureResponse(unavailable: boolean) {
  return unavailable
    ? noStoreJson({ error: "Account service is unavailable." }, { status: 503 })
    : noStoreJson({ error: "Authentication required." }, { status: 401 });
}

export async function POST(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) {
    return authFailureResponse(authState.unavailable);
  }

  let input: CreateSeasonRequest;
  try {
    input = (await request.json()) as CreateSeasonRequest;
  } catch {
    return noStoreJson({ error: "Invalid season request." }, { status: 400 });
  }

  const leagueId = typeof input.leagueId === "string" ? input.leagueId.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";

  if (!leagueId) {
    return noStoreJson({ error: "League ID is required." }, { status: 400 });
  }

  if (!name || name.length > 80) {
    return noStoreJson(
      { error: "Season name must be between 1 and 80 characters." },
      { status: 400 },
    );
  }

  try {
    const season = await createSeasonForUser({
      id: crypto.randomUUID(),
      leagueId,
      userId: authState.user.id,
      name,
    });

    return noStoreJson(
      { season } satisfies CreateSeasonResponse,
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof LeaguePermissionError) {
      return noStoreJson(
        { error: error.message } satisfies CreateSeasonResponse,
        { status: 403 },
      );
    }

    console.error("Could not create season.", error);
    return noStoreJson(
      { error: "The season could not be created." } satisfies CreateSeasonResponse,
      { status: 503 },
    );
  }
}
