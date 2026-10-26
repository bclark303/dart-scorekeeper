import { getRequestSession } from "@/lib/auth/server";
import { claimDisplayEnrollment } from "@/lib/db/repositories/displayEnrollment";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const session = await getRequestSession(request);
  if (!session?.user) return reply({ error: "Sign in as a league administrator." }, 401);
  let body: { pin?: string; venueId?: string; physicalBoardId?: string; name?: string };
  try { body = await request.json(); } catch { return reply({ error: "Invalid pairing request." }, 400); }
  try {
    return reply(await claimDisplayEnrollment({
      pin: String(body.pin ?? ""), userId: session.user.id, venueId: String(body.venueId ?? ""),
      physicalBoardId: String(body.physicalBoardId ?? ""), name: String(body.name ?? ""),
    }));
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Could not pair display." }, 400);
  }
}
