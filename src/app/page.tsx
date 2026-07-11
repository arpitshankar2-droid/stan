export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[52rem] -translate-x-1/2 rounded-full bg-arena-gradient opacity-15 blur-[120px]"
      />

      <p className="font-mono text-xs tracking-[0.35em] text-muted-foreground">
        ROUND 0 / 10
      </p>

      <h1 className="font-display mt-4 text-[clamp(4rem,18vw,11rem)] leading-none text-arena-gradient text-glow-violet">
        Stan
      </h1>

      <p className="mt-6 max-w-md text-center text-lg text-muted-foreground">
        Pick a fandom. Ten quotes. Find out if you&apos;re a real one.
      </p>

      <div className="font-display clip-slash-both mt-10 bg-arena-gradient px-8 py-2 text-sm text-primary-foreground">
        Arena under construction
      </div>
    </main>
  );
}
