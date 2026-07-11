import type { Membership } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/auth/rbac";

export interface Brand {
  brandName: string;
  accentColor: string;
  logoUrl: string | null;
  hideXenon: boolean;
}

// Default (un-white-labeled) brand = Xenon's own.
export const DEFAULT_BRAND: Brand = {
  brandName: "Xenon",
  accentColor: "#67E8F9",
  logoUrl: null,
  hideXenon: false,
};

function toBrand(wl: {
  brandName: string;
  accentColor: string;
  logoUrl: string | null;
  hideXenon: boolean;
} | null | undefined): Brand {
  if (!wl) return DEFAULT_BRAND;
  return {
    brandName: wl.brandName,
    accentColor: wl.accentColor,
    logoUrl: wl.logoUrl,
    hideXenon: wl.hideXenon,
  };
}

const BRAND_SELECT = {
  brandName: true,
  accentColor: true,
  logoUrl: true,
  hideXenon: true,
} as const;

export async function getWorkspaceBrand(workspaceId: string): Promise<Brand> {
  const wl = await prisma.whiteLabelSettings.findUnique({
    where: { workspaceId },
    select: BRAND_SELECT,
  });
  return toBrand(wl);
}

/** Brand for a client portal, resolved via the client's owning workspace. */
export async function getBrandForClientProject(clientProjectId: string): Promise<Brand> {
  const cp = await prisma.clientProject.findUnique({
    where: { id: clientProjectId },
    select: { workspace: { select: { whiteLabel: { select: BRAND_SELECT } } } },
  });
  return toBrand(cp?.workspace.whiteLabel);
}

/** Branding for client-facing emails (brand name + from identity). */
export async function getEmailBrand(clientProjectId: string) {
  const cp = await prisma.clientProject.findUnique({
    where: { id: clientProjectId },
    select: {
      name: true,
      workspace: {
        select: { whiteLabel: { select: { brandName: true, emailFrom: true, hideXenon: true } } },
      },
    },
  });
  const wl = cp?.workspace.whiteLabel;
  return {
    clientName: cp?.name ?? "your",
    brandName: wl?.hideXenon ? wl.brandName : wl?.brandName ?? "Xenon",
    emailFrom: wl?.emailFrom ?? null,
  };
}

/** Host → workspace resolution for custom domains (used off the middleware rewrite). */
export async function resolveWorkspaceByHost(host: string): Promise<string | null> {
  const hostname = (host.split(":")[0] ?? "").toLowerCase().trim();
  if (!hostname) return null;
  const wl = await prisma.whiteLabelSettings.findUnique({
    where: { customDomain: hostname },
    select: { workspaceId: true },
  });
  return wl?.workspaceId ?? null;
}

/** Admin-only white-label CRUD for the actor's own workspace. */
export async function upsertWhiteLabel(
  actor: Membership,
  data: {
    brandName: string;
    accentColor: string;
    logoUrl?: string | null;
    customDomain?: string | null;
    emailFrom?: string | null;
    hideXenon: boolean;
  },
) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError("Only admins can manage white-label settings.");
  }
  const customDomain = data.customDomain?.toLowerCase().trim() || null;
  return prisma.whiteLabelSettings.upsert({
    where: { workspaceId: actor.workspaceId },
    create: {
      workspaceId: actor.workspaceId,
      brandName: data.brandName,
      accentColor: data.accentColor,
      logoUrl: data.logoUrl || null,
      customDomain,
      emailFrom: data.emailFrom || null,
      hideXenon: data.hideXenon,
    },
    update: {
      brandName: data.brandName,
      accentColor: data.accentColor,
      logoUrl: data.logoUrl || null,
      customDomain,
      emailFrom: data.emailFrom || null,
      hideXenon: data.hideXenon,
    },
    select: { workspaceId: true, brandName: true, customDomain: true },
  });
}

export async function getWhiteLabel(workspaceId: string) {
  return prisma.whiteLabelSettings.findUnique({ where: { workspaceId } });
}
