import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export const createClientSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
});

export const archiveClientSchema = z.object({
  archived: z.boolean(),
});

export const assignSchema = z.object({
  membershipId: z.string().min(1),
});

export const createWorkItemSchema = z.object({
  clientProjectId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
});

export const transitionSchema = z.object({
  action: z.enum(["submit", "approve", "publish"]),
});

export const createInviteSchema = z.object({
  workspaceId: z.string().min(1),
  email: z.string().email().max(320),
  role: z.enum(["ADMIN", "MANAGER", "STAFF"]),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
});
