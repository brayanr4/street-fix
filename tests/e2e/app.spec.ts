import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import path from "path";

const PHOTO = path.join(__dirname, "fixtures", "pothole.jpg");
const KEY = "street-fix-reports-v1";

async function noSeriousA11yIssues(page: Page) {
  const { violations } = await new AxeBuilder({ page: page as never }).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function noSideways(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function fillDetails(page: Page, title: string, address: string) {
  await page.getByPlaceholder("e.g. Deep pothole").fill(title);
  await page.getByPlaceholder("What's wrong").fill("Clearly visible problem that needs fixing.");
  await page.getByPlaceholder("Street address").fill(address);
}

async function forceOverdue(page: Page) {
  await page.evaluate((key) => {
    const r = JSON.parse(localStorage.getItem(key) ?? "[]");
    r[0].nextCheckAt = "2026-01-01T00:00:00Z";
    localStorage.setItem(key, JSON.stringify(r));
  }, KEY);
  await page.reload();
}

// Stands in for the address and council lookup so tests don't depend on outside services.
async function mockPlace(page: Page, place: { address: string; councilId: string | null; outsideArea: string | null }) {
  await page.route("**/api/place", (route) => route.fulfill({ json: place }));
}

// These tests cover sending by hand. Sending by email is covered in autopilot.spec.ts.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/config", (route) => route.fulfill({ json: { autoSend: false } }));
});

test.describe("with location", () => {
  test.use({ geolocation: { latitude: -34.9285, longitude: 138.6007 }, permissions: ["geolocation"] });

  test.beforeEach(async ({ page }) => {
    await mockPlace(page, { address: "", councilId: "adelaide", outsideArea: null });
  });

  test("detects the council and address from the phone's location", async ({ page }) => {
    await mockPlace(page, { address: "12 Unley Road, Unley, 5061", councilId: "unley", outsideArea: null });
    await page.goto("/");
    await page.getByRole("button", { name: /Report a problem/ }).click();
    await page.locator("input[type=file]").setInputFiles(PHOTO);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByLabel("Council area")).toHaveValue("unley");
    await expect(page.getByText("Found from your location.")).toBeVisible();
    await expect(page.getByPlaceholder("Street address")).toHaveValue("12 Unley Road, Unley, 5061");
    await expect(page.getByText("City of Unley", { exact: true }).last()).toBeVisible();
    // Choosing a different council by hand wins, and the "found" note goes away.
    await page.getByLabel("Council area").selectOption("mitcham");
    await expect(page.getByText("Found from your location.")).toHaveCount(0);
  });

  test("explains when the location is outside the councils it covers", async ({ page }) => {
    await mockPlace(page, { address: "Main St, Hahndorf", councilId: null, outsideArea: "Mount Barker, South Australia" });
    await page.goto("/");
    await page.getByRole("button", { name: /Report a problem/ }).click();
    await page.locator("input[type=file]").setInputFiles(PHOTO);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/This spot is in Mount Barker, South Australia/)).toBeVisible();
  });

  test("report a pothole, follow it all the way to the ombudsman, then mark it fixed", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("How it works")).toBeVisible();
    await noSeriousA11yIssues(page);
    await noSideways(page);

    await page.getByRole("button", { name: /Report a problem/ }).click();
    await page.locator("input[type=file]").setInputFiles(PHOTO);
    await expect(page.getByText("Location found")).toBeVisible();
    await expect(page.getByRole("img", { name: "Your photo of the problem" })).toBeVisible();
    await noSeriousA11yIssues(page);
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByRole("heading", { name: "Check the details" })).toBeVisible();
    await noSeriousA11yIssues(page);
    await noSideways(page);
    // Can't continue until the required fields are filled.
    await expect(page.getByRole("button", { name: "Write my report" })).toBeDisabled();
    await page.getByRole("button", { name: /Pothole or road damage/ }).click();
    await fillDetails(page, "Deep pothole in bike lane", "King William St, Adelaide 5000");
    await expect(page.getByText("This will go to")).toBeVisible();
    await expect(page.getByText("City of Adelaide", { exact: true }).last()).toBeVisible();
    await page.getByRole("button", { name: "Write my report" }).click();

    await expect(page.getByRole("heading", { name: "Send it to City of Adelaide" })).toBeVisible();
    await expect(page.getByLabel("Message (you can edit it)")).toHaveValue(/King William St/);
    await expect(page.getByRole("link", { name: /Open City of Adelaide/ })).toHaveAttribute("href", /cityofadelaide/);
    await expect(page.getByRole("link", { name: /Save the photo/ })).toHaveAttribute("download", /\.jpg$/);
    await noSeriousA11yIssues(page);
    await noSideways(page);
    await page.getByRole("button", { name: /start tracking/ }).click();

    await expect(page.getByText(/Next check-in/)).toBeVisible();
    await page.getByPlaceholder("e.g. CRM-123456").fill("CRM-42");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Agency replied").first()).toBeVisible();
    await noSeriousA11yIssues(page);

    // Survives a reload because it lives on the phone.
    await page.reload();
    await expect(page.getByText("Deep pothole in bike lane")).toBeVisible();

    const steps = ["Friendly reminder", "Formal complaint to a manager", "Letter to your local representative", "Complaint to the ombudsman"];
    for (const step of steps) {
      await forceOverdue(page);
      await expect(page.getByText("1 report needs a check-in")).toBeVisible();
      await page.getByRole("button", { name: /Deep pothole/ }).click();
      await page.getByRole("button", { name: /write the next follow-up/ }).click();
      await expect(page.getByRole("heading", { name: step })).toBeVisible();
      await expect(page.getByLabel("Message (you can edit it)")).toHaveValue(/CRM-42/);
      await page.getByRole("button", { name: "I've sent it" }).click();
      await expect(page.getByText(/Next check-in/)).toBeVisible();
      await page.getByRole("button", { name: "All reports" }).click();
    }

    await forceOverdue(page);
    await page.getByRole("button", { name: /Deep pothole/ }).click();
    await expect(page.getByText(/taken every step/)).toBeVisible();
    await page.getByRole("button", { name: "Yes, it's fixed" }).click();
    await expect(page.getByText(/Fixed. Thanks/)).toBeVisible();
    await noSeriousA11yIssues(page);
  });

  test("streetlights go to SA Power Networks", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Report a problem/ }).click();
    await page.locator("input[type=file]").setInputFiles(PHOTO);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: /Broken streetlight/ }).click();
    await expect(page.getByText("Is it on a main road?")).toHaveCount(0);
    await fillDetails(page, "Streetlight out", "Unley Rd, Unley 5061");
    await page.getByRole("button", { name: "Write my report" }).click();
    await expect(page.getByRole("link", { name: /Open SA Power Networks/ })).toHaveAttribute("href", /sapowernetworks/);
  });

  test("main-road potholes go to the state, with the hazard phone line", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Report a problem/ }).click();
    await page.locator("input[type=file]").setInputFiles(PHOTO);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: /Pothole or road damage/ }).click();
    await page.getByRole("button", { name: "Yes, main road" }).click();
    await fillDetails(page, "Pothole on South Rd", "South Rd, Edwardstown 5039");
    await expect(page.getByText("Department for Infrastructure and Transport")).toBeVisible();
    await page.getByRole("button", { name: "Write my report" }).click();
    await expect(page.getByRole("link", { name: /Call 1800 018 313/ })).toHaveAttribute("href", "tel:1800018313");
  });
});

