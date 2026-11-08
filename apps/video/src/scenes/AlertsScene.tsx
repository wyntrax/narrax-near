import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Bell, Radar, ShieldCheck, Sparkles } from 'lucide-react';
import { THEME } from '../theme';
import { AmbientBackdrop, SceneCaptionBadge } from '../components/Effects';
import { WorkspaceFrame } from '../components/WorkspaceFrame';

export const AlertsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 115 } });
  const opacity = interpolate(enter, [0, 1], [0.25, 1]);
  const translateY = interpolate(enter, [0, 1], [14, 0]);

  const alerts = [
    { icon: Radar, title: 'Radar match: Robotics narrative', body: 'Liquidity and holder conditions are supported by fresh observations.', tone: THEME.pos },
    { icon: ShieldCheck, title: 'Risk evidence updated', body: 'A token risk row changed. Inspect the recorded flags and timestamps.', tone: THEME.tx2 },
    { icon: Sparkles, title: 'Thesis conditions weakened', body: 'One condition is now unknown because its market observation is stale.', tone: THEME.tx2 },
    { icon: Bell, title: 'Early Radar: WATCH', body: 'A small-cap token passed the narrative gates with cautions flagged.', tone: THEME.tx },
  ];

  return (
    <AbsoluteFill>
      <AmbientBackdrop />
      <WorkspaceFrame activeMenu="alerts" urlPath="narrax.ai/app/alerts">
        <div style={{ padding: '26px 30px', opacity, transform: `translateY(${translateY}px)` }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
            <div>
              <h1 style={{ fontSize: 30, margin: 0, letterSpacing: '-0.03em' }}>Alerts</h1>
              <p style={{ margin: '8px 0 0', color: THEME.tx2, fontSize: 13.5 }}>
                In-app notifications from personal radar, thesis tracking and Early Radar.
              </p>
            </div>
            <span style={{ fontFamily: THEME.fontMono, fontSize: 11.5, color: THEME.tx3 }}>4 unread</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
            <div style={{ display: 'grid', gap: 12 }}>
              {alerts.map(({ icon: Icon, title, body, tone }) => (
                <div key={title} style={{ display: 'flex', gap: 14, padding: 18, borderRadius: 16, border: `1px solid ${THEME.bd}`, background: THEME.s1 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: THEME.s2, color: tone, flexShrink: 0 }}>
                    <Icon size={18} />
                  </span>
                  <div>
                    <b style={{ fontSize: 14 }}>{title}</b>
                    <p style={{ margin: '6px 0 0', color: THEME.tx2, fontSize: 12.5, lineHeight: 1.55 }}>{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: 20, borderRadius: 18, border: `1px solid ${THEME.bd}`, background: THEME.s1, height: 'fit-content' }}>
              <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>Notification rules</h2>
              <p style={{ color: THEME.tx2, fontSize: 12.5, lineHeight: 1.7, margin: 0 }}>
                Choose a minimum priority and mute alert kinds you do not need. Critical alerts are always delivered.
                Personal radar matches and thesis changes are scoped to your own account.
              </p>
              <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
                {['Research only', 'No orders or positions', 'Evidence timestamps retained'].map((line) => (
                  <div key={line} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: THEME.tx2 }}>
                    <ShieldCheck size={14} color={THEME.pos} /> {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </WorkspaceFrame>
      <SceneCaptionBadge
        step="05 / ALERTS"
        title="Personal radar matches, thesis changes and Early Radar calls"
        subtitle="Research notifications with priority, timestamps and evidence links"
      />
    </AbsoluteFill>
  );
};
