import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { ArrowUpRight } from 'lucide-react';
import { NarraxMark, PoweredByBadge, THEME } from '../theme';
import { AmbientBackdrop, AnimatedCursor, SceneCaptionBadge } from '../components/Effects';
import { WorkspaceFrame } from '../components/WorkspaceFrame';

export const SettingsAdminOutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 0 - 48: Settings (/app/settings)
  // 48 - 98: Admin (/app/admin)
  // 98 - 145: Brand Finale Outro
  const stage: 'settings' | 'admin' | 'outro' =
    frame < 48 ? 'settings' : frame < 98 ? 'admin' : 'outro';

  const localFrame = frame < 48 ? frame : frame < 98 ? frame - 48 : frame - 98;
  const enter = spring({
    frame: localFrame,
    fps,
    config: { damping: 18, stiffness: 110 },
  });

  if (stage === 'outro') {
    const scale = interpolate(enter, [0, 1], [0.88, 1]);
    const opacity = interpolate(enter, [0, 1], [0, 1]);

    return (
      <AbsoluteFill>
        <AmbientBackdrop
          accentColor="rgba(162,206,0,0.14)"
          secondaryColor="rgba(255,255,255,0.08)"
        />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontFamily: THEME.fontBody,
            color: THEME.tx,
            transform: `scale(${scale})`,
            opacity,
            padding: '0 40px',
          }}
        >
          <div
            style={{
              width: 108,
              height: 108,
              borderRadius: 30,
              border: `1px solid ${THEME.pos}`,
              background: `radial-gradient(ellipse at 30% 0, rgba(162,206,0,0.28), transparent 68%), linear-gradient(${THEME.panelTop}, ${THEME.panelBottom})`,
              boxShadow: '0 0 80px rgba(162,206,0,0.25)',
              display: 'grid',
              placeItems: 'center',
              marginBottom: 28,
            }}
          >
            <NarraxMark size={54} />
          </div>

          <span
            style={{
              fontFamily: THEME.fontMono,
              fontSize: 13,
              color: THEME.pos,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            NARRAX RESEARCH WORKSPACE ON NEAR
          </span>

          <h1
            style={{
              fontSize: 68,
              fontWeight: 600,
              lineHeight: 1.04,
              letterSpacing: '-0.04em',
              margin: '0 0 18px',
              maxWidth: 920,
            }}
          >
            The next story starts
            <br />
            <span style={{ color: THEME.tx2 }}>before the headlines.</span>
          </h1>

          <p
            style={{
              fontSize: 19,
              color: THEME.tx2,
              maxWidth: 620,
              margin: '0 0 34px',
              lineHeight: 1.6,
            }}
          >
            End-to-end narrative intelligence, local early-access grants, narrative and token evidence,
            and personalized Pro research.
          </p>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 38 }}>
            <div
              style={{
                padding: '15px 32px',
                borderRadius: 999,
                background: THEME.pos,
                color: THEME.bg,
                fontWeight: 700,
                fontSize: 16,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 0 44px rgba(162,206,0,0.35)',
              }}
            >
              Get early access <ArrowUpRight size={19} />
            </div>
            <div
              style={{
                padding: '15px 28px',
                borderRadius: 999,
                border: `1px solid ${THEME.bdStrong}`,
                background: THEME.s1,
                color: THEME.tx,
                fontSize: 15,
              }}
            >
              INDEPENDENT THINKING. BETTER CONTEXT.
            </div>
          </div>

          <PoweredByBadge />
        </div>
      </AbsoluteFill>
    );
  }

  const opacity = interpolate(enter, [0, 1], [0.25, 1]);
  const translateY = interpolate(enter, [0, 1], [14, 0]);

  return (
    <AbsoluteFill>
      <AmbientBackdrop />

      <WorkspaceFrame activeMenu={stage}>
        <div
          style={{
            opacity,
            transform: `translateY(${translateY}px)`,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {stage === 'settings' && (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  paddingBottom: 14,
                  borderBottom: `1px solid ${THEME.bd}`,
                }}
              >
                <div>
                  <h1 style={{ fontSize: 34, fontWeight: 500, margin: 0, letterSpacing: '-0.03em' }}>
                    Settings
                  </h1>
                  <p style={{ fontSize: 14, color: THEME.tx2, margin: '6px 0 0' }}>
                    Your display name, appearance and which alerts you receive.
                  </p>
                </div>
              </div>

              {/* Access Tier Banner */}
              <div
                style={{
                  padding: '18px 22px',
                  borderRadius: 16,
                  border: `1px solid ${THEME.pos}`,
                  background: THEME.s1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: THEME.fontMono,
                      fontSize: 10.5,
                      color: THEME.pos,
                      textTransform: 'uppercase',
                    }}
                  >
                    Access tier
                  </div>
                  <strong style={{ fontSize: 22, display: 'block', margin: '4px 0' }}>
                    Admin (full research access)
                  </strong>
                  <small style={{ color: THEME.tx2, fontSize: 12.5 }}>
                    Access comes from a local admin grant or an early-access seat.
                  </small>
                </div>
                <span
                  style={{
                    padding: '8px 16px',
                    borderRadius: 999,
                    border: `1px solid ${THEME.bdStrong}`,
                    background: THEME.s2,
                    fontSize: 12.5,
                  }}
                >
                  Refresh access
                </span>
              </div>

              {/* Profile, Appearance & Notification Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <div
                  style={{
                    padding: 20,
                    borderRadius: 18,
                    border: `1px solid ${THEME.bd}`,
                    background: THEME.s1,
                  }}
                >
                  <h3 style={{ fontSize: 17, margin: '0 0 12px' }}>Profile</h3>
                  <div style={{ display: 'grid', gap: 10, fontSize: 12.5 }}>
                    <div>
                      <span style={{ color: THEME.tx2, display: 'block', marginBottom: 4 }}>
                        Display name
                      </span>
                      <div
                        style={{
                          padding: '9px 12px',
                          borderRadius: 10,
                          background: THEME.bg,
                          border: `1px solid ${THEME.bdStrong}`,
                        }}
                      >
                        narrax_researcher.sol
                      </div>
                    </div>
                    <div>
                      <span style={{ color: THEME.tx2, display: 'block', marginBottom: 4 }}>
                        Time zone
                      </span>
                      <div
                        style={{
                          padding: '9px 12px',
                          borderRadius: 10,
                          background: THEME.bg,
                          border: `1px solid ${THEME.bdStrong}`,
                        }}
                      >
                        Asia/Jakarta (UTC+07:00)
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: 20,
                    borderRadius: 18,
                    border: `1px solid ${THEME.bd}`,
                    background: THEME.s1,
                  }}
                >
                  <h3 style={{ fontSize: 17, margin: '0 0 12px' }}>Appearance</h3>
                  <div style={{ display: 'grid', gap: 10, fontSize: 12.5 }}>
                    <div>
                      <span style={{ color: THEME.tx2, display: 'block', marginBottom: 4 }}>
                        Theme
                      </span>
                      <div
                        style={{
                          padding: '9px 12px',
                          borderRadius: 10,
                          background: THEME.bg,
                          border: `1px solid ${THEME.bdStrong}`,
                        }}
                      >
                        Dark (Graphite Glass) ▾
                      </div>
                    </div>
                    <div>
                      <span style={{ color: THEME.tx2, display: 'block', marginBottom: 4 }}>
                        Density
                      </span>
                      <div
                        style={{
                          padding: '9px 12px',
                          borderRadius: 10,
                          background: THEME.bg,
                          border: `1px solid ${THEME.bdStrong}`,
                        }}
                      >
                        Comfortable ▾
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: 20,
                    borderRadius: 18,
                    border: `1px solid ${THEME.bd}`,
                    background: THEME.s1,
                  }}
                >
                  <h3 style={{ fontSize: 17, margin: '0 0 12px' }}>Alerts & Notifications</h3>
                  <div style={{ display: 'grid', gap: 10, fontSize: 12.5 }}>
                    <div>
                      <span style={{ color: THEME.tx2, display: 'block', marginBottom: 4 }}>
                        Show alerts at or above
                      </span>
                      <div
                        style={{
                          padding: '9px 12px',
                          borderRadius: 10,
                          background: THEME.bg,
                          border: `1px solid ${THEME.bdStrong}`,
                        }}
                      >
                        Watch priority & above ▾
                      </div>
                    </div>
                    <div style={{ color: THEME.tx2, fontSize: 12, lineHeight: 1.5 }}>
                      ✓ Critical alerts (POSITION_MONITOR, SECURITY) are always delivered.
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {stage === 'admin' && (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  paddingBottom: 12,
                  borderBottom: `1px solid ${THEME.bd}`,
                }}
              >
                <div>
                  <h1 style={{ fontSize: 34, fontWeight: 500, margin: 0, letterSpacing: '-0.03em' }}>
                    Early access admin
                  </h1>
                  <p style={{ fontSize: 14, color: THEME.tx2, margin: '6px 0 0' }}>
                    Open early access, set the seat cap, manage feature access, and inspect
                    live data health & worker telemetry.
                  </p>
                </div>
              </div>

              {/* Admin Overview Bar */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.1fr 2fr',
                  gap: 16,
                  padding: 16,
                  borderRadius: 18,
                  border: `1px solid ${THEME.bd}`,
                  background: `linear-gradient(145deg, ${THEME.s2}, ${THEME.s1})`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 16px',
                    borderRadius: 14,
                    background: THEME.bg,
                    border: `1px solid ${THEME.pos}`,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: THEME.pos,
                      boxShadow: `0 0 10px ${THEME.pos}`,
                    }}
                  />
                  <div>
                    <b style={{ fontSize: 14, display: 'block' }}>Early access is open</b>
                    <small style={{ fontSize: 11.5, color: THEME.tx2 }}>
                      Accounts can join until the seat cap is reached
                    </small>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Seats used', value: '184' },
                    { label: 'Seats available', value: '66' },
                    { label: 'Seat cap', value: '250' },
                    { label: 'Active grants', value: '212' },
                  ].map((m) => (
                    <div
                      key={m.label}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: THEME.bg,
                        border: `1px solid ${THEME.bd}`,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: THEME.fontMono,
                          fontSize: 10,
                          color: THEME.tx3,
                          textTransform: 'uppercase',
                        }}
                      >
                        {m.label}
                      </div>
                      <div
                        style={{
                          fontFamily: THEME.fontMono,
                          fontSize: 22,
                          fontWeight: 600,
                          marginTop: 4,
                        }}
                      >
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin Tabs: Early access / Tiers & features / Research Data Health / Runtime */}
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  borderBottom: `1px solid ${THEME.bd}`,
                  paddingBottom: 8,
                }}
              >
                {['Early access', 'Research (Data health)', 'Runtime'].map(
                  (tab, i) => (
                    <span
                      key={tab}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 8,
                        background: i === 2 ? THEME.s2 : 'transparent',
                        borderBottom: i === 2 ? `2px solid ${THEME.pos}` : 'none',
                        fontSize: 12.5,
                        color: i === 2 ? THEME.tx : THEME.tx2,
                        fontWeight: i === 2 ? 600 : 400,
                      }}
                    >
                      {tab}
                    </span>
                  )
                )}
              </div>

              {/* Data Health & Worker Telemetry Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {[
                  {
                    title: 'Market & analysis coverage',
                    stat: 'Worker connected · NEAR RPC ready',
                    detail: '1,420 tokens observed · 412 holder snapshots · 38,940 price rows (30D)',
                  },
                  {
                    title: 'Market observations collector',
                    stat: 'Worker connected · 5m schedule',
                    detail: '482 fresh source-linked DEX Screener readings (<15m) · 0 unverified rows',
                  },
                  {
                    title: 'Opportunity analysis & queues',
                    stat: 'Worker connected · All queues healthy',
                    detail: 'Fast & reasoning models configured · Daily token budget 34% used · 0 failed jobs',
                  },
                ].map((c) => (
                  <div
                    key={c.title}
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      border: `1px solid ${THEME.bd}`,
                      background: THEME.s1,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{c.title}</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: THEME.pos,
                        fontFamily: THEME.fontMono,
                        marginBottom: 6,
                      }}
                    >
                      ● {c.stat}
                    </div>
                    <div style={{ fontSize: 12, color: THEME.tx2, lineHeight: 1.5 }}>
                      {c.detail}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </WorkspaceFrame>

      <AnimatedCursor
        waypoints={[
          { frame: 0, x: 180, y: 558, click: true },
          { frame: 28, x: 860, y: 460 },
          { frame: 48, x: 180, y: 686, click: true },
          { frame: 78, x: 640, y: 425, click: true },
        ]}
      />

      <SceneCaptionBadge
        step={stage === 'settings' ? '08A / ACCOUNT SETTINGS' : '08B / ADMIN & DATA HEALTH'}
        title={
          stage === 'settings'
            ? 'Profile, Graphite Glass Theme & Priority Alert Controls'
            : 'Early Access Grants, Feature Access & Pipeline Telemetry'
        }
        subtitle={
          stage === 'settings'
            ? 'Customize display name, timezone, density & notification thresholds'
            : 'Audit-logged seat caps, feature access matrices & real-time worker diagnostics'
        }
      />
    </AbsoluteFill>
  );
};
