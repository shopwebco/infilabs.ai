import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/auth/rbac";

/** Platform-admin (Xenon HQ) guard. Enforced server-side on every admin route. */
export async function requirePlatformAdmin(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { platformRole: true },
  });
  if (!user || user.platformRole !== "PLATFORM_ADMIN") {
    throw new ForbiddenError("Platform admin only.");
  }
}

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { platformRole: true },
  });
  return user?.platformRole === "PLATFORM_ADMIN";
}
