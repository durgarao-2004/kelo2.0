import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { logoutAction } from "@/server/auth/actions";
import { Sidebar, BottomNav } from "@/components/app/nav";
import { Button } from "@/components/ui/button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar email={user.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            KELO
          </Link>
          <form action={logoutAction}>
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </header>
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
