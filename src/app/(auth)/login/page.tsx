import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const { next, reset } = await searchParams;
  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your KELO account with your email and PIN.
        </p>
      </div>
      {reset === "success" ? (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm">
          Your PIN was reset. Sign in with your new PIN below.
        </div>
      ) : null}
      <LoginForm next={next} />
    </div>
  );
}