test.describe("without location", () => {
  test.use({ permissions: [] });

  test("works with no photo and no GPS: the person types everything", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Report a problem/ }).click();
    await expect(page.getByText(/Location is off/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Skip the photo" }).click();
    await expect(page.getByText("Tell us what the problem is.")).toBeVisible();
    await page.getByRole("button", { name: /Rubbish or dumped items/ }).click();
    await page.getByLabel("Council area").selectOption("west-torrens");
    await fillDetails(page, "Dumped mattress", "Henley Beach Rd, Mile End 5031");
    await page.getByRole("button", { name: "Write my report" }).click();
    await expect(page.getByRole("link", { name: /Open City of West Torrens/ })).toHaveAttribute("href", /westtorrens/);
    await expect(page.getByRole("link", { name: /Save the photo/ })).toHaveCount(0);
    await page.getByRole("button", { name: /start tracking/ }).click();
    await page.getByRole("button", { name: "All reports" }).click();
    await expect(page.getByText("Dumped mattress")).toBeVisible();
  });

  test("a second visitor can't see the first visitor's reports", async ({ browser }) => {
    const first = await (await browser.newContext()).newPage();
    await first.goto("/");
    await first.evaluate((key) => localStorage.setItem(key, JSON.stringify([{ title: "secret" }])), KEY);
    const second = await (await browser.newContext()).newPage();
    await second.goto("/");
    await expect(second.getByText("How it works")).toBeVisible();
  });

  test("fits a small 320px phone without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/");
    await noSideways(page);
    await page.getByRole("button", { name: /Report a problem/ }).click();
    await page.getByRole("button", { name: "Skip the photo" }).click({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Check the details" })).toBeVisible();
    await noSideways(page);
  });
});

test("can be added to a phone's home screen", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({ name: "Street Fix", display: "standalone", start_url: "/" });
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  expect((await request.get("/apple-icon.png")).ok()).toBe(true);
});
