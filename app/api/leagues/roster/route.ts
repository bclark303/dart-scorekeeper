import { getRequestSession } from "@/lib/auth/server";
import {
  addLeaguePlayerToSeasonForUser,
  LeaguePermissionError,
  removeLeaguePlayerFromSeasonForUser,
} from "@/lib/db";
import type {
  SeasonRosterMutationRequest,
  SeasonRosterMutationResponse,
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
    console.error("Authentication service unavailable during roster request.", error);
    return null;
  }
}

async function parseRequest(request: Request) {
  try {
    const input = (await request.json()) as SeasonRosterMutationRequest;
    if (!input.leagueId?.trim() || !input.seasonId?.trim() || !input.leaguePlayerId?.trim()) {
      return null;
    }
    return input;
  } catch {
    return null;
  }
}

async function mutate(request: Request, enroll: boolean) {
  const user = await authenticatedUser(request);
  if (!user) return noStoreJson({ error: "Authentication required." }, { status: 401 });

  const input = await parseRequest(request);
  if (!input) return noStoreJson({ error: "League, season, and player are required." }, { status: 400 });

  try {
    const player = enroll
      ? await addLeaguePlayerToSeasonForUser({
          ...input,
          rosterEntryId: crypto.randomUUID(),
          userId: user.id,
        })
      : await removeLeaguePlayerFromSeasonForUser({ ...input, userId: user.id });

    return noStoreJson({ player } satisfies SeasonRosterMutationResponse);
  } catch (error) {
    if (error instanceof LeaguePermissionError) {
      return noStoreJson({ error: error.message } satisfies SeasonRosterMutationResponse, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "The roster could not be changed.";
    return noStoreJson({ error: message } satisfies SeasonRosterMutationResponse, { status: 400 });
  }
}

export async function POST(request: Request) {
  return mutate(request, true);
}

export async function DELETE(request: Request) {
  return mutate(request, false);
}
