import { z } from "zod";

export const whiteLabelSchema = z.object({
  workspaceId: z.string().min(1),
  brandName: z.string().trim().min(1).max(120),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color like #2DD4BF"),
  logoUrl: z.string().url().max(2000).optional().or(z.literal("")),
  customDomain: z
    .string()
    .trim()
    .toLowerCase()
    .max(255)
    .regex(/^[a-z0-9.-]+$/, "Enter a bare hostname like portal.agency.com")
    .optional()
    .or(z.literal("")),
  emailFrom: z.string().trim().max(255).optional().or(z.literal("")),
  hideXenon: z.boolean(),
});
