import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readdirSync, readFileSync } from "fs";
import path from "path";

// Street Fix sends the report and follow-ups by email. The test server writes each email
// to a file in .data/e2e/outbox instead of sending it.
const PHOTO = path.join(__dirname, "fixtures", "pothole.jpg");
const OUTBOX = path.join(__dirname, "..", "..", ".data", "e2e", "outbox");

type Mail = { to: string; cc?: string; replyTo?: string; subject: string; text: string; photo: string | null };

function outbox(): Mail[] {
  try {
    return readdirSync(OUTBOX)
      .sort()
      .map((f) => JSON.parse(readFileSync(path.join(OUTBOX, f), "utf8")));
  } catch {
    return [];
  }
}

async function lastMailTo(to: string) {
  let mail: Mail | undefined;
  await expect.poll(() => (mail = outbox().filter((m) => m.to === to).at(-1))).toBeTruthy();
  return mail!;
}

async function reportPothole(page: Page, title: string) {
  await page.getByRole("button", { name: /Report a problem/ }).click();
  await page.locator("input[type=file]").setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByPlaceholder("e.g. Deep pothole").fill(title);
  await page.getByPlaceholder("What's wrong").fill("Deep pothole in the bike lane.");
  await expect(page.getByLabel("Council area")).toHaveValue("unley");
  await page.getByRole("button", { name: "Write my report" }).click();
}

test.use({ geolocation: { latitude: -34.95, longitude: 138.6 }, permissions: ["geolocation"] });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/place", (route) => route.fulfill({ json: { address: "12 Unley Road, Unley", councilId: "unley", outsideArea: null } }));
});

test("sends the report by email after a one-time email check, then follows it up", async ({ page }) => {
  const email = `sam+${Date.now()}@example.com`;
  await page.goto("/");
  await reportPothole(page, "Pothole outside the cafe");

  await expect(page.getByRole("heading", { name: "Send it to City of Unley" })).toBeVisible();
  await expect(page.getByText(/copy you in so their reply comes straight to you/)).toBeVisible();
  const send = page.getByRole("button", { name: "Send my report" });
  await expect(send).toBeDisabled();
  await page.getByLabel("Your name").fill("Sam Lee");
  await page.getByLabel("Your email").fill(email);
  const { violations } = await new AxeBuilder({ page: page as never }).analyze();
  expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await send.click();

  // First time: confirm the email address.
  await expect(page.getByText("Check your email")).toBeVisible();
  const confirm = await lastMailTo(email);
  expect(confirm.subject).toBe("Tap to send your report to City of Unley");
  expect(outbox().some((m) => m.to === "pobox1@unley.sa.gov.au" && m.cc === email)).toBe(false);

  const link = confirm.text.match(/http\S+a=confirm/)![0];
  await page.goto(link);
  await expect(page.getByText("Thanks. Your report has been sent.")).toBeVisible();
  await expect(page.getByText("Street Fix is following this up for you")).toBeVisible();
  const toCouncil = await lastMailTo("pobox1@unley.sa.gov.au");
  expect(toCouncil).toMatchObject({ cc: email, replyTo: email, photo: "attached" });
  expect(toCouncil.text).toContain("Sam Lee");
  await expect(page.getByText("Sent to City of Unley by email")).toBeVisible();

  // The same browser doesn't need to confirm again.
  await page.getByRole("button", { name: "All reports" }).click();
  await reportPothole(page, "Second pothole near the school");
  await expect(page.getByLabel("Your email")).toHaveValue(email);
  await page.getByRole("button", { name: "Send my report" }).click();
  await expect(page.getByText("Street Fix is following this up for you")).toBeVisible();
  await expect.poll(() => outbox().filter((m) => m.to === "pobox1@unley.sa.gov.au" && m.cc === email).length).toBe(2);

  // Telling us it's fixed stops the follow-ups.
  await page.getByRole("button", { name: "It's fixed" }).click();
  await expect(page.getByText(/Fixed. Thanks/)).toBeVisible();
});

test("the follow-up schedule can only be started with the secret", async ({ request }) => {
  expect((await request.get("/api/cron")).status()).toBe(401);
  const ok = await request.get("/api/cron", { headers: { authorization: "Bearer e2e-secret" } });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toMatchObject({ failed: 0 });
});

test("can still send it by hand", async ({ page }) => {
  await page.goto("/");
  await reportPothole(page, "Pothole by the bus stop");
  await page.getByRole("button", { name: "I'd rather send it myself" }).click();
  await expect(page.getByRole("button", { name: /Copy the message/ })).toBeVisible();
});

test("a report link with the wrong key shows nothing", async ({ page }) => {
  await page.goto("/api/r/00000000-0000-0000-0000-000000000000/act?k=nope&a=fixed");
  await expect(page.getByText("That link has expired or the report was removed.")).toBeVisible();
});
