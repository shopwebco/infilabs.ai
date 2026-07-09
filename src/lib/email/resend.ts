export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function emailFrom(): string {
  return process.env.EMAIL_FROM || "Xenon <onboarding@resend.dev>";
}

/**
 * Sends an email via Resend's real API. Throws (feature-gated) when unconfigured
 * — callers surface an honest state rather than pretending a send happened.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("Email is not configured (RESEND_API_KEY missing).");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Email send failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as { id: string };
  return data;
}

export function magicLinkEmail(link: string, clientName: string): {
  subject: string;
  html: string;
} {
  return {
    subject: `Your sign-in link for ${clientName}`,
    html: `<p>Click to sign in to your ${clientName} portal. This link is single-use and expires in 15 minutes.</p><p><a href="${link}">Sign in</a></p><p>If you didn't request this, you can ignore this email.</p>`,
  };
}
