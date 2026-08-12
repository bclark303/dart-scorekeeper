import { getRequestSession } from "@/lib/auth/server";
import { createBoardDevicePairingForUser } from "@/lib/db/repositories/boardDevicePairing";
import { LeaguePermissionError } from "@/lib/db/repositories/leagues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

export async function POST(request: Request) {
  let session;
  try {
    session = await getRequestSession(request);
  } catch (error) {
    console.error("Authentication service unavailable during device pairing.", error);
    return noStoreJson({ error: "Account service is unavailable." }, { status: 503 });
  }

  if (!session?.user) {
    return noStoreJson({ error: "Authentication required." }, { status: 401 });
  }

  let input: { deviceId?: string };
  try {
    input = await request.json();
  } catch {
    return noStoreJson({ error: "Invalid pairing request." }, { status: 400 });
  }
  if (!input.deviceId) {
    return noStoreJson({ error: "deviceId is required." }, { status: 400 });
  }

  try {
    return noStoreJson(
      await createBoardDevicePairingForUser({
        deviceId: input.deviceId,
        userId: session.user.id,
      }),
    );
  } catch (error) {
    if (error instanceof LeaguePermissionError) {
      return noStoreJson({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Could not create pairing code.";
    return noStoreJson({ error: message }, { status: 400 });
  }
}
