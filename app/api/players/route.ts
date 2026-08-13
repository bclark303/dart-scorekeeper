import { getRequestSession } from "@/lib/auth/server";
import { listPlayerDirectoryForUser } from "@/lib/db";
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

  try {
    const players = await listPlayerDirectoryForUser(user.id);
    return noStoreJson({ players } satisfies PlayerDirectoryListResponse);
  } catch (error) {
    console.error("Could not list the player directory.", error);
    return noStoreJson(
      { error: "Player directory is unavailable." } satisfies PlayerDirectoryListResponse,
      { status: 503 },
    );
  }
}
