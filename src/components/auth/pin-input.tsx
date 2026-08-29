"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  label?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  "aria-invalid"?: boolean;
}

/**
 * Elegant segmented 6-digit PIN entry. Masks input, auto-advances, supports
 * backspace, arrow keys, and pasting a full code.
 */
export function PinInput({
  value,
  onChange,
  length = 6,
  label,
  autoFocus,
  disabled,
  "aria-invalid": ariaInvalid,
}: PinInputProps) {
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);
  const digits = React.useMemo(() => {
    const arr = value.split("").slice(0, length);
    while (arr.length < length) arr.push("");
    return arr;
  }, [value, length]);

  const setDigit = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join("").replace(/\D/g, "").slice(0, length));
  };

  const handleChange = (index: number, raw: string) => {
    const only = raw.replace(/\D/g, "");
    if (!only) {
      setDigit(index, "");
      return;
    }
    // If multiple chars (e.g. autofill), distribute from this index.
    const next = digits.slice();
    let i = index;
    for (const ch of only) {
      if (i >= length) break;
      next[i] = ch;
      i++;
    }
    onChange(next.join("").replace(/\D/g, "").slice(0, length));
    const focusIndex = Math.min(i, length - 1);
    refs.current[focusIndex]?.focus();
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        setDigit(index, "");
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
        setDigit(index - 1, "");
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (pasted) {
      onChange(pasted);
      refs.current[Math.min(pasted.length, length - 1)]?.focus();
    }
  };

  return (
    <div>
      {label ? (
        <span className="mb-2 block text-sm font-medium text-foreground">
          {label}
        </span>
      ) : null}
      <div className="flex gap-2 sm:gap-3" role="group" aria-label={label ?? "PIN"}>
        {digits.map((digit, index) => (
          <input
            key={`pin-${index}`}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="password"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={digit}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            aria-invalid={ariaInvalid}
            aria-label={`Digit ${index + 1}`}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className={cn(
              "h-14 w-full rounded-xl border bg-card text-center text-2xl font-semibold caret-primary",
              "transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background",
              ariaInvalid ? "border-destructive" : "border-input",
              disabled && "opacity-50",
            )}
          />
        ))}
      </div>
    </div>
  );
}
