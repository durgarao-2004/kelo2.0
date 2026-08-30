"use client";

import * as React from "react";

/** Registers the app-shell service worker (see public/sw.js). Silent no-op
 * on unsupported browsers or any registration failure — installability is a
 * nice-to-have, never something that should surface as an error to users. */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
