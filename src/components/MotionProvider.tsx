"use client";

import { MotionConfig } from "framer-motion";

// A dedicated client boundary just for this context provider, rather than
// marking the whole root layout "use client" — children (Server Components)
// still render server-side; only this thin wrapper runs client-side.
// reducedMotion="user" makes every Framer Motion animation in the app
// (currently just RotatingStatusLine's cross-fade) respect the OS
// prefers-reduced-motion setting automatically, without threading a check
// through each animated component individually.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
