import Link from "next/link";
import { AuthBackground } from "@/components/auth/auth-background";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <AuthBackground />
      <header className="relative z-10 px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          KELO
        </Link>
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">
          <div className="animate-fade-in rounded-2xl border border-border bg-card/80 p-8 shadow-xl backdrop-blur-sm">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
