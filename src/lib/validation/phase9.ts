import { z } from "zod";

export const createProposalSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  prospectUrl: z.string().url().max(2000).optional().or(z.literal("")),
  inputs: z.string().trim().min(1).max(8000),
});

export const directorySchema = z.object({
  workspaceId: z.string().min(1),
  listed: z.boolean(),
});
