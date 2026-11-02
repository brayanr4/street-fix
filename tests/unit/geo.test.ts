import { afterEach, describe, expect, it, vi } from "vitest";
import { COUNCILS, councilFromAbsName } from "@/lib/agencies";
import { lookupPlace } from "@/lib/geo";

type Fake = { abs?: unknown; absStatus?: number; nominatim?: unknown; nominatimStatus?: number };

function fakeFetch({ abs, absStatus = 200, nominatim = {}, nominatimStatus = 200 }: Fake) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const isAbs = url.includes("geo.abs.gov.au");
      if (isAbs && abs instanceof Error) throw abs;
      return new Response(JSON.stringify(isAbs ? abs : nominatim), { status: isAbs ? absStatus : nominatimStatus });
    }),
  );
}

const absHit = (name: string, state = "South Australia") => ({
  features: [{ attributes: { lga_name_2021: name, state_name_2021: state } }],
});

afterEach(() => vi.unstubAllGlobals());

describe("lookupPlace", () => {
  it("finds the council from official boundaries and builds a street address", async () => {
    fakeFetch({
      abs: absHit("Unley"),
      nominatim: { address: { house_number: "12", road: "Unley Road", suburb: "Unley", postcode: "5061" } },
    });
    expect(await lookupPlace(-34.95, 138.6)).toEqual({ address: "12 Unley Road, Unley, 5061", councilId: "unley", outsideArea: null });
  });

  it("asks the boundary service with longitude first", async () => {
    fakeFetch({ abs: absHit("Adelaide") });
    await lookupPlace(-34.9285, 138.6007);
    const url = (fetch as unknown as { mock: { calls: string[][] } }).mock.calls.find(([u]) => u.includes("abs"))![0];
    expect(decodeURIComponent(url)).toContain("geometry=138.6007,-34.9285");
  });

  it("names the area when it's outside the metro councils", async () => {
    fakeFetch({ abs: absHit("Mount Barker") });
    expect(await lookupPlace(-35.07, 138.86)).toMatchObject({ councilId: null, outsideArea: "Mount Barker, South Australia" });
  });

  it("says when the point isn't in any council area", async () => {
    fakeFetch({ abs: { features: [] } });
    expect(await lookupPlace(0, 0)).toMatchObject({ councilId: null, outsideArea: "outside South Australia" });
  });

  it("falls back to council names in the street address when the boundary service is down", async () => {
    fakeFetch({ abs: new Error("down"), nominatim: { address: { road: "Prospect Road", city: "City of Prospect" } } });
    expect(await lookupPlace(-34.88, 138.6)).toMatchObject({ councilId: "prospect", address: "Prospect Road" });
  });

  it("still returns the council when the address service fails", async () => {
    fakeFetch({ abs: absHit("Marion"), nominatimStatus: 429 });
    expect(await lookupPlace(-35.0, 138.55)).toEqual({ address: "", councilId: "marion", outsideArea: null });
  });
});

describe("councilFromAbsName", () => {
  it("maps every metro council's ABS spelling", () => {
    expect(councilFromAbsName("Campbelltown (SA)")).toBe("campbelltown");
    expect(councilFromAbsName("Norwood Payneham and St Peters")).toBe("npsp");
    expect(councilFromAbsName("Port Adelaide Enfield")).toBe("pae");
    expect(councilFromAbsName("Mount Barker")).toBeNull();
  });

  it("covers all 19 councils Street Fix knows about", () => {
    const abs = ["Adelaide", "Adelaide Hills", "Burnside", "Campbelltown (SA)", "Charles Sturt", "Gawler", "Holdfast Bay", "Marion", "Mitcham", "Norwood Payneham and St Peters", "Onkaparinga", "Playford", "Port Adelaide Enfield", "Prospect", "Salisbury", "Tea Tree Gully", "Unley", "Walkerville", "West Torrens"];
    expect(new Set(abs.map(councilFromAbsName))).toEqual(new Set(COUNCILS.map((c) => c.id)));
  });
});
