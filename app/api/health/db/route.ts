import {
  getDatabaseConfigurationStatus,
  pingDatabase,
} from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Provider-neutral persistence health check.
 *
 * It intentionally reports only the provider class/target and never returns a
 * database URL or authentication token.
 */
export async function GET() {
  const configuration = getDatabaseConfigurationStatus();

  if (!configuration.configured) {
    return Response.json(
      {
        status: "unconfigured",
        provider: configuration.provider,
        reason: configuration.reason,
      },
      { status: 503 },
    );
  }

  try {
    await pingDatabase();

    return Response.json({
      status: "ok",
      provider: configuration.provider,
      target: configuration.target,
    });
  } catch (error) {
    console.error("Database health check failed.", error);

    return Response.json(
      {
        status: "error",
        provider: configuration.provider,
        target: configuration.target,
      },
      { status: 503 },
    );
  }
}
