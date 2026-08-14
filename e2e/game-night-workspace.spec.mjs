import { expect, test } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

if (!email) throw new Error("E2E_TEST_EMAIL is required.");
if (!password) throw new Error("E2E_TEST_PASSWORD is required.");

test("Game Night workspace is split into focused screens", async ({ page }) => {
  const pageErrors = [];
  const serverErrors = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500 && response.url().includes("vercel.app")) {
      serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  await page.goto("/account", { waitUntil: "domcontentloaded" });
  const form = page.locator("form").first();
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Signed in", { exact: true })).toBeVisible({ timeout: 30_000 });

  const routes = [
    ["/game-nights", "Manage this Game Night"],
    ["/game-nights/control", "Game Night Control"],
    ["/game-nights/setup", "Setup & Rules"],
    ["/game-nights/check-in", "Player Check-in"],
    ["/game-nights/teams", "Teams"],
    ["/game-nights/boards", "Boards"],
    ["/game-nights/fixtures", "Fixture & Round Control"],
    ["/game-nights/stats", "Stats & Highlights"],
  ];

  for (const [path, marker] of routes) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${path} should not return an HTTP error`).toBeLessThan(400);
    await expect(page.getByText(marker, { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("navigation", { name: "Game Night sections" })).toBeVisible();
  }

  await page.goto("/game-nights", { waitUntil: "domcontentloaded" });
  const selectedNight = page.getByLabel("Game Night", { exact: true });
  await expect(selectedNight).not.toHaveValue("");
  const selectedNightValue = await selectedNight.inputValue();

  await page.getByRole("link", { name: /Open Teams/i }).first().click();
  await expect(page).toHaveURL(/\/game-nights\/teams/);
  const teamsNightSelector = page.getByLabel("Game Night", { exact: true });
  await expect(teamsNightSelector).toHaveValue(selectedNightValue);

  expect(pageErrors, `Browser page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(serverErrors, `Server 5xx responses:\n${serverErrors.join("\n")}`).toEqual([]);
});
