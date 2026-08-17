import { expect, test } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

if (!email) throw new Error("E2E_TEST_EMAIL is required.");
if (!password) throw new Error("E2E_TEST_PASSWORD is required.");

const E2E_LEAGUE = "E2E Live Preview League";
const E2E_NIGHT = "E2E Live Night";
const E2E_PLAYER = "E2E Player A";
const E2E_DEVICE = "E2E Board 1";

async function requestJson(page, path) {
  return page.evaluate(async (requestPath) => {
    const response = await fetch(requestPath, { cache: "no-store" });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body };
  }, path);
}

async function signIn(page) {
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  const form = page.locator("form").first();
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Signed in", { exact: true })).toBeVisible({ timeout: 30_000 });
}

test("alpha.17 entity bubbles and names drill into the represented object", async ({ page }) => {
  const pageErrors = [];
  const serverErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500 && response.url().includes("vercel.app")) {
      serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  await signIn(page);

  const leaguesResult = await requestJson(page, "/api/leagues");
  expect(leaguesResult.status).toBe(200);
  const league = leaguesResult.body.leagues.find((item) => item.name === E2E_LEAGUE);
  expect(league, `${E2E_LEAGUE} should exist`).toBeTruthy();

  const nightsResult = await requestJson(
    page,
    `/api/leagues/game-nights?leagueId=${encodeURIComponent(league.id)}`,
  );
  expect(nightsResult.status).toBe(200);
  const night = nightsResult.body.gameNights.find((item) => item.name === E2E_NIGHT);
  expect(night, `${E2E_NIGHT} should exist`).toBeTruthy();
  expect(night.venueId).toBeTruthy();
  expect(night.boards?.length).toBeGreaterThan(0);

  const playersResult = await requestJson(page, "/api/players");
  expect(playersResult.status).toBe(200);
  const player = playersResult.body.players.find((item) => item.displayName === E2E_PLAYER);
  expect(player, `${E2E_PLAYER} should exist`).toBeTruthy();

  const hardwareResult = await requestJson(
    page,
    `/api/leagues/board-devices?leagueId=${encodeURIComponent(league.id)}&venueId=${encodeURIComponent(night.venueId)}`,
  );
  expect(hardwareResult.status).toBe(200);
  const logicalBoard = night.boards[0];
  const physicalBoard = hardwareResult.body.boards.find(
    (item) => item.id === logicalBoard.physicalBoardId,
  );
  expect(physicalBoard, "The active Game Night physical board should exist").toBeTruthy();
  const device =
    hardwareResult.body.devices.find((item) => item.name === E2E_DEVICE) ??
    hardwareResult.body.devices.find((item) => item.physicalBoardId === physicalBoard.id);
  expect(device, "The active board should have an E2E scorer").toBeTruthy();

  // League Administration: the status bubbles are navigation, not decoration.
  await page.goto("/league-play", { waitUntil: "domcontentloaded" });
  const changeLeague = page.getByLabel("Change league");
  if (await changeLeague.isVisible().catch(() => false)) {
    await changeLeague.selectOption(league.id);
  }
  await expect(page.getByRole("heading", { name: E2E_NIGHT })).toBeVisible();

  const checkedInLink = page.getByRole("link", { name: /checked in →/i });
  await expect(checkedInLink).toHaveAttribute("href", "/game-nights/check-in");
  const boardsLink = page.getByRole("link", { name: /dartboards? →/i });
  await expect(boardsLink).toHaveAttribute("href", "/game-nights/boards");

  await boardsLink.click();
  await expect(page).toHaveURL(/\/game-nights\/boards$/);
  await page.goto("/league-play", { waitUntil: "domcontentloaded" });
  const refreshedChangeLeague = page.getByLabel("Change league");
  if (await refreshedChangeLeague.isVisible().catch(() => false)) {
    await refreshedChangeLeague.selectOption(league.id);
  }
  await page.getByRole("link", { name: /checked in →/i }).click();
  await expect(page).toHaveURL(/\/game-nights\/check-in$/);
  await expect(page.getByRole("heading", { name: "Player Check-in" })).toBeVisible();

  // Check-in uses the remembered Game Night context. A represented player should
  // still drill directly into the master profile.
  const playerLink = page.getByRole("link", { name: E2E_PLAYER, exact: true }).first();
  await expect(playerLink).toHaveAttribute(
    "href",
    `/players/${encodeURIComponent(player.playerId)}`,
  );
  await playerLink.click();
  await expect(page).toHaveURL(new RegExp(`/players/${player.playerId}$`));
  await expect(page.getByRole("heading", { name: E2E_PLAYER, exact: true })).toBeVisible();

  // Control also uses the remembered current Game Night. A board name represents
  // the live assignment/match; its status badge represents the physical board;
  // the scorer bubble represents the device.
  await page.goto("/game-nights/control", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: E2E_NIGHT, exact: true })).toBeVisible();
  const healthHeading = page.getByRole("heading", { name: "Board & scorer health" });
  await expect(healthHeading).toBeVisible();
  const healthSection = page.locator("section").filter({ has: healthHeading });

  const currentRoundNumber = night.activeRoundNumber ?? night.currentRoundNumber ?? 1;
  const currentPairing =
    night.pairings.find(
      (pairing) => pairing.boardId === logicalBoard.id && pairing.matchStatus === "active",
    ) ??
    night.pairings.find(
      (pairing) =>
        pairing.boardId === logicalBoard.id &&
        pairing.roundNumber === currentRoundNumber &&
        pairing.matchStatus !== "completed",
    );

  const boardNameLink = healthSection.getByRole("link", {
    name: physicalBoard.name,
    exact: true,
  }).first();
  await expect(boardNameLink).toBeVisible();
  const boardNameHref = await boardNameLink.getAttribute("href");
  if (currentPairing?.matchSessionId) {
    expect(boardNameHref).toBe(`/league-match/${encodeURIComponent(currentPairing.matchSessionId)}`);
  } else {
    expect(boardNameHref).toContain(`boardId=${encodeURIComponent(physicalBoard.id)}`);
  }

  const boardStatusLink = healthSection.getByRole("link", {
    name: physicalBoard.status === "active" ? "Board available" : "Board out of service",
    exact: true,
  }).first();
  await expect(boardStatusLink).toHaveAttribute(
    "href",
    new RegExp(`boardId=${physicalBoard.id}`),
  );

  const escapedDeviceName = device.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const deviceLink = healthSection.getByRole("link", {
    name: new RegExp(`^${escapedDeviceName} · `),
  }).first();
  await expect(deviceLink).toBeVisible();
  const deviceHref = await deviceLink.getAttribute("href");
  expect(deviceHref).toContain(`deviceId=${encodeURIComponent(device.id)}`);

  await deviceLink.click();
  await expect(page).toHaveURL(/\/league-devices\?/);
  expect(new URL(page.url()).searchParams.get("deviceId")).toBe(device.id);
  const focusedDevice = page.locator(`[id="device-${device.id}"]`);
  await expect(focusedDevice).toBeVisible();
  await expect(focusedDevice).toHaveClass(/ring-2/);

  expect(pageErrors, `Browser page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(serverErrors, `Server 5xx responses:\n${serverErrors.join("\n")}`).toEqual([]);
});