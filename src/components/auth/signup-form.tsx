"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type AuthFormState } from "@/server/auth/actions";
import { validatePin, pinsMatch } from "@/lib/auth/pin";
import { PinInput } from "./pin-input";
import { Button } from "@/components/ui/button";

export function SignupForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    signupAction,
    {},
  );
  const [pin, setPin] = React.useState("");
  const [confirmPin, setConfirmPin] = React.useState("");

  const strength = pin.length === 6 ? validatePin(pin) : null;
  const mismatch =
    confirmPin.length === 6 && !pinsMatch(pin, confirmPin);
  const canSubmit =
    !pending &&
    pin.length === 6 &&
    confirmPin.length === 6 &&
    strength?.valid === true &&
    !mismatch;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="pin" value={pin} />
      <input type="hidden" name="confirmPin" value={confirmPin} />

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

      <div className="space-y-1.5">
        <PinInput
          value={pin}
          onChange={setPin}
          label="Choose a 6-digit PIN"
          aria-invalid={strength?.valid === false}
        />
        {strength && !strength.valid ? (
          <p className="text-xs text-warning">{strength.reason}</p>
        ) : strength?.valid ? (
          <p className="text-xs text-success">Looks good.</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Avoid sequences (123456) and repeats (111111).
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <PinInput
          value={confirmPin}
          onChange={setConfirmPin}
          label="Confirm PIN"
          aria-invalid={mismatch}
        />
        {mismatch ? (
          <p className="text-xs text-destructive">PINs don’t match.</p>
        ) : null}
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
