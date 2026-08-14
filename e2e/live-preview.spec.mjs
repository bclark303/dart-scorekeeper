import { expect, test } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

if (!email) throw new Error("E2E_TEST_EMAIL is required.");
if (!password) throw new Error("E2E_TEST_PASSWORD is required.");
if (!bypassSecret) throw new Error("VERCEL_AUTOMATION_BYPASS_SECRET is required.");

const E2E_LEAGUE = "E2E Live Preview League";
const E2E_SEASON = "E2E Season";
const E2E_NIGHT = "E2E Live Night";
const E2E_DEVICE = "E2E Board 1";
const E2E_PLAYERS = ["E2E Player A", "E2E Player B", "E2E Player C", "E2E Player D"];

async function requestJson(page, path, options = {}) {
  return page.evaluate(
    async ({ requestPath, requestOptions }) => {
      const response = await fetch(requestPath, {
        cache: "no-store",
        method: requestOptions.method ?? "GET",
        headers: requestOptions.body ? { "Content-Type": "application/json" } : undefined,
        body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined,
      });
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { status: response.status, body };
    },
    { requestPath: path, requestOptions: options },
  );
}

async function requireOk(result, label, accepted = [200, 201]) {
  expect(accepted, `${label}: ${JSON.stringify(result.body)}`).toContain(result.status);
  return result.body;
}

async function ensureLeague(page) {
  const listed = await requireOk(await requestJson(page, "/api/leagues"), "list leagues", [200]);
  let league = listed.leagues.find((item) => item.name === E2E_LEAGUE) ?? null;
  if (!league) {
    const created = await requireOk(
      await requestJson(page, "/api/leagues", {
        method: "POST",
        body: { name: E2E_LEAGUE, firstSeasonName: E2E_SEASON },
      }),
      "create E2E league",
      [201],
    );
    league = created.league;
  }
  expect(league?.membershipRole).toBe("owner");
  expect(league?.seasons?.length).toBeGreaterThan(0);
  const season = league.seasons.find((item) => item.name === E2E_SEASON) ?? league.seasons[0];
  return { league, season };
}

async function ensurePlayers(page, league, season) {
  let directory = await requireOk(await requestJson(page, "/api/players"), "list player directory", [200]);
  const leaguePlayers = [];

  for (const displayName of E2E_PLAYERS) {
    let master = directory.players?.find((player) => player.displayName === displayName) ?? null;
    let membership = master?.memberships?.find((item) => item.leagueId === league.id) ?? null;

    if (!membership) {
      const created = await requireOk(
        await requestJson(page, "/api/leagues/players", {
          method: "POST",
          body: master
            ? { leagueId: league.id, playerId: master.playerId }
            : { leagueId: league.id, displayName },
        }),
        `add ${displayName}`,
        [201],
      );
      membership = {
        leaguePlayerId: created.player.id,
        leagueId: league.id,
        leagueName: league.name,
        status: created.player.status,
        seasonIds: created.player.seasonIds,
      };
    }

    if (!membership.seasonIds.includes(season.id)) {
      await requireOk(
        await requestJson(page, "/api/leagues/roster", {
          method: "POST",
          body: {
            leagueId: league.id,
            seasonId: season.id,
            leaguePlayerId: membership.leaguePlayerId,
          },
        }),
        `enroll ${displayName}`,
        [200],
      );
    }
    leaguePlayers.push({ displayName, leaguePlayerId: membership.leaguePlayerId });
    directory = await requireOk(await requestJson(page, "/api/players"), "refresh player directory", [200]);
  }

  return leaguePlayers;
}

