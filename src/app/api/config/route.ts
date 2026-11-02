import { mailEnabled } from "@/lib/mail";

// Tells the app whether Street Fix can send emails itself on this deployment.
export function GET() {
  return Response.json({ autoSend: mailEnabled() });
}
