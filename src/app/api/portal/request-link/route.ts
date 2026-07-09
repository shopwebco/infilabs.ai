import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requestLinkSchema } from "@/lib/validation/portal";
import { issueMagicLink } from "@/lib/portal/tokens";
import { isEmailConfigured, sendEmail, magicLinkEmail } from "@/lib/email/resend";
import { appUrl } from "@/lib/stripe/checkout";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = requestLinkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  const portalUser = await prisma.clientPortalUser.findUnique({
    where: {
      clientProjectId_email: { clientProjectId: parsed.data.clientProjectId, email },
    },
    select: { id: true, clientProject: { select: { name: true } } },
  });

  // Do not reveal whether an email is registered.
  if (!portalUser) {
    return NextResponse.json({ sent: true }, { status: 200 });
  }

  const raw = await issueMagicLink(portalUser.id);
  const link = `${appUrl()}/portal/${parsed.data.clientProjectId}/verify?token=${raw}`;

  if (isEmailConfigured()) {
    const { subject, html } = magicLinkEmail(link, portalUser.clientProject.name);
    try {
      await sendEmail({ to: email, subject, html });
    } catch (err) {
      console.error("magic link email failed", err);
      return NextResponse.json({ error: "Could not send email." }, { status: 502 });
    }
    return NextResponse.json({ sent: true }, { status: 200 });
  }

  // Email not configured (dev): return the link so the flow is usable/testable.
  return NextResponse.json({ sent: false, devLink: link }, { status: 200 });
}
