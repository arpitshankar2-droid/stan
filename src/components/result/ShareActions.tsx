"use client";

import { useState } from "react";

export function ShareActions({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user cancelled, or the platform declined — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — nothing more to do here without a login-free
      // fallback UI; the URL is still visible in the address bar
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="font-display rounded-full bg-arena-gradient px-6 py-2.5 text-sm text-primary-foreground"
    >
      {copied ? "Link copied!" : "Share"}
    </button>
  );
}
