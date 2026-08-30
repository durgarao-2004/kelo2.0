"use client";

import * as React from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

export function NotificationsToggle() {
  const [permission, setPermission] = React.useState<PermissionState>("default");

  React.useEffect(() => {
    // Notification.permission doesn't exist during SSR and has no change
    // event to subscribe to — reading it once after mount (rather than as
    // the initial render) is the correct way to avoid a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPermission(
      typeof Notification === "undefined" ? "unsupported" : (Notification.permission as PermissionState),
    );
  }, []);

  async function handleEnable() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result as PermissionState);
  }

  if (permission === "unsupported") {
    return (
      <p className="text-sm text-muted-foreground">
        Notifications aren’t supported in this browser.
      </p>
    );
  }

  if (permission === "granted") {
    return (
      <p className="flex items-center gap-2 text-sm text-success">
        <Check className="h-4 w-4" /> Notified when a lecture finishes processing.
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

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Get notified when a lecture finishes processing (or fails), even if you’ve
        switched tabs.
      </p>
      <Button size="sm" variant="secondary" onClick={handleEnable}>
        <Bell className="h-4 w-4" /> Enable notifications
      </Button>
    </div>
  );
}
