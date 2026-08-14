import { expect, test } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

if (!email) throw new Error("E2E_TEST_EMAIL is required.");
if (!password) throw new Error("E2E_TEST_PASSWORD is required.");

async function fetchJson(page, path) {
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

test("alpha.5 live preview supports the authenticated league workflow", async ({ page }) => {
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
  await expect(page.getByRole("heading", { name: "Casual Play" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "League Play" })).toBeVisible();

  const accountResponse = await page.goto("/account", { waitUntil: "domcontentloaded" });
  expect(accountResponse?.status()).toBeLessThan(400);
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();

  const form = page.locator("form").first();
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Signed in", { exact: true })).toBeVisible({ timeout: 30_000 });

  const leaguesResult = await fetchJson(page, "/api/leagues");
  expect(leaguesResult.status).toBe(200);
  expect(Array.isArray(leaguesResult.body?.leagues)).toBe(true);
  expect(leaguesResult.body.leagues.length).toBeGreaterThan(0);

  const league = leaguesResult.body.leagues[0];
  console.log(`LIVE_E2E league=${league.name} id=${league.id} role=${league.membershipRole}`);

  const routes = [
    ["/league-play", "League Play"],
    ["/league-roster", "Player Directory"],
    ["/game-nights/check-in", "Player Check-in"],
    ["/game-nights/control", "Game Night Control"],
    ["/game-nights/fixtures", "Fixture & Round Control"],
    ["/league-devices", "Board Devices"],
  ];

  for (const [path, marker] of routes) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${path} should not return an HTTP error`).toBeLessThan(400);
    await expect(page.getByText(marker, { exact: false }).first(), `${path} should render ${marker}`).toBeVisible();
    await expect(page.getByText(/Sign in before|Sign in to open/i)).toHaveCount(0);
  }

  const gameNightsResult = await fetchJson(
    page,
    `/api/leagues/game-nights?leagueId=${encodeURIComponent(league.id)}`,
  );
  expect(gameNightsResult.status).toBe(200);
  expect(Array.isArray(gameNightsResult.body?.gameNights)).toBe(true);

  const devicesResult = await fetchJson(
    page,
    `/api/leagues/board-devices?leagueId=${encodeURIComponent(league.id)}`,
  );
  expect(devicesResult.status).toBe(200);
  expect(Array.isArray(devicesResult.body?.devices)).toBe(true);

  console.log(
    `LIVE_E2E state gameNights=${gameNightsResult.body.gameNights.length} devices=${devicesResult.body.devices.length}`,
  );

  expect(pageErrors, `Browser page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(serverErrors, `Server 5xx responses:\n${serverErrors.join("\n")}`).toEqual([]);
});
