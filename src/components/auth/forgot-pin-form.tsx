"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { forgotPinAction, type ForgotPinFormState } from "@/server/auth/actions";
import { Button } from "@/components/ui/button";

export function ForgotPinForm() {
  const [state, formAction, pending] = useActionState<ForgotPinFormState, FormData>(
    forgotPinAction,
    {},
  );

  if (state.sent) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm">
          If that email has a KELO account, we’ve sent a link to reset your PIN.
          It expires shortly and can only be used once.
        </div>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@university.edu"
          className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background"
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
