import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requestLinkSchema } from "@/lib/validation/portal";
import { issueMagicLink } from "@/lib/portal/tokens";
import { isEmailConfigured, sendEmail, magicLinkEmail } from "@/lib/email/resend";
import { getEmailBrand } from "@/lib/whitelabel";
import { appUrl } from "@/lib/stripe/checkout";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = requestLinkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  // Resolve the portal user either by explicit client, or by email within a
  // workspace (custom-domain login, where only the host is known).
  const portalUser = parsed.data.clientProjectId
    ? await prisma.clientPortalUser.findUnique({
        where: {
          clientProjectId_email: {
            clientProjectId: parsed.data.clientProjectId,
            email,
          },
        },
        select: { id: true, clientProjectId: true },
      })
    : await prisma.clientPortalUser.findFirst({
        where: { email, clientProject: { workspaceId: parsed.data.workspaceId } },
        select: { id: true, clientProjectId: true },
      });

  // Never reveal whether an email is registered.
  if (!portalUser) {
    return NextResponse.json({ sent: true }, { status: 200 });
  }

  const raw = await issueMagicLink(portalUser.id);
  const link = `${appUrl()}/portal/${portalUser.clientProjectId}/verify?token=${raw}`;
  const brand = await getEmailBrand(portalUser.clientProjectId);

  if (isEmailConfigured()) {
    const { subject, html } = magicLinkEmail(link, brand.brandName);
    try {
      await sendEmail({ to: email, subject, html, from: brand.emailFrom });
    } catch (err) {
      console.error("magic link email failed", err);
      return NextResponse.json({ error: "Could not send email." }, { status: 502 });
    }
    return NextResponse.json({ sent: true }, { status: 200 });
  }

  // Email not configured (dev): return the link so the flow stays usable/testable.
  return NextResponse.json({ sent: false, devLink: link }, { status: 200 });
}
