"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { QuoteSource } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { sourceBadge } from "@/lib/source-badge";

interface Suggestion {
  slug: string;
  name: string;
  source: QuoteSource | null;
  status: string;
}

export function FandomSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/universes?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        const ready: Suggestion[] = (data.universes ?? []).filter(
          (u: Suggestion) => u.status === "READY",
        );
        setSuggestions(ready);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function startBuild(name: string) {
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch("/api/universes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      if (data.status === "failed") {
        setError(data.reason ?? `Couldn't build "${name}" — try another fandom.`);
        return;
      }
      router.push(`/play/${data.slug}`);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBuilding(false);
    }
  }

  function selectExisting(slug: string) {
    setOpen(false);
    router.push(`/play/${slug}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed || building) return;
    const exact = suggestions.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    if (exact) {
      selectExisting(exact.slug);
    } else {
      startBuild(trimmed);
    }
  }

  const hasExactMatch = suggestions.some((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  const showDropdown = open && trimmed.length >= 2 && (searching || suggestions.length > 0 || !hasExactMatch);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <form onSubmit={onSubmit}>
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setError(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Type a fandom…"
          disabled={building}
          aria-label="Search for a fandom"
          className="h-14 rounded-full border-2 border-arena-violet/40 bg-card px-6 text-lg focus-visible:border-arena-violet-hot focus-visible:ring-4 focus-visible:ring-arena-violet-hot/20"
        />
      </form>

      {showDropdown && (
        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl bg-popover ring-1 ring-foreground/10 shadow-xl">
          {searching && <p className="px-5 py-3 text-sm text-muted-foreground">Searching…</p>}

          {!searching &&
            suggestions.map((s) => {
              const badge = sourceBadge(s.source);
              return (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => selectExisting(s.slug)}
                  className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-muted"
                >
                  <span className="font-display text-lg">{s.name}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-medium tracking-wide uppercase ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </button>
              );
            })}

          {!searching && !hasExactMatch && (
            <button
              type="button"
              onClick={() => startBuild(trimmed)}
              disabled={building}
              className="flex w-full items-center justify-between border-t border-border px-5 py-3 text-left text-arena-cyan transition-colors hover:bg-muted disabled:opacity-50"
            >
              <span className="font-display text-lg">Build &quot;{trimmed}&quot;</span>
              <span className="text-xs text-muted-foreground">
                {building ? "Building…" : "→"}
              </span>
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-center text-sm text-arena-danger">{error}</p>}
      {building && !error && (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Building your arena — this can take a minute…
        </p>
      )}
    </div>
  );
}