async function ensureGameNight(page, league, season) {
  let listed = await requireOk(
    await requestJson(page, `/api/leagues/game-nights?leagueId=${encodeURIComponent(league.id)}`),
    "list game nights",
    [200],
  );
  let night = listed.gameNights.find((item) => item.name === E2E_NIGHT && item.seasonId === season.id) ?? null;

  if (!night) {
    const created = await requireOk(
      await requestJson(page, "/api/leagues/game-nights", {
        method: "POST",
        body: {
          leagueId: league.id,
          seasonId: season.id,
          name: E2E_NIGHT,
          scheduledAt: Date.now(),
          settings: {
            teamCreationMode: "automatic",
            teamCountMode: "manual",
            targetTeamCount: 2,
            teamSizeMode: "manual",
            minTeamPlayers: 2,
            maxTeamPlayers: 2,
            dummyPlayerMode: "none",
            boardCountMode: "manual",
            boardCount: 1,
            boardRotationType: "fixed",
            roundCount: 1,
            pairingStrategy: "round_robin",
            roundAdvanceMode: "manual",
            roundAdvanceDelaySeconds: 0,
            intermissionAfterRounds: [],
            intermissionDurationMinutes: 0,
            legsPerMatch: 1,
            startingScore: 301,
            finishRule: "straight",
          },
        },
      }),
      "create E2E game night",
      [201],
    );
    night = created.gameNight;
  }

  for (const attendance of night.attendance) {
    if (E2E_PLAYERS.includes(attendance.displayName) && attendance.status !== "checked_in") {
      const updated = await requireOk(
        await requestJson(page, "/api/leagues/game-nights", {
          method: "PATCH",
          body: {
            action: "attendance",
            gameNightId: night.id,
            leaguePlayerId: attendance.leaguePlayerId,
            checkedIn: true,
            duesStatus: "paid",
          },
        }),
        `check in ${attendance.displayName}`,
        [200],
      );
      night = updated.gameNight;
    }
  }

  expect(night.attendance.filter((item) => item.status === "checked_in").length).toBeGreaterThanOrEqual(4);

  if (night.teams.length < 2) {
    const updated = await requireOk(
      await requestJson(page, "/api/leagues/game-nights", {
        method: "PATCH",
        body: { action: "prepareTeams", gameNightId: night.id },
      }),
      "prepare teams",
      [200],
    );
    night = updated.gameNight;
  }
  expect(night.teams.length).toBe(2);

  if (!night.pairings.length) {
    const updated = await requireOk(
      await requestJson(page, "/api/leagues/game-nights", {
        method: "PATCH",
        body: { action: "populateBoards", gameNightId: night.id },
      }),
      "populate board fixture",
      [200],
    );
    night = updated.gameNight;
  }
  expect(night.pairings.length).toBeGreaterThan(0);
  expect(night.boards.length).toBeGreaterThan(0);

  if (night.status !== "active") {
    const updated = await requireOk(
      await requestJson(page, "/api/leagues/game-nights", {
        method: "PATCH",
        body: { action: "status", gameNightId: night.id, status: "active" },
      }),
      "start E2E game night",
      [200],
    );
    night = updated.gameNight;
  }
  expect(night.status).toBe("active");
  return night;
}

/**
 * Alpha.12 separates scoring-device identity from board identity. The durable
 * E2E scorer may legitimately migrate as a spare, so explicitly attach it to
 * the physical board used by the active E2E Game Night before pairing it.
 */
async function ensureDevice(page, league, night) {
  expect(night.venueId, "E2E Game Night should have a venue").toBeTruthy();
  const physicalBoardId = night.boards[0]?.physicalBoardId;
  expect(physicalBoardId, "E2E Game Night should use a physical board").toBeTruthy();

  let hardware = await requireOk(
    await requestJson(
      page,
      `/api/leagues/board-devices?leagueId=${encodeURIComponent(league.id)}&venueId=${encodeURIComponent(night.venueId)}`,
    ),
    "list venue hardware",
    [200],
  );
  const physicalBoard = hardware.boards?.find((item) => item.id === physicalBoardId) ?? null;
  expect(physicalBoard, "E2E physical board should be present in Venue Hardware").toBeTruthy();

  let device = hardware.devices?.find((item) => item.name === E2E_DEVICE) ?? null;
  if (!device) {
    const created = await requireOk(
      await requestJson(page, "/api/leagues/board-devices", {
        method: "POST",
        body: {
          action: "device",
          leagueId: league.id,
          venueId: night.venueId,
          name: E2E_DEVICE,
          physicalBoardId,
        },
      }),
      "register E2E scoring device",
      [201],
    );
    device = created.device;
  } else if (device.physicalBoardId !== physicalBoardId) {
    const updated = await requireOk(
      await requestJson(page, "/api/leagues/board-devices", {
        method: "PATCH",
        body: {
          action: "update",
          deviceId: device.id,
          physicalBoardId,
        },
      }),
      "assign E2E scoring device to physical board",
      [200],
    );
    device = updated.device;
  }

  hardware = await requireOk(
    await requestJson(
      page,
      `/api/leagues/board-devices?leagueId=${encodeURIComponent(league.id)}&venueId=${encodeURIComponent(night.venueId)}`,
    ),
    "verify venue hardware assignment",
    [200],
  );
  device = hardware.devices?.find((item) => item.id === device.id) ?? device;
  expect(device.physicalBoardId).toBe(physicalBoardId);
  expect(device.boardNumber).toBe(physicalBoard.boardNumber);
  return device;
}

