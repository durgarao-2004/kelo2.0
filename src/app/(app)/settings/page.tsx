import type { Metadata } from "next";
import { HardDrive, Check, Cpu, Mail, Bell } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getServerEnvDiagnostics } from "@/lib/env";
import { getDriveConnection } from "@/server/db/drive";
import { logoutAction } from "@/server/auth/actions";
import { disconnectDriveAction } from "@/server/drive/actions";
import { PageHeader } from "@/components/app/page-header";
import { NotificationsToggle } from "@/components/settings/notifications-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

function Badge({ state }: { state: "connected" | "not_configured" }) {
  const connected = state === "connected";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        connected
          ? "bg-success/15 text-success"
          : "bg-secondary text-muted-foreground"
      }`}
    >
      {connected ? <Check className="h-3 w-3" /> : null}
      {connected ? "Connected" : "Not configured"}
    </span>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string }>;
}) {
  const user = await requireUser();
  const { drive: driveParam } = await searchParams;
  const [driveStatus, env] = await Promise.all([
    getDriveConnection(user.id).catch(() => ({
      connected: false,
      googleEmail: null,
      rootFolderId: null,
    })),
    Promise.resolve(getServerEnvDiagnostics()),
  ]);

  const providers = [
    { name: "Gemini (primary)", ok: env.ai.gemini },
    { name: "Grok (secondary)", ok: env.ai.grok },
    { name: "OpenAI", ok: env.ai.openai },
    { name: "OpenRouter (fallback)", ok: env.ai.openrouter },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader title="Settings" description="Account, storage, and AI." />

      {driveParam === "connected" ? (
        <div className="mb-4 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Google Drive connected.
        </div>
      ) : driveParam === "error" ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Couldn’t connect Google Drive. Please try again.
        </div>
      ) : driveParam === "disconnected" ? (
        <div className="mb-4 rounded-xl border border-border bg-secondary px-4 py-3 text-sm">
          Google Drive disconnected.
        </div>
      ) : null}

      <div className="space-y-5">
        {/* Account */}
        <Card>
          <CardContent className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Mail className="h-4 w-4" /> Account
            </h2>
            <p className="text-sm">
              Signed in as <span className="font-medium">{user.email}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Your account is secured with a 6-digit PIN.
            </p>
            <form action={logoutAction}>
              <Button variant="secondary" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Google Drive */}
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <HardDrive className="h-4 w-4" /> Google Drive
              </h2>
              <Badge state={driveStatus.connected ? "connected" : "not_configured"} />
            </div>
            {driveStatus.connected ? (
              <>
                <p className="text-sm">
                  Connected{driveStatus.googleEmail ? ` as ${driveStatus.googleEmail}` : ""}.
                  Recordings, transcripts, and summaries are organized under{" "}
                  <code className="rounded bg-secondary px-1">KELO/Year/Semester/Subject</code>.
                </p>
                <form action={disconnectDriveAction}>
                  <Button variant="secondary" size="sm" type="submit">
                    Disconnect
                  </Button>
                </form>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect Drive so KELO can auto-create your folder tree and store
                  recordings, transcripts, and summaries.
                </p>
                <a href="/api/drive/connect">
                  <Button size="sm">Connect Google Drive</Button>
                </a>
              </>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardContent className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Bell className="h-4 w-4" /> Notifications
            </h2>
            <NotificationsToggle />
          </CardContent>
        </Card>

        {/* AI providers */}
        <Card>
          <CardContent className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Cpu className="h-4 w-4" /> AI providers
            </h2>
            <ul className="space-y-2">
              {providers.map((p) => (
                <li key={p.name} className="flex items-center justify-between text-sm">
                  <span>{p.name}</span>
                  <Badge state={p.ok ? "connected" : "not_configured"} />
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              KELO routes each task to the best available provider and falls back
              automatically.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
