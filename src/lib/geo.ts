import { councilFromAbsName, guessCouncil } from "./agencies";

const TIMEOUT_MS = 6000;

export type Place = {
  address: string;
  councilId: string | null;
  // The council area's name when it's outside the metro councils Street Fix covers.
  outsideArea: string | null;
};

// Finds the council area containing a point using the Australian Bureau of
// Statistics' official council boundaries (ASGS 2021).
async function councilAt(lat: number, lng: number) {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "lga_name_2021,state_name_2021",
    returnGeometry: "false",
    f: "json",
  });
  const res = await fetch(`https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/LGA/MapServer/0/query?${params}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`ABS ${res.status}`);
  const data = (await res.json()) as { features?: { attributes: { lga_name_2021: string; state_name_2021: string } }[] };
  const a = data.features?.[0]?.attributes;
  if (!a) return { councilId: null, outsideArea: "outside South Australia" };
  const councilId = councilFromAbsName(a.lga_name_2021);
  return { councilId, outsideArea: councilId ? null : `${a.lga_name_2021}, ${a.state_name_2021}` };
}

// Street address through OpenStreetMap's Nominatim. Its usage policy asks for
// a descriptive User-Agent and at most one request per second.
async function addressAt(lat: number, lng: number) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "StreetFix/0.1 (community issue reporting app)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const data = (await res.json()) as { display_name?: string; address?: Record<string, string> };
  const a = data.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const suburb = a.suburb ?? a.town ?? a.village ?? a.city_district ?? "";
  return {
    address: [street, suburb, a.postcode].filter(Boolean).join(", ") || data.display_name || "",
    councilGuess: guessCouncil(Object.values(a)),
  };
}

export async function lookupPlace(lat: number, lng: number): Promise<Place> {
  const [council, street] = await Promise.allSettled([councilAt(lat, lng), addressAt(lat, lng)]);
  const address = street.status === "fulfilled" ? street.value.address : "";
  if (council.status === "fulfilled") return { address, ...council.value };
  // Boundary service unavailable: fall back to matching names in the street address.
  return { address, councilId: street.status === "fulfilled" ? street.value.councilGuess : null, outsideArea: null };
}