test("alpha.12 live preview supports venue hardware, pairing, and scoring", async ({ page, browser }) => {
  const pageErrors = [];
  const serverErrors = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500 && response.url().includes("vercel.app")) {
      serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  const homeResponse = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(homeResponse?.status()).toBeLessThan(400);
  await expect(page.getByRole("heading", { name: "How are you playing?" })).toBeVisible();

  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
  const form = page.locator("form").first();
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Signed in", { exact: true })).toBeVisible({ timeout: 30_000 });

  const { league, season } = await ensureLeague(page);
  await ensurePlayers(page, league, season);
  const night = await ensureGameNight(page, league, season);
  const device = await ensureDevice(page, league, night);
  console.log(`LIVE_E2E league=${league.id} season=${season.id} night=${night.id} device=${device.id} physicalBoard=${device.physicalBoardId}`);

  const routes = [
    ["/league-play", "League Play"],
    ["/league-roster", "Player Directory"],
    ["/game-nights/check-in", "Player Check-in"],
    ["/game-nights/control", "Game Night Control"],
    ["/game-nights/fixtures", "Fixture & Round Control"],
    ["/league-devices", "Venue Hardware"],
  ];
  for (const [path, marker] of routes) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${path} should not return an HTTP error`).toBeLessThan(400);
    await expect(page.getByText(marker, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Sign in before|Sign in to open/i)).toHaveCount(0);
  }

  const pairing = await requireOk(
    await requestJson(page, "/api/leagues/board-devices/pairing", {
      method: "POST",
      body: { deviceId: device.id },
    }),
    "create board pairing code",
    [200],
  );
  expect(pairing.code).toMatch(/^\d{6}$/);

  const deviceContext = await browser.newContext({
    extraHTTPHeaders: {
      "x-vercel-protection-bypass": bypassSecret,
      "x-vercel-set-bypass-cookie": "true",
    },
  });
  const devicePage = await deviceContext.newPage();
  const deviceErrors = [];
  devicePage.on("pageerror", (error) => deviceErrors.push(error.message));

  await devicePage.goto(`/board-device#pair=${pairing.code}`, { waitUntil: "domcontentloaded" });
  await expect(devicePage.getByText("ONLINE", { exact: true })).toBeVisible({ timeout: 30_000 });

  const startButton = devicePage.getByRole("button", { name: "Start Board Match" });
  if (await startButton.isVisible().catch(() => false)) {
    await expect(startButton).toBeEnabled();
    await startButton.click();
  }

  await expect(devicePage.getByText("Current thrower", { exact: false })).toBeVisible({ timeout: 30_000 });
  await devicePage.getByRole("button", { name: "Turn", exact: true }).click();
  const scoreInput = devicePage.getByPlaceholder("Turn score");
  await scoreInput.fill("60");
  await devicePage.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(devicePage.getByText(/60 · 3 darts/).first()).toBeVisible({ timeout: 30_000 });

  expect(deviceErrors, `Device page errors:\n${deviceErrors.join("\n")}`).toEqual([]);
  await deviceContext.close();

  expect(pageErrors, `Browser page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(serverErrors, `Server 5xx responses:\n${serverErrors.join("\n")}`).toEqual([]);
});