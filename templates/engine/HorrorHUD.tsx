// Horror Engine v3: Opt-in Remotion DOM Narrative HUD overlay (rendered crisply above WebGL motion blur & DOF).
// Includes: top timestamp header & fiction badge, color-coded speaker pill + black-outlined Vietnamese subtitles with
// yellow keyword highlights, upper-third synced Phone3D notification card, ticking clock time-skip card, and choice CTA.

import React from "react";
import { clamp01 } from "./camera";
import type {
  HorrorHudConfig,
  HudCaption,
  HudChoiceCard,
  HudNotification,
  HudTimeSkip,
} from "./manifest";

export type { HorrorHudConfig, HudCaption, HudChoiceCard, HudNotification, HudTimeSkip };

export type ActiveHudState = {
  caption: HudCaption | null;
  notification: HudNotification | null;
  timeSkip: (HudTimeSkip & { clockDisplay: string; progress: number }) | null;
  choiceCard: HudChoiceCard | null;
};

const parseHHMM = (s: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

const formatHHMM = (mins: number): string => {
  const wrapped = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** Pure frame evaluator for active HUD elements (directly unit-tested). */
export function evalActiveHud(config: HorrorHudConfig, frame: number): ActiveHudState {
  const caption = config.captions?.find((c) => frame >= c.a && frame < c.b) ?? null;
  const notification = config.notifications?.find((n) => frame >= n.a && frame < n.b) ?? null;
  const rawSkip = config.timeSkips?.find((ts) => frame >= ts.a && frame < ts.b) ?? null;

  let timeSkip: ActiveHudState["timeSkip"] = null;
  if (rawSkip) {
    const span = Math.max(1, rawSkip.b - rawSkip.a - 1);
    const progress = clamp01((frame - rawSkip.a) / span);
    const m0 = parseHHMM(rawSkip.clockFrom);
    const m1 = parseHHMM(rawSkip.clockTo);
    const clockDisplay =
      m0 !== null && m1 !== null
        ? formatHHMM(m0 + (m1 - m0) * progress)
        : progress < 0.5
        ? rawSkip.clockFrom
        : rawSkip.clockTo;
    timeSkip = { ...rawSkip, clockDisplay, progress };
  }

  const choiceCard =
    config.choiceCard && frame >= config.choiceCard.a && frame < config.choiceCard.b
      ? config.choiceCard
      : null;

  return { caption, notification, timeSkip, choiceCard };
}

function renderHighlightedText(text: string, highlights: string[] = []): React.ReactNode {
  if (!highlights.length) return text;
  const escaped = highlights.filter(Boolean).map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return text;
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);
  return parts.map((part, i) => {
    const isHit = highlights.some((h) => h.toLowerCase() === part.toLowerCase());
    return isHit ? (
      <span key={i} style={{ color: "#ffd868" }}>
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    );
  });
}

export const HorrorHUD: React.FC<{
  config: HorrorHudConfig;
  frame: number;
  width: number;
  height: number;
}> = ({ config, frame, width, height }) => {
  const s = Math.min(width, height) / 1080;
  const active = evalActiveHud(config, frame);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        fontFamily: "'Inter', 'Noto Sans', 'Segoe UI', system-ui, sans-serif",
        color: "#f4f2ee",
        overflow: "hidden",
      }}
    >
      {/* Top-left timestamp/location header & top-right fiction badge */}
      {config.header && (
        <div
          style={{
            position: "absolute",
            top: 40 * s,
            left: 44 * s,
            right: 44 * s,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 38 * s,
                fontWeight: 800,
                letterSpacing: 1 * s,
                textShadow: `0 ${3 * s}px ${10 * s}px rgba(0,0,0,0.85)`,
              }}
            >
              {config.header.title}
            </div>
            {config.header.subtitle && (
              <div
                style={{
                  fontSize: 25 * s,
                  fontWeight: 500,
                  opacity: 0.88,
                  marginTop: 4 * s,
                  textShadow: `0 ${2 * s}px ${8 * s}px rgba(0,0,0,0.85)`,
                }}
              >
                {config.header.subtitle}
              </div>
            )}
          </div>
          {config.header.badge && (
            <div
              style={{
                padding: `${10 * s}px ${22 * s}px`,
                borderRadius: 999,
                border: `${2 * s}px solid rgba(255,255,255,0.62)`,
                background: "rgba(8, 8, 14, 0.56)",
                fontSize: 22 * s,
                fontWeight: 700,
                letterSpacing: 0.8 * s,
              }}
            >
              {config.header.badge}
            </div>
          )}
        </div>
      )}

      {/* Upper-third synced Phone3D notification banner */}
      {active.notification && (
        <div
          style={{
            position: "absolute",
            top: 196 * s,
            left: 46 * s,
            right: 46 * s,
            background: "rgba(246, 245, 240, 0.97)",
            color: "#12131a",
            borderRadius: 24 * s,
            padding: `${24 * s}px ${30 * s}px`,
            border: `${3 * s}px solid #09080f`,
            boxShadow: `0 ${14 * s}px ${36 * s}px rgba(0,0,0,0.55)`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 * s }}>
            <span style={{ fontSize: 26 * s, fontWeight: 700, color: "#3d404c" }}>{active.notification.sender}</span>
            <span style={{ fontSize: 25 * s, fontWeight: 800, color: "#b92a32" }}>{active.notification.time}</span>
          </div>
          <div style={{ fontSize: 34 * s, fontWeight: 800, lineHeight: 1.28 }}>{active.notification.body}</div>
          {active.notification.footer && (
            <div
              style={{
                marginTop: 14 * s,
                paddingTop: 12 * s,
                borderTop: `${2 * s}px dashed rgba(185, 42, 50, 0.55)`,
                fontSize: 25 * s,
                fontWeight: 800,
                color: "#b92a32",
              }}
            >
              {active.notification.footer}
            </div>
          )}
        </div>
      )}

      {/* Dark full-screen ticking clock time-skip overlay */}
      {active.timeSkip && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(6, 6, 10, 0.86)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 132 * s, fontWeight: 900, letterSpacing: 6 * s, color: "#f6f1e4" }}>
            {active.timeSkip.clockDisplay}
          </div>
          <div style={{ fontSize: 36 * s, fontWeight: 700, letterSpacing: 4 * s, color: "#d8b97a", marginTop: 18 * s }}>
            {active.timeSkip.label}
          </div>
        </div>
      )}

      {/* Bottom dialogue speaker pill + bold crisp black-outlined subtitle */}
      {active.caption && !active.timeSkip && (
        <div
          style={{
            position: "absolute",
            left: 52 * s,
            right: 52 * s,
            bottom: Math.round(height * 0.22),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          {active.caption.speaker && (
            <div
              style={{
                background: active.caption.speakerColor ?? "#f4f2ee",
                color: "#0b0a10",
                padding: `${6 * s}px ${22 * s}px`,
                borderRadius: 999,
                border: `${3 * s}px solid #09080f`,
                fontSize: 25 * s,
                fontWeight: 900,
                letterSpacing: 0.6 * s,
                marginBottom: 14 * s,
                boxShadow: `0 ${4 * s}px ${14 * s}px rgba(0,0,0,0.65)`,
              }}
            >
              {active.caption.speaker}
            </div>
          )}
          <div
            style={{
              fontSize: 44 * s,
              fontWeight: 900,
              lineHeight: 1.24,
              color: "#ffffff",
              WebkitTextStroke: `${2.2 * s}px #08070d`,
              paintOrder: "stroke fill",
              textShadow: `0 ${4 * s}px ${14 * s}px rgba(0,0,0,0.92), 0 0 ${4 * s}px #08070d`,
            }}
          >
            {renderHighlightedText(active.caption.text, active.caption.highlight)}
          </div>
        </div>
      )}

      {/* Optional interactive ending choice card */}
      {active.choiceCard && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(6, 6, 10, 0.78)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: `${40 * s}px`,
          }}
        >
          <div style={{ fontSize: 28 * s, fontWeight: 700, color: "#c2c6d4", letterSpacing: 2 * s }}>
            {active.choiceCard.header}
          </div>
          <div style={{ fontSize: 64 * s, fontWeight: 900, marginTop: 12 * s, marginBottom: 40 * s, textAlign: "center" }}>
            {active.choiceCard.question}
          </div>
          <div style={{ display: "flex", gap: 24 * s }}>
            <div
              style={{
                padding: `${20 * s}px ${42 * s}px`,
                borderRadius: 18 * s,
                background: "#c83838",
                color: "#ffffff",
                fontSize: 34 * s,
                fontWeight: 900,
                border: `${3 * s}px solid #09080f`,
              }}
            >
              {active.choiceCard.options[0]}
            </div>
            <div
              style={{
                padding: `${20 * s}px ${42 * s}px`,
                borderRadius: 18 * s,
                background: "#3c72d8",
                color: "#ffffff",
                fontSize: 34 * s,
                fontWeight: 900,
                border: `${3 * s}px solid #09080f`,
              }}
            >
              {active.choiceCard.options[1]}
            </div>
          </div>
          {active.choiceCard.prompt && (
            <div style={{ fontSize: 26 * s, marginTop: 28 * s, opacity: 0.85 }}>{active.choiceCard.prompt}</div>
          )}
        </div>
      )}
    </div>
  );
};
