import { test, expect } from "@playwright/test";

const API_URL = process.env["E2E_API_URL"] || "http://localhost:3100";

test.describe("smoke tests", () => {
  test("admin UI loads and displays heading", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Campaign System Admin");
    await expect(
      page.getByRole("heading", { name: "Campaign System Admin" }),
    ).toBeVisible();
  });

  test("backend API responds to campaigns endpoint", async ({ request }) => {
    const response = await request.get(`${API_URL}/campaigns`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("offset");
    expect(body).toHaveProperty("limit");
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test("backend returns 404 for non-existent campaign", async ({
    request,
  }) => {
    const response = await request.get(
      `${API_URL}/campaigns/00000000-0000-0000-0000-000000000000`,
    );
    expect(response.status()).toBe(404);
  });
});
