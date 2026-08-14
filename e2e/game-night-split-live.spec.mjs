import { expect, test } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

if (!email) throw new Error("E2E_TEST_EMAIL is required.");
if (!password) throw new Error("E2E_TEST_PASSWORD is required.");

async function signIn(page) {
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  const form = page.locator("form").first();
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Signed in", { exact: true })).toBeVisible({ timeout: 30_000 });
}

test("Game Night mega-page is split into focused live workspaces", async ({ page }) => {
  const pageErrors = [];
  const serverErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500 && response.url().includes("vercel.app")) {
      serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  await signIn(page);

  const routes = [
    ["/game-nights", "Game Night Hub", "Hub"],
    ["/game-nights/control", "Control Room", "Game Night Control"],
    ["/game-nights/setup", "Setup & Rules", "Setup & Rules"],
    ["/game-nights/check-in", "Player Check-in", "Check-in"],
    ["/game-nights/teams", "Teams", "Teams"],
    ["/game-nights/boards", "Boards", "Boards"],
    ["/game-nights/fixtures", "Fixture & Round Control", "Fixtures & Rounds"],
    ["/game-nights/stats", "Stats & Highlights", "Stats"],
  ];

  for (const [path, marker, navLabel] of routes) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${path} should load`).toBeLessThan(400);
    await expect(page.getByText(marker, { exact: false }).first()).toBeVisible({ timeout: 30_000 });

    const nav = page.getByRole("navigation", { name: "Game Night sections" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: navLabel, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await expect(page.getByText(/Sign in before|Sign in through Connected Storage/i)).toHaveCount(0);
  }

  await page.goto("/game-nights", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Game Night Hub", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scheduled Nights", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Control Room/i })).toBeVisible();

  await page.getByRole("link", { name: /Open Control Room/i }).click();
  await expect(page).toHaveURL(/\/game-nights\/control/);
  await expect(page.getByText("Control Room", { exact: false }).first()).toBeVisible();

  expect(pageErrors, `Browser page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(serverErrors, `Server 5xx responses:\n${serverErrors.join("\n")}`).toEqual([]);
});
