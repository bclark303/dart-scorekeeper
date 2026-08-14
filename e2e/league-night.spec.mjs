import { expect, test } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL?.trim();
const password = process.env.E2E_TEST_PASSWORD ?? "";
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const allowSignup = process.env.E2E_ALLOW_SIGNUP === "true";
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();

if (!email || !password) {
  throw new Error("E2E_TEST_EMAIL and E2E_TEST_PASSWORD are required.");
}

const bypassHeaders = bypassSecret
  ? {
      "x-vercel-protection-bypass": bypassSecret,
      "x-vercel-set-bypass-cookie": "true",
    }
  : undefined;

async function authenticate(page) {
  await page.goto("/account");

  if (await page.getByRole("button", { name: "Sign out" }).isVisible().catch(() => false)) {
    return;
  }

  const form = page.locator("form");
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Sign in", exact: true }).click();

  try {
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible({ timeout: 6_000 });
    return;
  } catch {
    if (!allowSignup) {
      throw new Error("The configured E2E account could not sign in.");
    }
  }

  await page.getByRole("button", { name: "Create account", exact: true }).first().click();
  await form.getByLabel("Name").fill("TEST E2E Admin");
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

async function createLeague(page, leagueName, seasonName) {
  await page.goto("/leagues");
  await page.getByLabel("League name").fill(leagueName);
  await page.getByLabel("First season").fill(seasonName);
  await page.getByRole("button", { name: "Create league", exact: true }).click();
  await expect(page.getByText(`${leagueName} created.`, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: leagueName, exact: true })).toBeVisible();
}

