import { describe, expect, it } from "vitest";
import { rateLimited } from "@/lib/rateLimit";

const from = (ip: string) => new Request("http://localhost/api/draft", { headers: { "x-forwarded-for": ip } });

describe("rateLimited", () => {
  it("allows 30 requests per visitor, then refuses with a friendly 429", async () => {
    for (let i = 0; i < 30; i++) expect(rateLimited(from("1.1.1.1"))).toBeNull();
    const res = rateLimited(from("1.1.1.1"));
    expect(res?.status).toBe(429);
    expect((await res!.json()).error).toMatch(/^Too many requests/);
  });

  it("counts each visitor separately", () => {
    for (let i = 0; i < 31; i++) rateLimited(from("2.2.2.2"));
    expect(rateLimited(from("3.3.3.3"))).toBeNull();
  });
});
