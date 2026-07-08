import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createUser, EmailInUseError } from "@/lib/auth/users";
import { credentialsSchema, signupSchema } from "@/lib/validation/auth";

// Unique namespace so runs don't collide and cleanup is targeted.
const RUN = `authtest_${Date.now()}`;
const email = (tag: string) => `${RUN}_${tag}@example.com`;

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: RUN } } });
  await prisma.$disconnect();
});

describe("password hashing", () => {
  it("hashes a password to something other than the plaintext and verifies it", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).not.toContain("correct horse battery");
    expect(hash.startsWith("$argon2")).toBe(true);
    expect(await verifyPassword(hash, "correct horse battery")).toBe(true);
    expect(await verifyPassword(hash, "wrong password")).toBe(false);
  });
});

describe("signup validation", () => {
  it("rejects a bad email and a short password", () => {
    expect(signupSchema.safeParse({ name: "A", email: "nope", password: "x" }).success).toBe(false);
    expect(
      signupSchema.safeParse({ name: "A", email: "a@b.com", password: "short" }).success,
    ).toBe(false);
  });

  it("normalizes email to lowercase", () => {
    const parsed = credentialsSchema.parse({ email: "MixedCase@Example.COM", password: "longenough" });
    expect(parsed.email).toBe("mixedcase@example.com");
  });
});

describe("createUser + credential auth (success path)", () => {
  it("creates a real hashed user and authenticates the correct password", async () => {
    const addr = email("ok");
    const user = await createUser({ name: "Real User", email: addr, password: "supersecret1" });
    expect(user.id).toBeTruthy();
    expect(user.plan).toBe("STARTER");

    // Password is stored hashed, never in plaintext.
    const row = await prisma.user.findUniqueOrThrow({ where: { email: addr } });
    expect(row.passwordHash).toBeTruthy();
    expect(row.passwordHash).not.toBe("supersecret1");

    // Correct credentials verify; wrong password does not.
    expect(await verifyPassword(row.passwordHash!, "supersecret1")).toBe(true);
    expect(await verifyPassword(row.passwordHash!, "notmypassword")).toBe(false);
  });
});

describe("createUser (failure paths)", () => {
  it("rejects a duplicate email", async () => {
    const addr = email("dup");
    await createUser({ name: "First", email: addr, password: "supersecret1" });
    await expect(
      createUser({ name: "Second", email: addr, password: "supersecret1" }),
    ).rejects.toBeInstanceOf(EmailInUseError);
  });
});
