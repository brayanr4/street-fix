import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ESCALATION_STEPS, type Agency } from "./agencies";
import { ISSUE_LABELS, ISSUE_TYPES, type Analysis, type Letter, type Report } from "./types";

const MODEL = "claude-opus-5-5";

// Without an API key the app still works: photos skip the AI description
// and letters come from the templates below.
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

export const aiEnabled = () => client !== null;

const AnalysisSchema = z.object({
  isPublicIssue: z.boolean(),
  issueType: z.enum(ISSUE_TYPES),
  title: z.string(),
  description: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  safetyRisk: z.string(),
});

const LetterSchema = z.object({ subject: z.string(), body: z.string() });

export async function analyzePhoto(imageBase64: string, mediaType: string, note: string): Promise<Analysis | null> {
  if (!client) return null;
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(AnalysisSchema) },
      system:
        "You help residents of Adelaide, South Australia report problems in public spaces to the council or agency responsible. " +
        "Look at the photo and describe only what is visible. Keep the title under 8 words. " +
        "Write the description in 2-3 plain sentences a council officer can act on: what the problem is, its rough size, and where in the frame it is. " +
        "safetyRisk is one short sentence on who could get hurt, or an empty string if there is no real risk. " +
        "Set isPublicIssue to false if the photo doesn't show a problem on public land.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType as "image/jpeg", data: imageBase64 },
            },
            { type: "text", text: note ? `The resident added: "${note}"` : "No note from the resident." },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") return null;
    return response.parsed_output ?? null;
  } catch (err) {
    console.error("analyzePhoto failed", err);
    return null;
  }
}

type LetterInput = Pick<Report, "title" | "description" | "address" | "lat" | "lng" | "issueType" | "severity" | "referenceNumber"> & {
  sentAt?: string;
};

function locationLine(r: LetterInput) {
  const coords = r.lat != null && r.lng != null ? ` (GPS ${r.lat.toFixed(5)}, ${r.lng.toFixed(5)})` : "";
  return `${r.address || "Location attached"}${coords}`;
}

function templateLetter(r: LetterInput, agency: Agency, level: number): Letter {
  const where = locationLine(r);
  const ref = r.referenceNumber ? ` (reference ${r.referenceNumber})` : "";
  const sent = r.sentAt ? new Date(r.sentAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "";
  const what = `${ISSUE_LABELS[r.issueType]}: ${r.title}`;
  switch (level) {
    case 0:
      return {
        subject: `Report: ${r.title} at ${r.address || "attached location"}`,
        body: `Hello,\n\nI'd like to report a problem that needs attention.\n\nWhat: ${what}\nWhere: ${where}\nDetails: ${r.description}\n\nA photo is attached. Could you please let me know the reference number for this report and when it is expected to be fixed?\n\nThank you,`,
      };
    case 1:
      return {
        subject: `Follow-up on my report${ref}: ${r.title}`,
        body: `Hello,\n\nOn ${sent} I reported the following problem${ref}, and it still appears to be unresolved.\n\nWhat: ${what}\nWhere: ${where}\n\nCould you please tell me the current status and when the repair is scheduled?\n\nThank you,`,
      };
    case 2:
      return {
        subject: `Formal complaint: unresolved report${ref}`,
        body: `Dear Customer Service Manager,\n\nI am writing to make a formal complaint. On ${sent} I reported the problem below${ref} to ${agency.name}. I followed up, but it has not been fixed and I have not been given a timeframe.\n\nWhat: ${what}\nWhere: ${where}\nDetails: ${r.description}\n\nPlease treat this as a formal complaint under your complaints handling policy and tell me what action will be taken and by when.\n\nKind regards,`,
      };
    case 3:
      return {
        subject: `Request for help with an unresolved local issue${ref}`,
        body: `Dear Representative,\n\nI'm a local resident asking for your help. On ${sent} I reported the problem below${ref} to ${agency.name}. Despite a reminder and a formal complaint, it remains unfixed.\n\nWhat: ${what}\nWhere: ${where}\nDetails: ${r.description}\n\nI would be grateful if you could raise this with ${agency.name} on my behalf.\n\nKind regards,`,
      };
    default:
      return {
        subject: `Complaint about ${agency.name}: unresolved report${ref}`,
        body: `To ${agency.ombudsman.name},\n\nI would like to make a complaint about how ${agency.name} has handled a report I made on ${sent}${ref}.\n\nWhat: ${what}\nWhere: ${where}\nDetails: ${r.description}\n\nSteps I have taken: I reported the problem, sent a reminder, made a formal complaint to the agency, and contacted my local representative. The problem has still not been fixed and I have not received a clear timeframe.\n\nKind regards,`,
      };
  }
}

export async function draftLetter(r: LetterInput, agency: Agency, level: number): Promise<Letter> {
  const fallback = templateLetter(r, agency, level);
  if (!client) return fallback;
  const step = ESCALATION_STEPS[Math.min(level, ESCALATION_STEPS.length - 1)].title;
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(LetterSchema) },
      system:
        "You write short, polite, firm letters for residents of Adelaide, South Australia about problems in public spaces. " +
        "Use Australian English. Keep the body under 180 words, use plain language, and never invent facts, dates, names or reference numbers. " +
        "End with a sign-off line such as 'Kind regards,' and leave the name off: the resident adds it.",
      messages: [
        {
          role: "user",
          content:
            `Stage: ${step} (stage ${level} of 4).\n` +
            `Recipient: ${level === 3 ? "the resident's local elected representative" : level >= 4 ? agency.ombudsman.name : agency.name}.\n` +
            `Responsible agency: ${agency.name}.\n` +
            `Problem: ${ISSUE_LABELS[r.issueType]}: ${r.title}. ${r.description}\n` +
            `Severity: ${r.severity}.\nLocation: ${locationLine(r)}.\n` +
            (r.sentAt ? `First reported: ${new Date(r.sentAt).toDateString()}.\n` : "") +
            (r.referenceNumber ? `Reference number: ${r.referenceNumber}.\n` : "No reference number was given.\n") +
            `Here is a template version to improve on, keeping every fact the same:\n\n${fallback.subject}\n\n${fallback.body}`,
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return fallback;
    return response.parsed_output;
  } catch (err) {
    console.error("draftLetter failed", err);
    return fallback;
  }
}
