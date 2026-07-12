"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Purely a client-side illusion of progress — the backend reports no
// intermediate build phase, so these are generic broadcast-style lines
// templated with the fandom name, not a real status feed.
function flavorLines(name: string): string[] {
  return [
    `Digging through ${name}'s archives…`,
    "Separating real quotes from fan fiction…",
    `Sizing up the cast of ${name}…`,
    "Cross-referencing who said what…",
    "Sharpening the roast…",
    "Picking fights worth having…",
  ];
}

export function RotatingStatusLine({ name }: { name: string }) {
  const [index, setIndex] = useState(0);
  const lines = flavorLines(name);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % lines.length);
    }, 2500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  return (
    <div className="flex h-6 items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
          className="text-sm text-muted-foreground"
        >
          {lines[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
