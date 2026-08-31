"use client";

import * as React from "react";
import { Bell, BellOff, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPushCapability,
  subscribeToPush,
  unsubscribeFromPush,
  hasActivePushSubscription,
} from "@/lib/push/subscribe";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function NotificationsToggle() {
  const [permission, setPermission] = React.useState<PermissionState>("default");
  const [subscribed, setSubscribed] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [testState, setTestState] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPermission(
      typeof Notification === "undefined" ? "unsupported" : (Notification.permission as PermissionState),
    );
    hasActivePushSubscription().then(setSubscribed);
  }, []);

  const pushCapable = getPushCapability() === "supported" && Boolean(VAPID_PUBLIC_KEY);

  async function handleEnable() {
    if (typeof Notification === "undefined") return;
    setPending(true);
    setError(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      if (result === "granted" && pushCapable && VAPID_PUBLIC_KEY) {
        await subscribeToPush(VAPID_PUBLIC_KEY);
        setSubscribed(true);
      }
    } catch {
      setError("Couldn't turn on notifications. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleDisable() {
    setPending(true);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
    } finally {
      setPending(false);
    }
  }

  async function handleTest() {
    setTestState("sending");
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      setTestState(res.ok ? "sent" : "error");
    } catch {
      setTestState("error");
    }
  }

  if (permission === "unsupported") {
    return (
      <p className="text-sm text-muted-foreground">
        Notifications aren’t supported in this browser.
      </p>
    );
  }

  if (permission === "denied") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <BellOff className="h-4 w-4" /> Notifications are blocked — enable them in your
        browser’s site settings to turn this back on.
      </p>
    );
  }

  if (permission === "granted" && subscribed) {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm text-success">
          <Check className="h-4 w-4" /> On — class reminders, attendance warnings, and
          lecture updates can reach this device even when KELO isn’t open.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={handleTest} disabled={testState === "sending"}>
            {testState === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send test notification
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDisable} disabled={pending}>
            Turn off
          </Button>
        </div>
        {testState === "sent" ? (
          <p className="text-xs text-success">Sent — check this device.</p>
        ) : testState === "error" ? (
          <p className="text-xs text-destructive">
            Couldn’t send a test notification. The subscription may have expired.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {pushCapable
          ? "Get real notifications for class reminders, attendance warnings, and lecture updates — even when KELO isn’t open."
          : "Get notified when a lecture finishes processing (or fails), while this tab is open."}
      </p>
      <Button size="sm" variant="secondary" onClick={handleEnable} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
        Enable notifications
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
