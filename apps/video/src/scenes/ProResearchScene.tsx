import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { THEME } from '../theme';
import { AmbientBackdrop, AnimatedCursor, SceneCaptionBadge } from '../components/Effects';
import { WorkspaceFrame } from '../components/WorkspaceFrame';

export const ProResearchScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 0 - 48: Personal Radar (/app/personal-radar)
  // 48 - 96: Thesis Tracker (/app/theses)
  // 96 - 145: Personal Briefing (/app/briefing)
  const stage: 'personalRadar' | 'theses' | 'briefing' =
    frame < 48 ? 'personalRadar' : frame < 96 ? 'theses' : 'briefing';

  const localFrame = frame < 48 ? frame : frame < 96 ? frame - 48 : frame - 96;
  const enter = spring({
    frame: localFrame,
    fps,
    config: { damping: 18, stiffness: 115 },
  });

  const opacity = interpolate(enter, [0, 1], [0.25, 1]);
  const translateY = interpolate(enter, [0, 1], [14, 0]);

  return (
    <AbsoluteFill>
      <AmbientBackdrop accentColor="rgba(162,206,0,0.09)" secondaryColor="rgba(80,200,255,0.07)" />

      <WorkspaceFrame activeMenu={stage}>
        <div
          style={{
            opacity,
            transform: `translateY(${translateY}px)`,
            display: 'flex',
            flexDirection: 'column',
            gap: 15,
          }}
        >
          <div
            style={{
              fontFamily: THEME.fontMono,
              fontSize: 11,
              color: THEME.pos,
              letterSpacing: '0.08em',
            }}
          >
            NARRAX PRO · YOUR RESEARCH
          </div>

          {stage === 'personalRadar' && (
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
                    Personal Radar
                  </h1>
                  <p style={{ fontSize: 14, color: THEME.tx2, margin: '6px 0 0' }}>
                    Turn your criteria into a private research feed. Combine conditions, save a
                    radar, and get in-app alerts when observed evidence matches.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span
                    style={{
                      padding: '8px 16px',
                      borderRadius: 999,
                      border: `1px solid ${THEME.bdStrong}`,
                      background: THEME.s1,
                      fontSize: 12.5,
                    }}
                  >
                    Check now
                  </span>
                  <span
                    style={{
                      padding: '8px 18px',
                      borderRadius: 999,
                      background: THEME.tx,
                      color: THEME.bg,
                      fontSize: 12.5,
                      fontWeight: 600,
                    }}
                  >
                    + Create radar
                  </span>
                </div>
              </div>

              {/* Monitor Card */}
              <div
                style={{
                  padding: 20,
                  borderRadius: 18,
                  border: `1px solid ${THEME.pos}`,
                  background: THEME.s1,
                  display: 'grid',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ fontSize: 20, margin: 0 }}>
                      AI Agent Breakouts · High Organic Velocity
                    </h2>
                    <span style={{ fontSize: 12, color: THEME.tx2, fontFamily: THEME.fontMono }}>
                      Narrative slug: autonomous-near-agents · Window: 30m
                    </span>
                  </div>
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: 99,
                      border: `1px solid ${THEME.pos}`,
                      color: THEME.pos,
                      fontSize: 11.5,
                      height: 'fit-content',
                    }}
                  >
                    ● Monitoring (Every 5m)
                  </span>
                </div>

                {/* Rule Pills */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    ['Minimum liquidity (USD)', '$250,000'],
                    ['Minimum independent net buyers', '4 clusters'],
                    ['Minimum narrative velocity', '+10.0'],
                    ['Maximum recorded risk score', '35'],
                  ].map(([k, v]) => (
                    <span
                      key={k}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 99,
                        background: THEME.s2,
                        border: `1px solid ${THEME.bdStrong}`,
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: THEME.tx2 }}>{k}:</span>{' '}
                      <b style={{ color: THEME.tx }}>{v}</b>
                    </span>
                  ))}
                </div>

                {/* Evaluation Metrics + Evidence Pass List */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {[
                      { label: 'Tokens checked', value: '84' },
                      { label: 'Matched', value: '2' },
                      { label: 'Unknown', value: '5' },
                    ].map((m) => (
                      <div
                        key={m.label}
                        style={{
                          padding: '12px',
                          borderRadius: 12,
                          background: THEME.bg,
                          border: `1px solid ${THEME.bd}`,
                        }}
                      >
                        <div style={{ fontSize: 11, color: THEME.tx2 }}>{m.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: 12,
                      background: THEME.bg,
                      border: `1px solid ${THEME.bd}`,
                      fontSize: 12.5,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                      }}
                    >
                      <strong style={{ color: THEME.pos }}>
                        ✓ Radar match · $NRXAI (Agentic Mesh Protocol)
                      </strong>
                      <span style={{ color: THEME.tx3, fontSize: 11 }}>Evaluated 2m ago</span>
                    </div>
                    <div style={{ color: THEME.tx2 }}>
                      Liquidity: <b>Met ($642,910 / $250,000)</b> · Net buyers:{' '}
                      <b>Met (7 / 4 clusters)</b> · Velocity: <b>Met (+18.6 / +10)</b> · Risk:{' '}
                      <b>Met (22 / 35)</b>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {stage === 'theses' && (
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
                    Thesis Tracker
                  </h1>
                  <p style={{ fontSize: 14, color: THEME.tx2, margin: '6px 0 0' }}>
                    Write down your reasoning. Track the conditions that support it, weaken it, or
                    need more evidence.
                  </p>
                </div>
                <span
                  style={{
                    padding: '8px 18px',
                    borderRadius: 999,
                    background: THEME.tx,
                    color: THEME.bg,
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  + Create thesis
                </span>
              </div>

              <div
                style={{
                  padding: 20,
                  borderRadius: 18,
                  border: `1px solid ${THEME.bdStrong}`,
                  background: THEME.s1,
                  display: 'grid',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ fontSize: 20, margin: 0 }}>
                      $NRXAI Conviction Thesis — Smart-Money Accumulation + Liquidity Floor
                    </h2>
                    <p style={{ fontSize: 13.5, color: THEME.tx2, margin: '6px 0 0' }}>
                      “Thesis holds as long as Raydium pool liquidity stays above $400K, at least 5
                      independent token-activity clusters remain net buyers over 30m windows, and risk
                      flags stay below 30.”
                    </p>
                  </div>
                  <span
                    style={{
                      padding: '5px 12px',
                      borderRadius: 99,
                      border: `1px solid ${THEME.pos}`,
                      color: THEME.pos,
                      fontSize: 12,
                      height: 'fit-content',
                      fontWeight: 600,
                    }}
                  >
                    Conditions supported
                  </span>
                </div>

                {/* Condition Check Breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    {
                      check: 'Minimum liquidity (USD)',
                      status: 'Met',
                      val: '$642,910 / $400,000',
                      src: 'DEX Screener',
                    },
                    {
                      check: 'Independent net buyers',
                      status: 'Met',
                      val: '7 / 5 clusters (30m)',
                      src: 'NEAR market observations',
                    },
                    {
                      check: 'Narrative velocity',
                      status: 'Met',
                      val: '+18.6 / +12.0',
                      src: 'Narrative Worker',
                    },
                    {
                      check: 'Maximum risk score',
                      status: 'Met',
                      val: '22.0 / 30.0',
                      src: 'Risk Evaluator',
                    },
                  ].map((c) => (
                    <div
                      key={c.check}
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        background: THEME.bg,
                        border: `1px solid ${THEME.bd}`,
                      }}
                    >
                      <div style={{ fontSize: 11.5, color: THEME.tx2 }}>{c.check}</div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: THEME.pos,
                          margin: '6px 0 4px',
                        }}
                      >
                        ✓ {c.status} · {c.val}
                      </div>
                      <div style={{ fontSize: 11, color: THEME.tx3 }}>Source: {c.src}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {stage === 'briefing' && (
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
                    Personal Briefing
                  </h1>
                  <p style={{ fontSize: 14, color: THEME.tx2, margin: '6px 0 0' }}>
                    What changed in your research? Your radar matches and thesis observations,
                    together in a daily evidence-linked briefing.
                  </p>
                </div>
                <span
                  style={{
                    padding: '8px 16px',
                    borderRadius: 999,
                    border: `1px solid ${THEME.bdStrong}`,
                    background: THEME.s1,
                    fontSize: 12.5,
                  }}
                >
                  Check now
                </span>
              </div>

              {/* Daily Briefing Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Radar alert matches · 24h', value: '5' },
                  { label: 'Thesis changes · 24h', value: '2' },
                  { label: 'Latest items with unknown evidence', value: '1' },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 14,
                      border: `1px solid ${THEME.bd}`,
                      background: THEME.s1,
                    }}
                  >
                    <div style={{ fontSize: 11.5, color: THEME.tx2 }}>{m.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>{m.value}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  padding: 20,
                  borderRadius: 18,
                  border: `1px solid ${THEME.bd}`,
                  background: THEME.s1,
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 16 }}>
                    2026-11-08 · Daily Briefing (Last 24h Evidence Linked)
                  </strong>
                  <span style={{ fontFamily: THEME.fontMono, fontSize: 11.5, color: THEME.pos }}>
                    Full coverage · 0 capped samples
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      background: THEME.bg,
                      border: `1px solid ${THEME.bd}`,
                    }}
                  >
                    <div style={{ fontSize: 12, color: THEME.pos, fontWeight: 600 }}>
                      RADAR MATCH · AI Agent Breakouts
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, margin: '4px 0' }}>
                      $NRXAI & $ZKPW passed all 4 evidence checks
                    </div>
                    <div style={{ fontSize: 12, color: THEME.tx2 }}>
                      Refs: obs_99281a, market_ref_77c, risk_eval_401
                    </div>
                  </div>
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      background: THEME.bg,
                      border: `1px solid ${THEME.bd}`,
                    }}
                  >
                    <div style={{ fontSize: 12, color: THEME.amber, fontWeight: 600 }}>
                      THESIS STATUS SHIFT · DePIN Sensor Mesh
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, margin: '4px 0' }}>
                      Previous: Conditions supported → Current: Conditions weakened
                    </div>
                    <div style={{ fontSize: 12, color: THEME.tx2 }}>
                      Independent net buyers fell to 2 / 4 required in 30m window.
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </WorkspaceFrame>

      <AnimatedCursor
        waypoints={[
          { frame: 0, x: 180, y: 590, click: true },
          { frame: 26, x: 920, y: 470 },
          { frame: 48, x: 180, y: 622, click: true },
          { frame: 74, x: 840, y: 480 },
          { frame: 96, x: 180, y: 654, click: true },
          { frame: 125, x: 980, y: 520 },
        ]}
      />

      <SceneCaptionBadge
        step={
          stage === 'personalRadar'
            ? '07A / PERSONAL RADAR (PRO)'
            : stage === 'theses'
            ? '07B / THESIS TRACKER (PRO)'
            : '07C / PERSONAL BRIEFING (PRO)'
        }
        title={
          stage === 'personalRadar'
            ? 'Custom Multi-Condition Research Feeds Evaluated Every 5 Minutes'
            : stage === 'theses'
            ? 'Hypothesis Monitoring: Supported, Weakened or Uncertain Evidence'
            : 'Daily Evidence-Linked Briefing Across Radars & Theses'
        }
        subtitle={
          stage === 'personalRadar'
            ? 'Filter by minimum liquidity, independent net buyers, narrative velocity & max risk score'
            : stage === 'theses'
            ? 'Write down your rationale and automatically verify every underlying on-chain condition'
            : 'Summarizes 24h radar matches, thesis status shifts & missing evidence references'
        }
      />
    </AbsoluteFill>
  );
};
