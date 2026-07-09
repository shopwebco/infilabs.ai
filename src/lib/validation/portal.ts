import { z } from "zod";

export const requestLinkSchema = z.object({
  clientProjectId: z.string().min(1),
  email: z.string().email().max(320),
});

export const verifyLinkSchema = z.object({
  token: z.string().min(1),
});

export const decisionSchema = z.object({
  decision: z.enum(["approve", "decline"]),
});

export const addPortalUserSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().trim().max(120).optional(),
});

export const createApprovalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  detail: z.string().trim().min(1).max(4000),
});