async function createAndRosterPlayer(page, leagueName, seasonName, playerName) {
  await page.goto("/league-roster");
  await page.getByLabel("Manage membership for").selectOption({ label: leagueName });
  const search = page.getByLabel("Search all players");
  await search.fill(playerName);

  const createButton = page.getByRole("button", {
    name: new RegExp(`^Create .* and add to ${leagueName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
  });
  await expect(createButton).toBeVisible();
  await createButton.click();

  await search.fill(playerName);
  const card = page.locator("article").filter({ hasText: playerName }).first();
  await expect(card.getByRole("heading", { name: playerName, exact: true })).toBeVisible();

  const seasonButton = card.getByRole("button").filter({ hasText: seasonName });
  await expect(seasonButton).toContainText("Not on roster");
  await seasonButton.click();
  await expect(seasonButton).toContainText("On roster");
}

async function addExistingPlayerToLeague(page, leagueName, seasonName, playerName) {
  await page.goto("/league-roster");
  await page.getByLabel("Manage membership for").selectOption({ label: leagueName });
  const search = page.getByLabel("Search all players");
  await search.fill(playerName);
  let card = page.locator("article").filter({ hasText: playerName }).first();
  await card.getByRole("button", { name: `Add to ${leagueName}`, exact: true }).click();

  await search.fill(playerName);
  card = page.locator("article").filter({ hasText: playerName }).first();
  await expect(card.getByText(leagueName, { exact: true }).first()).toBeVisible();
  const seasonButton = card.getByRole("button").filter({ hasText: seasonName });
  await expect(seasonButton).toContainText("Not on roster");
  await seasonButton.click();
  await expect(seasonButton).toContainText("On roster");
}

async function getLeagueAndNight(page, leagueName, seasonName, nightName) {
  const leaguesResponse = await page.request.get("/api/leagues");
  expect(leaguesResponse.ok()).toBeTruthy();
  const leaguesPayload = await leaguesResponse.json();
  const league = leaguesPayload.leagues.find((item) => item.name === leagueName);
  expect(league, `League ${leagueName} should exist`).toBeTruthy();
  const season = league.seasons.find((item) => item.name === seasonName);
  expect(season, `Season ${seasonName} should exist`).toBeTruthy();

  const nightsResponse = await page.request.get(
    `/api/leagues/game-nights?leagueId=${encodeURIComponent(league.id)}`,
  );
  expect(nightsResponse.ok()).toBeTruthy();
  const nightsPayload = await nightsResponse.json();
  const night = nightsPayload.gameNights.find((item) => item.name === nightName);
  expect(night, `Game Night ${nightName} should exist`).toBeTruthy();
  return { league, season, night };
}

async function configureFastMatch(page, gameNightId) {
  const response = await page.request.patch("/api/leagues/game-nights", {
    data: {
      action: "settings",
      gameNightId,
      settings: {
        teamCreationMode: "hybrid",
        teamCountMode: "manual",
        targetTeamCount: 2,
        teamSizeMode: "manual",
        minTeamPlayers: 1,
        maxTeamPlayers: 1,
        dummyPlayerMode: "none",
        dummyScore: 0,
        boardCountMode: "manual",
        boardCount: 1,
        boardRotationType: "fixed",
        roundCount: 1,
        pairingStrategy: "random",
        roundAdvanceMode: "manual",
        roundAdvanceDelaySeconds: 0,
        intermissionAfterRounds: [],
        intermissionDurationMinutes: 0,
        legsPerMatch: 1,
        startingScore: 301,
        finishRule: "straight",
      },
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function checkInPlayer(page, playerName, dues = "paid") {
  const name = page.getByText(playerName, { exact: true });
  const row = name.locator("..").locator("..");
  const button = row.getByRole("button");
  if (await button.filter({ hasText: "Check In" }).isVisible().catch(() => false)) {
    await button.filter({ hasText: "Check In" }).click();
  }
  await expect(row.getByRole("button").filter({ hasText: "Checked In" })).toBeVisible();
  await row.locator("select").selectOption(dues);
  await expect(row.locator("select")).toHaveValue(dues);
}

test("league creation, player reuse, check-in, device pairing, game control and scoring", async ({
  page,
  browser,
}, testInfo) => {
  const runId = process.env.GITHUB_RUN_ID ?? String(Date.now());
  const suffix = `${runId}-${testInfo.retry}`;
  const leagueA = `TEST E2E Men ${suffix}`;
  const leagueB = `TEST E2E Mixed ${suffix}`;
  const seasonA = `TEST Season Men ${suffix}`;
  const seasonB = `TEST Season Mixed ${suffix}`;
  const playerJohn = `TEST John ${suffix}`;
  const playerMary = `TEST Mary ${suffix}`;
  const nightName = `TEST League Night ${suffix}`;
  const deviceName = `TEST Board 1 ${suffix}`;

  await authenticate(page);

  await createLeague(page, leagueA, seasonA);
  await createLeague(page, leagueB, seasonB);

  await createAndRosterPlayer(page, leagueA, seasonA, playerJohn);
  await createAndRosterPlayer(page, leagueA, seasonA, playerMary);
  await addExistingPlayerToLeague(page, leagueB, seasonB, playerJohn);

  await page.goto("/league-roster");
  await page.getByLabel("Manage membership for").selectOption({ label: leagueB });
  await page.getByLabel("Search all players").fill(playerJohn);
  const johnCard = page.locator("article").filter({ hasText: playerJohn }).first();
  await expect(johnCard.getByText(leagueA, { exact: true })).toBeVisible();
  await expect(johnCard.getByText(leagueB, { exact: true })).toBeVisible();

  await page.goto("/game-nights");
  await page.getByLabel("League").selectOption({ label: leagueA });
  const scheduleSection = page.locator("section").filter({ hasText: "Schedule a Game Night" }).first();
  await scheduleSection.getByPlaceholder("League Night").fill(nightName);
  await scheduleSection.locator("select").selectOption({ label: seasonA });
  const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
  await scheduleSection.locator('input[type="datetime-local"]').fill(scheduledAt);
  await scheduleSection.getByRole("button", { name: "Create Game Night", exact: true }).click();
  await expect(page.locator("aside button").filter({ hasText: nightName })).toBeVisible();

  const { night } = await getLeagueAndNight(page, leagueA, seasonA, nightName);
  await configureFastMatch(page, night.id);

  await page.goto("/game-nights/check-in");
  await page.getByLabel("League").selectOption({ label: leagueA });
  await page.getByLabel("Game Night").selectOption({ label: new RegExp(nightName) });
  await checkInPlayer(page, playerJohn, "paid");
  await checkInPlayer(page, playerMary, "paid");
  await expect(page.getByText("2 / 2 checked in", { exact: true })).toBeVisible();

  await page.goto("/game-nights");
  await page.getByLabel("League").selectOption({ label: leagueA });
  await page.locator("aside button").filter({ hasText: nightName }).click();
  await page.getByRole("button", { name: "Prepare Teams", exact: true }).click();
  await expect(page.getByText("Teams prepared from the checked-in player list.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Populate Boards", exact: true }).click();
  await expect(page.getByText("Boards populated and central match sessions created for round one.", { exact: true })).toBeVisible();

  await page.goto("/league-devices");
  await page.getByLabel("League").selectOption({ label: leagueA });
  await page.getByPlaceholder("Board 1 Scorer").fill(deviceName);
  await page.getByLabel("Board number").fill("1");
  await page.getByRole("button", { name: "Add & Pair Device", exact: true }).click();
  const pairingSection = page.locator("section").filter({ hasText: `Pair ${deviceName}` }).first();
  await expect(pairingSection).toBeVisible();
  const pairingCode = (await pairingSection.locator("div").filter({ hasText: /^\d{6}$/ }).first().textContent())?.trim();
  expect(pairingCode).toMatch(/^\d{6}$/);

  const deviceContext = await browser.newContext({
    baseURL,
    extraHTTPHeaders: bypassHeaders,
  });
  const devicePage = await deviceContext.newPage();
  try {
    await devicePage.goto(`/board-device#pair=${pairingCode}`);
    await expect(devicePage.getByRole("heading", { name: deviceName, exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(devicePage.getByText(leagueA, { exact: false }).first()).toBeVisible();
    await expect(devicePage.getByRole("button", { name: /League Play/ }).first()).toBeVisible();
    await expect(devicePage.getByText("League Setup", { exact: true })).toHaveCount(0);

    await page.goto("/game-nights");
    await page.getByLabel("League").selectOption({ label: leagueA });
    await page.locator("aside button").filter({ hasText: nightName }).click();
    await page.getByRole("button", { name: "Start Game Night", exact: true }).click();
    await expect(page.getByText("Game night started. Board scorers can now start their assigned matches.", { exact: true })).toBeVisible();

    await devicePage.reload();
    const startMatch = devicePage.getByRole("button", { name: "Start Board Match", exact: true });
    await expect(startMatch).toBeVisible({ timeout: 25_000 });
    await startMatch.click();
    await devicePage.getByRole("button", { name: "Turn", exact: true }).click();

    const score = devicePage.getByPlaceholder("Turn score");
    const submit = devicePage.getByRole("button", { name: "Submit", exact: true });

    await score.fill("180");
    await submit.click();
    await expect(devicePage.getByRole("button", { name: "Undo Last Turn", exact: true })).toBeEnabled();
    await devicePage.getByRole("button", { name: "Undo Last Turn", exact: true }).click();
    await expect(devicePage.getByText("Last turn undone. Match state recalculated from central history.", { exact: true })).toBeVisible();

    await score.fill("180");
    await submit.click();
    await score.fill("0");
    await submit.click();
    await score.fill("121");
    await submit.click();

    await expect(devicePage.getByRole("heading", { name: "Match complete", exact: true })).toBeVisible({ timeout: 20_000 });

    const refreshed = await page.request.get(`/api/leagues/game-nights?gameNightId=${encodeURIComponent(night.id)}`);
    expect(refreshed.ok()).toBeTruthy();
    const refreshedPayload = await refreshed.json();
    expect(refreshedPayload.gameNight.pairings[0].matchStatus).toBe("completed");

    await page.goto("/game-nights/control");
    await expect(page.getByText(nightName, { exact: false }).first()).toBeVisible();
  } finally {
    await deviceContext.close();
  }
});
