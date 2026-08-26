import type { DatabaseConnectionDraft } from "@/lib/setup/contracts";
import { testDatabaseDraft } from "@/lib/setup/databaseSetup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16_384;

export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return Response.json(
        { ok: false, message: "Setup request is too large." },
        { status: 413 },
      );
    }

    const parsed = JSON.parse(body) as {
      draft?: DatabaseConnectionDraft;
      setupToken?: string;
    };

    if (!parsed.draft || typeof parsed.draft !== "object") {
      return Response.json(
        { ok: false, message: "Database configuration is required." },
        { status: 400 },
      );
    }

    const result = await testDatabaseDraft(parsed.draft, parsed.setupToken);
    return Response.json(result, {
      status: result.ok ? 200 : 400,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Invalid setup request.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
