import { z } from "zod";

// Shared auth input schemas — validated at every API boundary (CLAUDE.md Rule 5).
export const credentialsSchema = z.object({
  email: z.string().email().max(320).transform((e) => e.toLowerCase().trim()),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const signupSchema = credentialsSchema.extend({
  name: z.string().trim().min(1, "Name is required").max(120),
  referralCode: z.string().trim().max(64).optional(),
});

export type Credentials = z.infer<typeof credentialsSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
