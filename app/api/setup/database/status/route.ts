import { getDatabaseSetupStatus } from "@/lib/setup/databaseSetup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getDatabaseSetupStatus();
  return Response.json(status, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
