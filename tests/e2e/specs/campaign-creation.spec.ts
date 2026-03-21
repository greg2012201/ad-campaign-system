import { test, expect } from "@playwright/test";
import {
  createTestCampaign,
  formatDateForInput,
} from "../fixtures/test-campaign.js";

const API_URL = process.env["E2E_API_URL"] || "http://localhost:3100";

test.describe("campaign creation", () => {
  test("creates a campaign via the UI form and verifies it appears in the table", async ({
    page,
  }) => {
    const campaignData = createTestCampaign({ name: "UI Creation Test" });

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Campaign System Admin" }),
    ).toBeVisible();

    await page.getByLabel("Name").fill(campaignData.name);
    await page
      .getByLabel("Start At")
      .fill(formatDateForInput(campaignData.startAt));
    await page
      .getByLabel("Expire At")
      .fill(formatDateForInput(campaignData.expireAt));

    await page.getByPlaceholder("Asset URL").fill(campaignData.assets[0]!.url);

    await page.getByRole("button", { name: "Create Campaign" }).click();

    await expect(page.getByText("Campaign created successfully")).toBeVisible({
      timeout: 10000,
    });

    await expect(
      page.getByRole("cell", { name: campaignData.name }),
    ).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole("cell", { name: "draft" })).toBeVisible();
  });

  test("creates a campaign via the UI and verifies it via the API", async ({
    page,
    request,
  }) => {
    const campaignData = createTestCampaign({ name: "API Verify Test" });

    await page.goto("/");

    await page.getByLabel("Name").fill(campaignData.name);
    await page
      .getByLabel("Start At")
      .fill(formatDateForInput(campaignData.startAt));
    await page
      .getByLabel("Expire At")
      .fill(formatDateForInput(campaignData.expireAt));

    await page.getByPlaceholder("Asset URL").fill(campaignData.assets[0]!.url);

    await page.getByRole("button", { name: "Create Campaign" }).click();

    await expect(page.getByText("Campaign created successfully")).toBeVisible({
      timeout: 10000,
    });

    const listResponse = await request.get(`${API_URL}/campaigns`);
    expect(listResponse.ok()).toBeTruthy();

    const listBody = await listResponse.json();
    const created = listBody.data.find(
      (c: Record<string, unknown>) => c.name === campaignData.name,
    );

    expect(created).toBeTruthy();
    expect(created.status).toBe("draft");
    expect(created.assets).toHaveLength(1);
    expect(created.assets[0].assetType).toBe("image");
    expect(created.assets[0].url).toBe(campaignData.assets[0]!.url);
  });

  test("creates a campaign with multiple assets", async ({
    page,
    request,
  }) => {
    const campaignName = `Multi-Asset Test ${Date.now()}`;
    const campaignData = createTestCampaign({ name: campaignName });

    await page.goto("/");

    await page.getByLabel("Name").fill(campaignData.name);
    await page
      .getByLabel("Start At")
      .fill(formatDateForInput(campaignData.startAt));
    await page
      .getByLabel("Expire At")
      .fill(formatDateForInput(campaignData.expireAt));

    await page.getByPlaceholder("Asset URL").fill(campaignData.assets[0]!.url);

    await page.getByRole("button", { name: "Add Asset" }).click();

    const urlInputs = page.getByPlaceholder("Asset URL");
    await urlInputs.nth(1).fill("https://example.com/video.mp4");

    const selects = page.locator("select");
    await selects.nth(1).selectOption("video");

    await page.getByRole("button", { name: "Create Campaign" }).click();

    await expect(page.getByText("Campaign created successfully")).toBeVisible({
      timeout: 10000,
    });

    const listResponse = await request.get(`${API_URL}/campaigns`);
    const listBody = await listResponse.json();
    const created = listBody.data.find(
      (c: Record<string, unknown>) => c.name === campaignData.name,
    );

    expect(created).toBeTruthy();
    expect(created.assets).toHaveLength(2);
    expect(created.assets.map((a: Record<string, string>) => a.assetType).sort()).toEqual([
      "image",
      "video",
    ]);
  });

  test("validates required fields on submit", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Create Campaign" }).click();

    await expect(page.getByText("Name is required")).toBeVisible();
  });

  test("creates a campaign directly via the API", async ({ request }) => {
    const campaignData = createTestCampaign({ name: "Direct API Test" });

    const createResponse = await request.post(`${API_URL}/campaigns`, {
      data: campaignData,
    });
    expect(createResponse.status()).toBe(201);

    const created = await createResponse.json();
    expect(created.name).toBe(campaignData.name);
    expect(created.status).toBe("draft");
    expect(created.idempotencyKey).toBe(campaignData.idempotencyKey);
    expect(created.assets).toHaveLength(campaignData.assets.length);

    const getResponse = await request.get(
      `${API_URL}/campaigns/${created.id}`,
    );
    expect(getResponse.ok()).toBeTruthy();

    const fetched = await getResponse.json();
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe(campaignData.name);
  });

  test("enforces idempotency on duplicate campaign creation", async ({
    request,
  }) => {
    const campaignData = createTestCampaign({ name: "Idempotency Test" });

    const first = await request.post(`${API_URL}/campaigns`, {
      data: campaignData,
    });
    expect(first.status()).toBe(201);
    const firstBody = await first.json();

    const second = await request.post(`${API_URL}/campaigns`, {
      data: campaignData,
    });
    const secondBody = await second.json();

    expect(secondBody.id).toBe(firstBody.id);
  });
});
