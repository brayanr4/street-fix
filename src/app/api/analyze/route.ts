import { aiEnabled, analyzePhoto } from "@/lib/ai";
import { rateLimited } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const limited = rateLimited(request);
  if (limited) return limited;

  const { image, note } = (await request.json()) as { image: string | null; note?: string };
  const match = image?.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  const analysis = match ? await analyzePhoto(match[2], match[1], note ?? "") : null;
  return Response.json({ analysis, aiEnabled: aiEnabled() });
}
