import { displayConnection } from "@/lib/db/repositories/displayEnrollment";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = /^Bearer (dsd_[^\s]+)$/i.exec(authorization)?.[1] ?? "";
  try {
    return Response.json(await displayConnection(token), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Display credential invalid or revoked." }, {
      status: 401, headers: { "Cache-Control": "no-store" },
    });
  }
}
// Deliberately no POST / PATCH / DELETE; display credentials authorize reads only.
