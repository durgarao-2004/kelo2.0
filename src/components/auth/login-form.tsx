"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthFormState } from "@/server/auth/actions";
import { PinInput } from "./pin-input";
import { Button } from "@/components/ui/button";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    loginAction,
    {},
  );
  const [pin, setPin] = React.useState("");

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="pin" value={pin} />

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
          label="6-digit PIN"
          aria-invalid={Boolean(state.error)}
        />
        <div className="text-right">
          <Link
            href="/forgot-pin"
            className="text-xs font-medium text-muted-foreground hover:text-primary hover:underline"
          >
            Forgot PIN?
          </Link>
        </div>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={pending || pin.length < 6}
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New to KELO?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
