"use client";

import { useState } from "react";

interface Props {
  path: string;
  title: string;
  // The message body — what actually gets copied alongside the link, and
  // what Web Share API's native sheet shows apps like WhatsApp use as the
  // pre-filled text. Defaults to `title` when omitted.
  text?: string;
  label?: string;
  variant?: "primary" | "outline-danger";
}

const VARIANT_CLASS: Record<NonNullable<Props["variant"]>, string> = {
  primary: "font-display bg-arena-gradient text-primary-foreground",
  "outline-danger": "border border-arena-danger/40 text-arena-danger hover:bg-arena-danger/10",
};

export function ShareActions({ path, title, text, label = "Share", variant = "primary" }: Props) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    const message = text ?? title;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: message, url });
        return;
      } catch {
        // user cancelled, or the platform declined — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(`${message}\n${url}`);
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
      className={`rounded-full px-6 py-2.5 text-sm transition-colors ${VARIANT_CLASS[variant]}`}
    >
      {copied ? "Link copied!" : label}
    </button>
  );
}
