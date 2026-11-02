import { lookupPlace } from "@/lib/geo";
import { rateLimited } from "@/lib/rateLimit";

// Turns the phone's GPS position into a street address and council area.
export async function POST(request: Request) {
  const limited = rateLimited(request);
  if (limited) return limited;

  const { lat, lng } = (await request.json()) as { lat: number; lng: number };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "Missing location" }, { status: 400 });
  }
  return Response.json(await lookupPlace(lat, lng));
}
