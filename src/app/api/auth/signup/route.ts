import { NextResponse } from "next/server";
import { signupSchema } from "@/lib/validation/auth";
import { createUser, EmailInUseError } from "@/lib/auth/users";
import { attributeReferral } from "@/lib/referrals";

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const user = await createUser(parsed.data);
    // Attribute the signup to a referring agency, if a valid code was supplied.
    // Never fail signup on a referral error.
    if (parsed.data.referralCode) {
      try {
        await attributeReferral(parsed.data.referralCode, user.id, user.plan);
      } catch (err) {
        console.error("referral attribution failed", err);
      }
    }
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof EmailInUseError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("signup failed", err);
    return NextResponse.json({ error: "Could not create account" }, { status: 500 });
  }
}
