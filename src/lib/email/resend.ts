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
  from?: string | null;
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
      from: input.from || emailFrom(),
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

/** Branded magic-link email. `brandName` carries the agency's white-label identity. */
export function magicLinkEmail(link: string, brandName: string): {
  subject: string;
  html: string;
} {
  return {
    subject: `Your ${brandName} sign-in link`,
    html: `<p>Click to sign in to your ${brandName} portal. This link is single-use and expires in 15 minutes.</p><p><a href="${link}">Sign in</a></p><p>If you didn't request this, you can ignore this email.</p>`,
  };
}
