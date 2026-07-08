import Link from "next/link";
import { Panel } from "@/components/ui";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Panel>
      <h1 className="text-xl font-semibold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Log in to your Xenon account.</p>
      <div className="mt-6">
        <LoginForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        No account?{" "}
        <Link href="/signup" className="text-ice hover:underline">
          Create one
        </Link>
      </p>
    </Panel>
  );
}
