import type { Metadata } from "next";
import { ResetPinForm } from "@/components/auth/reset-pin-form";

export const metadata: Metadata = { title: "Reset PIN" };

export default async function ResetPinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Set a new PIN</h1>
        <p className="text-sm text-muted-foreground">
          Choose a new 6-digit PIN for your KELO account.
        </p>
      </div>
      <ResetPinForm token={token ?? ""} />
    </div>
  );
}
