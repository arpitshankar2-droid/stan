import { ImageResponse } from "next/og";
import { getResultViewData } from "@/lib/result-data";
import { loadOgFonts } from "@/lib/og-font";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FALLBACK_GRADIENT = "linear-gradient(105deg, #7c3aed 10%, #22d3ee 90%)";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, fonts] = await Promise.all([getResultViewData(id), loadOgFonts()]);

  const fontList = [
    ...(fonts.archivoDisplay
      ? [{ name: "Archivo", data: fonts.archivoDisplay, weight: 800 as const, style: "italic" as const }]
      : []),
    ...(fonts.archivoBody
      ? [{ name: "Archivo", data: fonts.archivoBody, weight: 400 as const, style: "normal" as const }]
      : []),
  ];

  if (!data) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            background: "#07060e",
            color: "#f2f0fb",
            fontSize: 56,
            fontFamily: "Archivo",
            fontStyle: "italic",
            fontWeight: 800,
          }}
        >
          STAN
        </div>
      ),
      { ...size, fonts: fontList },
    );
  }

  const gradient = `linear-gradient(105deg, ${data.palette.from} 10%, ${data.palette.to} 90%)`;
  const roast = data.roast.length > 120 ? `${data.roast.slice(0, 117)}…` : data.roast;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#07060e",
          color: "#f2f0fb",
          fontFamily: "Archivo",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: -160,
            left: 300,
            width: 700,
            height: 500,
            background: gradient || FALLBACK_GRADIENT,
            opacity: 0.18,
            filter: "blur(120px)",
            borderRadius: 9999,
          }}
        />

        {/* left column: identity + score */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: 480,
            padding: "0 56px",
            position: "relative",
          }}
        >
          <span style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: "#8d86ab", fontWeight: 700 }}>
            STAN
          </span>
          <span
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: 34,
              fontStyle: "italic",
              fontWeight: 800,
              textTransform: "uppercase",
              backgroundImage: gradient,
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {data.universeName}
          </span>
          <span style={{ display: "flex", marginTop: 14, fontSize: 22, color: "#cfc7f2" }}>
            {data.playerName ?? "A Challenger"}
          </span>
          <span
            style={{
              display: "flex",
              marginTop: 4,
              fontSize: 140,
              lineHeight: 1,
              fontStyle: "italic",
              fontWeight: 800,
              backgroundImage: gradient,
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {data.score}/{data.total}
          </span>
        </div>

        <div style={{ display: "flex", width: 1, background: "#262045", margin: "64px 0" }} />

        {/* right column: tier, roast, stats, badge */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            padding: "0 56px",
            position: "relative",
          }}
        >
          <span
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "12px 36px",
              fontSize: 26,
              fontStyle: "italic",
              fontWeight: 800,
              textTransform: "uppercase",
              color: "#0b0714",
              background: gradient,
            }}
          >
            {data.tier}
          </span>
          <span style={{ display: "flex", marginTop: 28, fontSize: 24, fontStyle: "italic", lineHeight: 1.4, maxWidth: 560 }}>
            &ldquo;{roast}&rdquo;
          </span>
          <div style={{ display: "flex", marginTop: 36, gap: 48 }}>
            {[
              { label: "ACCURACY", value: `${data.accuracy}%` },
              { label: "STREAK", value: String(data.bestStreak) },
              { label: "SPEED", value: `${data.avgSpeedSec.toFixed(1)}s` },
            ].map((stat) => (
              <div key={stat.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ display: "flex", fontSize: 32, fontWeight: 800 }}>{stat.value}</span>
                <span style={{ display: "flex", marginTop: 4, fontSize: 14, letterSpacing: 2, color: "#8d86ab" }}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
          <span
            style={{
              display: "flex",
              alignSelf: "flex-start",
              marginTop: 32,
              padding: "6px 18px",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 1,
              textTransform: "uppercase",
              borderRadius: 9999,
              border: `1px solid ${data.badge.hex}`,
              color: data.badge.hex,
            }}
          >
            {data.badge.label}
          </span>
        </div>
      </div>
    ),
    { ...size, fonts: fontList },
  );
}
