import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { ArrowLeft, ArrowUpRight, Check, ShieldCheck } from 'lucide-react';
import { NarraxMark, PoweredByBadge, THEME } from '../theme';
import { AmbientBackdrop, AnimatedCursor, SceneCaptionBadge } from '../components/Effects';

export const AccessScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Step progression across 135 frames:
  // 0-42: Step 1 (Sign in with Privy)
  // 42-90: Step 2 (Reserve early access)
  // 90-135: Step 3 (You're in · Early access active)
  const stepIndex = frame < 42 ? 1 : frame < 90 ? 2 : 3;

  const panelEnter = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 100 },
  });

  const stepTransition = spring({
    frame: frame - (stepIndex === 2 ? 42 : stepIndex === 3 ? 90 : 0),
    fps,
    config: { damping: 16, stiffness: 120 },
  });

  const orbitAngle = frame * 1.4;

  return (
    <AbsoluteFill>
      <AmbientBackdrop accentColor="rgba(162,206,0,0.08)" secondaryColor="rgba(80,200,255,0.06)" />

      <div
        style={{
          width: 1720,
          height: 930,
          margin: '34px auto 0',
          borderRadius: 24,
          border: `1px solid ${THEME.bdStrong}`,
          background: THEME.bg,
          boxShadow: '0 40px 120px rgba(0,0,0,0.85)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: THEME.fontBody,
          color: THEME.tx,
          transform: `scale(${interpolate(panelEnter, [0, 1], [0.95, 1])})`,
        }}
      >
        {/* Browser Chrome */}
        <div
          style={{
            height: 42,
            background: '#0a0a0d',
            borderBottom: `1px solid ${THEME.bd}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 18px',
          }}
        >
          <div style={{ display: 'flex', gap: 7 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#3a3a44' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#3a3a44' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#3a3a44' }} />
          </div>
          <div
            style={{
              margin: '0 auto',
              padding: '4px 20px',
              borderRadius: 999,
              background: THEME.s1,
              border: `1px solid ${THEME.bd}`,
              fontFamily: THEME.fontMono,
              fontSize: 11.5,
              color: THEME.tx2,
            }}
          >
            narrax.ai/early-access
          </div>
        </div>

        {/* Two-column Early Access Layout */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 1.12fr',
            gap: 64,
            padding: '54px 88px',
            alignItems: 'center',
          }}
        >
          {/* Left Column: Access Heading & Orbital Emblem */}
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                color: THEME.tx2,
                fontSize: 13,
                marginBottom: 18,
              }}
            >
              <ArrowLeft size={14} /> Back to Narrax
            </div>
            <div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '5px 12px',
                  borderRadius: 8,
                  background: THEME.s1,
                  border: `1px solid ${THEME.bd}`,
                  fontFamily: THEME.fontMono,
                  fontSize: 11,
                  color: THEME.pos,
                  marginBottom: 16,
                }}
              >
                EARLY ACCESS & LOGIN
              </span>
            </div>
            <h1
              style={{
                fontSize: 50,
                fontWeight: 500,
                lineHeight: 1.08,
                letterSpacing: '-0.035em',
                margin: 0,
              }}
            >
              See the narrative
              <br />
              <span style={{ color: THEME.tx2 }}>before the crowd does.</span>
            </h1>
            <p
              style={{
                fontSize: 16,
                color: THEME.tx2,
                lineHeight: 1.65,
                margin: '18px 0 32px',
                maxWidth: 460,
              }}
            >
              AI-ranked narratives and token research on NEAR. Sign in via Privy with email or Google and
              reserve an early-access seat. No wallet connection is requested.
            </p>

            {/* Orbital Emblem */}
            <div
              style={{
                position: 'relative',
                width: 220,
                height: 220,
                margin: '16px 0 28px 40px',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: `1px solid ${THEME.bdStrong}`,
                  transform: `rotate(${orbitAngle}deg)`,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: -5,
                    left: '50%',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: THEME.pos,
                    boxShadow: `0 0 12px ${THEME.pos}`,
                  }}
                />
              </div>
              <div
                style={{
                  position: 'absolute',
                  inset: 30,
                  borderRadius: '50%',
                  border: `1px dashed ${THEME.bd}`,
                  transform: `rotate(${-orbitAngle * 0.7}deg)`,
                }}
              />
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 26,
                  border: `1px solid ${THEME.bdStrong}`,
                  background: `linear-gradient(${THEME.panelTop}, ${THEME.panelBottom})`,
                  boxShadow: '0 0 60px rgba(162,206,0,0.16)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <NarraxMark size={46} />
              </div>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                color: THEME.tx2,
                fontSize: 13,
              }}
            >
              <ShieldCheck size={17} color={THEME.pos} />
              <span>No wallet connection, transaction or seed phrase is ever requested.</span>
            </div>
          </div>

          {/* Right Column: Interactive Access Stage */}
          <div
            style={{
              borderRadius: 24,
              border: `1px solid ${THEME.bdStrong}`,
              background: `linear-gradient(155deg, ${THEME.s2}, ${THEME.bgPanel})`,
              padding: '32px 38px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}
          >
            {/* Panel Label + Stepper */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: THEME.fontMono,
                fontSize: 11.5,
                color: THEME.tx2,
                marginBottom: 22,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: THEME.pos,
                  }}
                />
                YOUR WORKSPACE ACCESS
              </span>
              <span>0{stepIndex} — 03</span>
            </div>

            {/* Stepper Pills */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
              {[
                { num: 1, label: 'Sign in' },
                { num: 2, label: 'Reserve access' },
                { num: 3, label: 'Join & Open' },
              ].map((s) => {
                const active = stepIndex === s.num;
                const done = stepIndex > s.num;
                return (
                  <div
                    key={s.num}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 14px',
                      borderRadius: 999,
                      border: `1px solid ${active ? THEME.pos : done ? THEME.bdStrong : THEME.bd}`,
                      background: active ? 'rgba(162,206,0,0.08)' : THEME.s1,
                      fontSize: 13,
                      color: active || done ? THEME.tx : THEME.tx2,
                    }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: done ? THEME.pos : THEME.s3,
                        color: done ? THEME.bg : THEME.tx,
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {done ? <Check size={13} /> : s.num}
                    </span>
                    <span>{s.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Dynamic Step Card Content */}
            <div
              style={{
                opacity: interpolate(stepTransition, [0, 1], [0.3, 1]),
                transform: `translateY(${interpolate(stepTransition, [0, 1], [12, 0])}px)`,
                minHeight: 340,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              {stepIndex === 1 && (
                <div>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 16,
                      border: `1px solid ${THEME.bdStrong}`,
                      background: THEME.s1,
                      display: 'grid',
                      placeItems: 'center',
                      marginBottom: 18,
                    }}
                  >
                    <ShieldCheck size={24} color={THEME.pos} />
                  </div>
                  <h2 style={{ fontSize: 28, margin: '0 0 10px' }}>Your research starts here.</h2>
                  <p style={{ fontSize: 14.5, color: THEME.tx2, margin: '0 0 22px', lineHeight: 1.6 }}>
                    Sign in securely with Privy using email or Google. No external wallet is needed,
                    then verify ownership to unlock your workspace.
                  </p>
                  <div style={{ display: 'grid', gap: 10, marginBottom: 22 }}>
                    <div
                      style={{
                        padding: '14px 20px',
                        borderRadius: 999,
                        background: THEME.tx,
                        color: THEME.bg,
                        fontWeight: 600,
                        fontSize: 14.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                      }}
                    >
                      Continue with Privy Sign-In <ArrowUpRight size={16} />
                    </div>
                  </div>
                  <div
                    style={{
                      borderTop: `1px solid ${THEME.bd}`,
                      paddingTop: 16,
                      display: 'grid',
                      gap: 8,
                      fontSize: 12.5,
                      color: THEME.tx2,
                    }}
                  >
                    <div>✓ Read-only research. Nothing here places a live trade.</div>
                    <div>✓ Protected by a Privy session. No chain challenge.</div>
                  </div>
                </div>
              )}

              {stepIndex === 2 && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                    }}
                  >
                    <h2 style={{ fontSize: 25, margin: 0 }}>Read before you sign.</h2>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        border: `1px solid ${THEME.bdStrong}`,
                        fontFamily: THEME.fontMono,
                        fontSize: 11,
                        color: THEME.pos,
                      }}
                    >
                      7xKX…9fQp Connected
                    </span>
                  </div>
                  <p style={{ fontSize: 13.5, color: THEME.tx2, margin: '0 0 14px' }}>
                    This confirms an early-access grant for research only. It authorizes no
                    transaction.
                  </p>
                  <pre
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      background: THEME.bg,
                      border: `1px solid ${THEME.bdStrong}`,
                      fontFamily: THEME.fontMono,
                      fontSize: 11.5,
                      color: THEME.tx,
                      lineHeight: 1.55,
                      margin: '0 0 16px',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {`NARRAX EARLY ACCESS\nAccount: you@example.com\nScope: Research access only\nStatus: ACTIVE\nIssued: 2026-11-08T11:00:00Z`}
                  </pre>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: 13,
                      color: THEME.tx2,
                      marginBottom: 18,
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        background: THEME.pos,
                        color: THEME.bg,
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 700,
                      }}
                    >
                      ✓
                    </span>
                    <span>Join early access from this account</span>
                  </div>
                  <div
                    style={{
                      padding: '13px 22px',
                      borderRadius: 999,
                      background: THEME.tx,
                      color: THEME.bg,
                      fontWeight: 600,
                      fontSize: 14,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Check size={16} /> Reserve seat
                  </div>
                </div>
              )}

              {stepIndex === 3 && (
                <div>
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 16,
                      border: `1px solid ${THEME.pos}`,
                      background: 'rgba(162,206,0,0.12)',
                      display: 'grid',
                      placeItems: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <Check size={28} color={THEME.pos} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: 999,
                        border: `1px solid ${THEME.pos}`,
                        color: THEME.pos,
                        fontFamily: THEME.fontMono,
                        fontSize: 11.5,
                        fontWeight: 600,
                      }}
                    >
                      EARLY ACCESS ACTIVE
                    </span>
                    <span style={{ fontSize: 12.5, color: THEME.tx2 }}>
                      Research workspace available
                    </span>
                  </div>
                  <h2 style={{ fontSize: 30, margin: '0 0 10px' }}>You’re in.</h2>
                  <p style={{ fontSize: 14.5, color: THEME.tx2, margin: '0 0 24px', lineHeight: 1.6 }}>
                    Your research access is active. All 15 workspace modules — including Personal
                    Radar, Thesis Tracker, Agent & Admin — are unlocked.
                  </p>
                  <div
                    style={{
                      padding: '14px 26px',
                      borderRadius: 999,
                      background: THEME.pos,
                      color: THEME.bg,
                      fontWeight: 700,
                      fontSize: 15,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 10,
                      boxShadow: '0 0 36px rgba(162,206,0,0.35)',
                    }}
                  >
                    Open Narrax Workspace <ArrowUpRight size={18} />
                  </div>
                </div>
              )}

              {/* Footer inside card */}
              <div
                style={{
                  borderTop: `1px solid ${THEME.bd}`,
                  paddingTop: 14,
                  marginTop: 18,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                  color: THEME.tx2,
                }}
              >
                <span>Signed-in account: you@example.com</span>
                <PoweredByBadge compact />
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatedCursor
        waypoints={[
          { frame: 0, x: 1180, y: 540 },
          { frame: 32, x: 1220, y: 555, click: true },
          { frame: 78, x: 1060, y: 675, click: true },
          { frame: 118, x: 1100, y: 615, click: true },
        ]}
      />

      <SceneCaptionBadge
        step="02 / SIGN-IN & EARLY ACCESS"
        title="Privy Sign-In & Local Early Access"
        subtitle="Email or Google sign-in · No wallet connection or transaction"
      />
    </AbsoluteFill>
  );
};
