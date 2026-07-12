"use client";

import { useRef, useState } from "react";
import { FighterCard, CARD_WIDTH, CARD_HEIGHT, type FighterCardProps } from "@/components/result/FighterCard";

// The classic html-to-image failure point is fonts: without explicit
// embedding, exported text silently falls back to a system font because the
// canvas render can't reach the @font-face file. getFontEmbedCSS fetches and
// base64-inlines whatever fonts the captured node actually uses (self-hosted
// via next/font, so same-origin — no cross-origin font fetch to fail on).
export function DownloadCardButton(props: FighterCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(false);

  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    setError(false);
    try {
      const { toPng, getFontEmbedCSS } = await import("html-to-image");
      const fontEmbedCSS = await getFontEmbedCSS(cardRef.current);
      const dataUrl = await toPng(cardRef.current, {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        pixelRatio: 2,
        fontEmbedCSS,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `stan-${props.universeName.toLowerCase().replace(/\s+/g, "-")}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError(true);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      {/* Off-screen, not display:none — html-to-image needs the node
          actually laid out and rendered to capture it. Never visible. */}
      <div aria-hidden className="pointer-events-none fixed top-0 left-[-9999px]">
        <FighterCard ref={cardRef} {...props} />
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="rounded-full border border-border px-6 py-2.5 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
      >
        {downloading ? "Rendering…" : "Download card"}
      </button>
      {error && <p className="mt-2 text-xs text-arena-danger">Couldn&apos;t render the card — try again.</p>}
    </>
  );
}
