import { getRequestSession } from "@/lib/auth/server";
import {
  createGameNightTemplateForUser,
  LeaguePermissionError,
  listGameNightTemplatesForUser,
  updateGameNightTemplateForUser,
} from "@/lib/db";
import {
  DEFAULT_GAME_NIGHT_SETTINGS,
  resolveGameNightSettings,
  type GameNightSettingsSummary,
} from "@/lib/league/gameNightContracts";
import { isValidResolvedGameNightSettings } from "@/lib/league/gameNightSettingsValidation";

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
    console.error("Authentication service unavailable during template request.", error);
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

function resolvedSettings(settings?: GameNightSettingsSummary) {
  const resolved = resolveGameNightSettings(settings ?? DEFAULT_GAME_NIGHT_SETTINGS);
  if (!isValidResolvedGameNightSettings(resolved)) {
    throw new Error("Game-night template rules are invalid.");
  }
  return resolved;
}

function errorResponse(error: unknown) {
  if (error instanceof LeaguePermissionError) {
    return noStoreJson({ error: error.message }, { status: 403 });
  }
  const message = error instanceof Error ? error.message : "Template service is unavailable.";
  console.error("Game-night template request failed.", error);
  return noStoreJson({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) return authFailureResponse(authState.unavailable);
  const leagueId = new URL(request.url).searchParams.get("leagueId");
  if (!leagueId) return noStoreJson({ error: "leagueId is required." }, { status: 400 });
  try {
    return noStoreJson({
      templates: await listGameNightTemplatesForUser(leagueId, authState.user.id),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) return authFailureResponse(authState.unavailable);

  let input: {
    leagueId?: string;
    name?: string;
    settings?: GameNightSettingsSummary;
    isDefault?: boolean;
  };
  try {
    input = await request.json();
  } catch {
    return noStoreJson({ error: "Invalid template request." }, { status: 400 });
  }
  if (!input.leagueId || !validName(input.name)) {
    return noStoreJson({ error: "League and template name are required." }, { status: 400 });
  }
  if (input.isDefault !== undefined && typeof input.isDefault !== "boolean") {
    return noStoreJson({ error: "Invalid default-template setting." }, { status: 400 });
  }

  try {
    return noStoreJson(
      {
        template: await createGameNightTemplateForUser({
          id: crypto.randomUUID(),
          leagueId: input.leagueId,
          userId: authState.user.id,
          name: input.name,
          settings: resolvedSettings(input.settings),
          isDefault: input.isDefault,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) return authFailureResponse(authState.unavailable);

  let input: {
    templateId?: string;
    name?: string;
    settings?: GameNightSettingsSummary;
    isDefault?: boolean;
  };
  try {
    input = await request.json();
  } catch {
    return noStoreJson({ error: "Invalid template update." }, { status: 400 });
  }
  if (!input.templateId) {
    return noStoreJson({ error: "templateId is required." }, { status: 400 });
  }
  if (input.name !== undefined && !validName(input.name)) {
    return noStoreJson({ error: "Template name is invalid." }, { status: 400 });
  }
  if (input.isDefault !== undefined && typeof input.isDefault !== "boolean") {
    return noStoreJson({ error: "Invalid default-template setting." }, { status: 400 });
  }
  if (input.name === undefined && input.settings === undefined && input.isDefault === undefined) {
    return noStoreJson({ error: "No template changes were supplied." }, { status: 400 });
  }

  try {
    return noStoreJson({
      template: await updateGameNightTemplateForUser({
        templateId: input.templateId,
        userId: authState.user.id,
        name: input.name,
        settings: input.settings ? resolvedSettings(input.settings) : undefined,
        isDefault: input.isDefault,
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
