import { getRequestSession } from "@/lib/auth/server";
import { createLeagueForUser, listLeaguesForUser } from "@/lib/db";
import type {
  CreateLeagueRequest,
  CreateLeagueResponse,
  LeagueListResponse,
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
    console.error("Authentication service unavailable during league request.", error);
    return { user: null, unavailable: true };
  }
}

function authFailureResponse(unavailable: boolean) {
  return unavailable
    ? noStoreJson({ error: "Account service is unavailable." }, { status: 503 })
    : noStoreJson({ error: "Authentication required." }, { status: 401 });
}

function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 80;
}

export async function GET(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) {
    return authFailureResponse(authState.unavailable);
  }

  try {
    const leagues = await listLeaguesForUser(authState.user.id);
    return noStoreJson({ leagues } satisfies LeagueListResponse);
  } catch (error) {
    console.error("Could not list leagues.", error);
    return noStoreJson({ error: "League service is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) {
    return authFailureResponse(authState.unavailable);
  }

  let input: CreateLeagueRequest;
  try {
    input = (await request.json()) as CreateLeagueRequest;
  } catch {
    return noStoreJson({ error: "Invalid league request." }, { status: 400 });
  }

  if (!validName(input.name)) {
    return noStoreJson(
      { error: "League name must be between 1 and 80 characters." },
      { status: 400 },
    );
  }

  const firstSeasonName = input.firstSeasonName?.trim() ?? "";
  if (firstSeasonName.length > 80) {
    return noStoreJson(
      { error: "Season name must be 80 characters or fewer." },
      { status: 400 },
    );
  }

  try {
    const league = await createLeagueForUser({
      id: crypto.randomUUID(),
      membershipId: crypto.randomUUID(),
      userId: authState.user.id,
      name: input.name,
      firstSeason: firstSeasonName
        ? { id: crypto.randomUUID(), name: firstSeasonName }
        : undefined,
    });

    return noStoreJson(
      { league } satisfies CreateLeagueResponse,
      { status: 201 },
    );
  } catch (error) {
    console.error("Could not create league.", error);
    return noStoreJson(
      { error: "The league could not be created." } satisfies CreateLeagueResponse,
      { status: 503 },
    );
  }
}
