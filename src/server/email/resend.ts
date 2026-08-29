import "server-only";
import { getServerEnv } from "@/lib/env";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendPinRecoveryEmailInput {
  to: string;
  resetUrl: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function renderHtml(resetUrl: string): string {
  const safeUrl = escapeHtml(resetUrl);
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a;">
  <h2 style="margin:0 0 16px;font-size:20px;">Reset your KELO PIN</h2>
  <p style="line-height:1.6;color:#444;">A PIN reset was requested for your KELO account.</p>
  <p style="margin:28px 0;">
    <a href="${safeUrl}" style="background:#4f46e5;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Reset PIN</a>
  </p>
  <p style="line-height:1.6;color:#777;font-size:13px;">This link expires shortly and can only be used once.</p>
  <p style="line-height:1.6;color:#777;font-size:13px;">If you did not request this, you can safely ignore this email.</p>
</div>`;
}

/**
 * Deliver a PIN-recovery email via Resend. This is the ONLY thing Resend is
 * used for — never login, signup, or any other flow. The email never
 * contains the PIN itself, only a single-use recovery link.
 */
export async function sendPinRecoveryEmail(input: SendPinRecoveryEmailInput): Promise<void> {
  const env = getServerEnv();
  if (!env.RESEND_API_KEY) {
    throw new Error("resend_not_configured");
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [input.to],
      subject: "Reset your KELO PIN",
      html: renderHtml(input.resetUrl),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`resend ${res.status}: ${detail.slice(0, 200)}`);
  }
}
