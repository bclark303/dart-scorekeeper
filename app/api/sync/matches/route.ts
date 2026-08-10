import { getRequestSession } from "@/lib/auth/server";
import {
  listX01MatchArchivesForUser,
  MatchOwnershipError,
  saveX01MatchArchiveForUser,
} from "@/lib/db";
import type {
  MatchSyncDownloadResponse,
  MatchSyncUploadResponse,
} from "@/lib/sync/contracts";
import { parseMatchSyncUpload } from "@/lib/sync/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 1_000_000;

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

async function getAuthenticatedUser(request: Request) {
  try {
    const session = await getRequestSession(request);
    return {
      user: session?.user ?? null,
      unavailable: false,
    };
  } catch (error) {
    console.error("Authentication service unavailable during sync.", error);
    return {
      user: null,
      unavailable: true,
    };
  }
}

function authFailureResponse(unavailable: boolean) {
  return unavailable
    ? noStoreJson({ error: "Account service is unavailable." }, { status: 503 })
    : noStoreJson({ error: "Authentication required." }, { status: 401 });
}

export async function GET(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) {
    return authFailureResponse(authState.unavailable);
  }

  try {
    const matches = await listX01MatchArchivesForUser(authState.user.id, 100);
    return noStoreJson({
      matches,
      serverTime: Date.now(),
    } satisfies MatchSyncDownloadResponse);
  } catch (error) {
    console.error("Could not download synchronized matches.", error);
    return noStoreJson({ error: "Sync service is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) {
    return authFailureResponse(authState.unavailable);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return noStoreJson({ error: "Sync request is too large." }, { status: 413 });
  }

  let archives;
  try {
    // Do not rely on Content-Length alone; clients/proxies may omit it.
    const bodyText = await request.text();
    if (new TextEncoder().encode(bodyText).byteLength > MAX_REQUEST_BYTES) {
      return noStoreJson({ error: "Sync request is too large." }, { status: 413 });
    }
    archives = parseMatchSyncUpload(JSON.parse(bodyText));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid sync request.";
    return noStoreJson({ error: message }, { status: 400 });
  }

  const accepted: string[] = [];
  const errors: Array<{ id: string; message: string }> = [];

  for (const archive of archives) {
    try {
      await saveX01MatchArchiveForUser(authState.user.id, archive);
      accepted.push(archive.id);
    } catch (error) {
      if (error instanceof MatchOwnershipError) {
        errors.push({
          id: archive.id,
          message: "This match ID belongs to another account.",
        });
        continue;
      }

      console.error(`Could not synchronize match ${archive.id}.`, error);
      errors.push({
        id: archive.id,
        message: "The server could not save this match.",
      });
    }
  }

  return noStoreJson({
    accepted,
    errors,
    serverTime: Date.now(),
  } satisfies MatchSyncUploadResponse);
}
