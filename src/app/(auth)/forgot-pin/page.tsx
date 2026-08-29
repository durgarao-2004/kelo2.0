import type { Metadata } from "next";
import { ForgotPinForm } from "@/components/auth/forgot-pin-form";

export const metadata: Metadata = { title: "Forgot PIN" };

export default function ForgotPinPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Forgot your PIN?</h1>
        <p className="text-sm text-muted-foreground">
          Enter your account email and we’ll send you a link to reset it.
        </p>
      </div>
      <ForgotPinForm />
    </div>
  );
}
