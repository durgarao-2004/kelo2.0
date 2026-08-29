"use client";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Greeting({ email }: { email: string }) {
  // Time-of-day depends on the viewer's clock. Rendered during render (not in an
  // effect); suppressHydrationWarning tolerates the server(UTC)→client swap.
  const greeting = greetingForHour(new Date().getHours());
  const name = email.split("@")[0];
  return (
    <h1 className="text-2xl font-semibold tracking-tight" suppressHydrationWarning>
      {greeting}
      {name ? `, ${name}` : ""}
    </h1>
  );
}
