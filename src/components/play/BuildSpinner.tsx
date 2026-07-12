import type { FandomPalette } from "@/lib/fandom-palette";

// Indeterminate on purpose — the backend gives no granular build progress
// (only BUILDING/READY/FAILED), so a real percentage would be fabricated.
export function BuildSpinner({ palette }: { palette: FandomPalette }) {
  return (
    <div className="relative size-16" role="status" aria-label="Building">
      <div
        className="absolute inset-0 animate-spin rounded-full"
        style={{
          background: `conic-gradient(from 0deg, transparent 0%, ${palette.from} 50%, ${palette.to} 100%)`,
        }}
      />
      <div className="absolute inset-[5px] rounded-full bg-background" />
    </div>
  );
}
