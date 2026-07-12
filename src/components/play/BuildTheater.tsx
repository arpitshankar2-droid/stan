"use client";

import { useEffect, useState } from "react";
import { fandomPalette, fandomGradientStyle } from "@/lib/fandom-palette";
import { BuildSpinner } from "@/components/play/BuildSpinner";
import { RotatingStatusLine } from "@/components/play/RotatingStatusLine";
import { Quiz } from "@/components/quiz/Quiz";
import type { ClientQuestion } from "@/lib/quiz/duel";

type Status = "building" | "ready" | "failed";

interface Props {
  slug: string;
  initialStatus: Status;
  initialName: string;
  initialFailReason: string | null;
}

const POLL_INTERVAL_MS = 2500;

export function BuildTheater({ slug, initialStatus, initialName, initialFailReason }: Props) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [name, setName] = useState(initialName);
  const [failReason, setFailReason] = useState<string | null>(initialFailReason);
  const [retrying, setRetrying] = useState(false);
  const [universeId, setUniverseId] = useState<string | null>(null);
  const [scrapedRatio, setScrapedRatio] = useState(0);
  const [quiz, setQuiz] = useState<ClientQuestion[] | null>(null);

  useEffect(() => {
    if (status !== "building") return;
    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/universes/${slug}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "ready") {
          setName(data.universe?.name ?? name);
          setUniverseId(data.universe?.id ?? null);
          setScrapedRatio(data.universe?.scrapedRatio ?? 0);
          setQuiz(data.quiz?.questions ?? null);
          setStatus("ready");
        } else if (data.status === "failed") {
          setFailReason(data.reason ?? null);
          setStatus("failed");
        }
        // status === "building": nothing to do, keep polling
      } catch {
        // transient network hiccup — keep polling rather than flipping to failed
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, slug]);

  // Covers the OTHER path into "ready": the server component already knew
  // this universe was READY from its own direct DB read (no build to poll
  // for), so there's no poll transition above to piggyback the quiz payload
  // on — fetch it once, here, on mount.
  useEffect(() => {
    if (initialStatus !== "ready") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/universes/${slug}`);
        const data = await res.json();
        if (cancelled || data.status !== "ready") return;
        setUniverseId(data.universe?.id ?? null);
        setScrapedRatio(data.universe?.scrapedRatio ?? 0);
        setQuiz(data.quiz?.questions ?? null);
      } catch {
        // the retry/rebuild affordances live on the failed state; a failed
        // fetch here just leaves the loading placeholder up
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function retry() {
    setRetrying(true);
    setFailReason(null);
    try {
      const res = await fetch("/api/universes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setStatus("building");
      } else {
        const data = await res.json().catch(() => ({}));
        setFailReason(data.error ?? "Something went wrong. Try again.");
      }
    } catch {
      setFailReason("Something went wrong. Try again.");
    } finally {
      setRetrying(false);
    }
  }

  const palette = fandomPalette(slug);
  const nameStyle = fandomGradientStyle(palette);

  if (status === "ready") {
    if (!quiz || !universeId) {
      return (
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="font-display text-[clamp(2.5rem,8vw,5rem)] leading-none" style={nameStyle}>
            {name}
          </h1>
          <BuildSpinner palette={palette} />
        </div>
      );
    }
    return <Quiz universeId={universeId} palette={palette} scrapedRatio={scrapedRatio} questions={quiz} />;
  }

  if (status === "failed") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="font-display text-[clamp(2rem,6vw,3.5rem)] leading-none text-arena-danger">
          Couldn&apos;t build {name}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          We couldn&apos;t put together a quiz for this one. Try again, or pick another fandom.
        </p>
        {failReason && (
          <p className="max-w-sm text-xs text-muted-foreground/60">{failReason}</p>
        )}
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="font-display rounded-full bg-arena-gradient px-6 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {retrying ? "Retrying…" : "Retry"}
          </button>
          <a
            href="/"
            className="rounded-full border border-border px-6 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Try another fandom
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <h1 className="font-display text-[clamp(2.5rem,8vw,5rem)] leading-none" style={nameStyle}>
        {name}
      </h1>
      <BuildSpinner palette={palette} />
      <RotatingStatusLine name={name} />
      <p className="font-mono text-xs tracking-widest text-muted-foreground/60">
        USUALLY UNDER A MINUTE
      </p>
    </div>
  );
}
