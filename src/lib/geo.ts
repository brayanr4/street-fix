import { guessCouncil } from "./agencies";

// Reverse geocoding through OpenStreetMap's Nominatim. Its usage policy asks for
// a descriptive User-Agent and at most one request per second.
export async function lookupPlace(lat: number, lng: number) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "StreetFix/0.1 (community issue reporting prototype)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const a = data.address ?? {};
    const street = [a.house_number, a.road].filter(Boolean).join(" ");
    const suburb = a.suburb ?? a.town ?? a.village ?? a.city_district ?? "";
    const address = [street, suburb, a.postcode].filter(Boolean).join(", ") || data.display_name || "";
    const councilId = guessCouncil(Object.values(a));
    return { address, councilId, roadType: a.road ?? "" };
  } catch {
    return { address: "", councilId: null, roadType: "" };
  }
}
