import { aiEnabled, analyzePhoto } from "@/lib/ai";
import { lookupPlace } from "@/lib/geo";
import { rateLimited } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const limited = rateLimited(request);
  if (limited) return limited;

  const { image, lat, lng, note } = (await request.json()) as {
    image: string | null;
    lat: number | null;
    lng: number | null;
    note?: string;
  };

  const match = image?.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  const [analysis, place] = await Promise.all([
    match ? analyzePhoto(match[2], match[1], note ?? "") : Promise.resolve(null),
    lat != null && lng != null ? lookupPlace(lat, lng) : Promise.resolve({ address: "", councilId: null, roadType: "" }),
  ]);

  return Response.json({ analysis, ...place, aiEnabled: aiEnabled() });
}
