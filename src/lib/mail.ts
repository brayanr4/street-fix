import { promises as fs } from "fs";
import path from "path";

// Sends email through Resend (https://resend.com). Set RESEND_API_KEY and MAIL_FROM,
// for example MAIL_FROM="Street Fix <reports@streetfix.com.au>" on a domain verified in
// Resend. For tests and local runs, MAIL_OUTBOX_DIR writes each email to a JSON file
// instead of sending it.

export type Mail = {
  to: string;
  cc?: string;
  replyTo?: string;
  subject: string;
  text: string;
  photo?: string | null; // data URL
};

export function mailEnabled() {
  return Boolean(process.env.MAIL_OUTBOX_DIR || (process.env.RESEND_API_KEY && process.env.MAIL_FROM));
}

function attachment(photo: string | null | undefined) {
  const m = photo?.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
  return m ? [{ filename: `photo.${m[1] === "jpeg" ? "jpg" : m[1]}`, content: m[2] }] : [];
}

export async function sendMail(mail: Mail): Promise<void> {
  const outbox = process.env.MAIL_OUTBOX_DIR;
  if (outbox) {
    await fs.mkdir(outbox, { recursive: true });
    const name = `${process.hrtime.bigint().toString().padStart(20, "0")}.json`;
    await fs.writeFile(path.join(outbox, name), JSON.stringify({ ...mail, photo: mail.photo ? "attached" : null }));
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [mail.to],
      cc: mail.cc ? [mail.cc] : undefined,
      reply_to: mail.replyTo,
      subject: mail.subject,
      text: mail.text,
      attachments: attachment(mail.photo),
    }),
  });
  if (!res.ok) throw new Error(`Email failed (${res.status}): ${await res.text().catch(() => "")}`);
}
