import { beginDisplayEnrollment, pollDisplayEnrollment } from "@/lib/db/repositories/displayEnrollment";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function POST() {
  try { return reply(await beginDisplayEnrollment()); }
  catch { return reply({ error: "Unable to issue display PIN." }, 503); }
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestId = url.searchParams.get("requestId") ?? "";
  const verifier = request.headers.get("x-display-verifier") ?? "";
  try { return reply(await pollDisplayEnrollment(requestId, verifier)); }
  catch { return reply({ error: "Pairing request expired or invalid." }, 404); }
}
