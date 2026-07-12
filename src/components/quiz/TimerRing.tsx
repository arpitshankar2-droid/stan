"use client";

import { useEffect, useRef, useState } from "react";
import type { FandomPalette } from "@/lib/fandom-palette";

const SIZE = 56;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Props {
  palette: FandomPalette;
  durationMs: number;
  questionKey: string;
  paused: boolean;
  onExpire: () => void;
}

// Draining conic-style ring per PLAN.md's Neon Arena notes — same visual
// language as the Task 8 BuildSpinner, but determinate. A CSS transition
// drives the drain (cheap, no per-frame JS); a single setTimeout fires the
// timeout callback, cleared the moment the question is answered. The
// seconds number is what makes the ring legible on its own — a bare
// spinning ring communicates nothing (user feedback: "worse than nothing").
export function TimerRing({ palette, durationMs, questionKey, paused, onExpire }: Props) {
  const circleRef = useRef<SVGCircleElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(durationMs / 1000));

  useEffect(() => {
    if (paused) return;
    const el = circleRef.current;
    if (!el) return;

    el.style.transition = "none";
    el.style.strokeDashoffset = "0";
    void el.getBoundingClientRect(); // force reflow so the reset registers before animating
    el.style.transition = `stroke-dashoffset ${durationMs}ms linear`;
    el.style.strokeDashoffset = String(CIRCUMFERENCE);

    setSecondsLeft(Math.ceil(durationMs / 1000));
    const start = Date.now();
    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((durationMs - (Date.now() - start)) / 1000));
      setSecondsLeft(remaining);
    }, 200);

    const timer = setTimeout(onExpire, durationMs);
    return () => {
      clearTimeout(timer);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, durationMs, questionKey]);

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
        <circle
          ref={circleRef}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={`url(#timer-gradient-${questionKey})`}
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={0}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id={`timer-gradient-${questionKey}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="10%" stopColor={palette.from} />
            <stop offset="90%" stopColor={palette.to} />
          </linearGradient>
        </defs>
      </svg>
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-sm text-foreground"
        aria-label={`${secondsLeft} seconds remaining`}
      >
        {secondsLeft}
      </span>
    </div>
  );
}
