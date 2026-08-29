"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { resetPinAction, type ResetPinFormState } from "@/server/auth/actions";
import { validatePin, pinsMatch } from "@/lib/auth/pin";
import { PinInput } from "./pin-input";
import { Button } from "@/components/ui/button";

export function ResetPinForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ResetPinFormState, FormData>(
    resetPinAction,
    {},
  );
  const [pin, setPin] = React.useState("");
  const [confirmPin, setConfirmPin] = React.useState("");

  const strength = pin.length === 6 ? validatePin(pin) : null;
  const mismatch = confirmPin.length === 6 && !pinsMatch(pin, confirmPin);
  const canSubmit =
    !pending &&
    Boolean(token) &&
    pin.length === 6 &&
    confirmPin.length === 6 &&
    strength?.valid === true &&
    !mismatch;

  if (!token) {
    return (
      <div className="space-y-6">
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          This reset link is missing its token. Request a new one.
        </p>
        <p className="text-center text-sm">
          <Link href="/forgot-pin" className="font-medium text-primary hover:underline">
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="pin" value={pin} />
      <input type="hidden" name="confirmPin" value={confirmPin} />

      <div className="space-y-1.5">
        <PinInput
          value={pin}
          onChange={setPin}
          label="New 6-digit PIN"
          autoFocus
          aria-invalid={strength?.valid === false}
        />
        {strength && !strength.valid ? (
          <p className="text-xs text-warning">{strength.reason}</p>
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
          label="Confirm new PIN"
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
        {pending ? "Resetting…" : "Reset PIN"}
      </Button>
    </form>
  );
}
