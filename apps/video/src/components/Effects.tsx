import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { THEME } from '../theme';

export const AmbientBackdrop: React.FC<{
  accentColor?: string;
  secondaryColor?: string;
}> = ({ accentColor = 'rgba(255,255,255,0.07)', secondaryColor = 'rgba(162,206,0,0.05)' }) => {
  const frame = useCurrentFrame();
  const shiftX = Math.sin(frame * 0.015) * 40;
  const shiftY = Math.cos(frame * 0.012) * 25;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: THEME.bg,
        overflow: 'hidden',
      }}
    >
      {/* Subtle radial glow top */}
      <div
        style={{
          position: 'absolute',
          inset: -200,
          background: `
            radial-gradient(ellipse 65% 520px at ${50 + shiftX * 0.1}% ${12 + shiftY * 0.1}%, ${accentColor}, transparent 70%),
            radial-gradient(ellipse 50% 440px at ${75 - shiftX * 0.12}% ${82 - shiftY * 0.1}%, ${secondaryColor}, transparent 70%)
          `,
        }}
      />
      {/* Vignette frame */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,0.65) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

export const SceneCaptionBadge: React.FC<{
  step: string;
  title: string;
  subtitle: string;
  accent?: string;
}> = ({ step, title, subtitle, accent = THEME.pos }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame: frame - 4,
    fps,
    config: { damping: 18, stiffness: 120 },
  });

  const y = interpolate(enter, [0, 1], [36, 0]);
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 34,
        left: 48,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 22px 12px 14px',
        borderRadius: 999,
        background: 'rgba(13, 13, 16, 0.95)',
        border: `1px solid ${THEME.bdStrong}`,
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        transform: `translateY(${y}px)`,
        opacity,
        fontFamily: THEME.fontBody,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.06)',
          border: `1px solid ${THEME.bd}`,
          fontFamily: THEME.fontMono,
          fontSize: 11,
          letterSpacing: '0.08em',
          color: THEME.tx,
          textTransform: 'uppercase',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: accent,
            boxShadow: `0 0 10px ${accent}`,
          }}
        />
        {step}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <strong style={{ color: THEME.tx, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {title}
        </strong>
        <span style={{ color: THEME.tx2, fontSize: 13 }}>{subtitle}</span>
      </div>
    </div>
  );
};

export const AnimatedCursor: React.FC<{
  waypoints: Array<{ frame: number; x: number; y: number; click?: boolean }>;
}> = ({ waypoints }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (waypoints.length === 0) return null;

  let currentX = waypoints[0].x;
  let currentY = waypoints[0].y;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    if (frame >= start.frame && frame <= end.frame) {
      const progress = spring({
        frame: frame - start.frame,
        fps,
        durationInFrames: Math.max(1, end.frame - start.frame),
        config: { damping: 22, stiffness: 110 },
      });
      currentX = interpolate(progress, [0, 1], [start.x, end.x]);
      currentY = interpolate(progress, [0, 1], [start.y, end.y]);
      break;
    } else if (frame > end.frame) {
      currentX = end.x;
      currentY = end.y;
    }
  }

  const activeClick = waypoints.find(
    (w) => w.click && frame >= w.frame && frame <= w.frame + 18
  );
  const clickProgress = activeClick
    ? (frame - activeClick.frame) / 18
    : 0;
  const cursorScale = activeClick
    ? interpolate(clickProgress, [0, 0.3, 1], [1, 0.82, 1])
    : 1;

  return (
    <div
      style={{
        position: 'absolute',
        left: currentX,
        top: currentY,
        zIndex: 100,
        pointerEvents: 'none',
        transform: `translate(-4px, -4px) scale(${cursorScale})`,
      }}
    >
      {activeClick && (
        <div
          style={{
            position: 'absolute',
            left: -22,
            top: -22,
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: `2px solid ${THEME.pos}`,
            opacity: interpolate(clickProgress, [0, 1], [0.95, 0]),
            transform: `scale(${interpolate(clickProgress, [0, 1], [0.3, 1.85])})`,
          }}
        />
      )}
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path
          d="M5.5 3.5L22.5 12.2L14.2 14.8L11.2 23L5.5 3.5Z"
          fill="#FFFFFF"
          stroke="#050609"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
