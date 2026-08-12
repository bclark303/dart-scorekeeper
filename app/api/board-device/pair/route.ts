import { claimBoardDevicePairing } from "@/lib/db/repositories/boardDevicePairing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

export async function POST(request: Request) {
  let input: { code?: string };
  try {
    input = await request.json();
  } catch {
    return noStoreJson({ error: "Invalid pairing request." }, { status: 400 });
  }

  try {
    return noStoreJson(
      await claimBoardDevicePairing({ code: String(input.code ?? "") }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Device pairing failed.";
    return noStoreJson({ error: message }, { status: 400 });
  }
}
