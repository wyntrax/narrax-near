import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { ArrowUp, ShieldCheck, Sparkles, User } from 'lucide-react';
import { THEME } from '../theme';
import { AmbientBackdrop, AnimatedCursor, SceneCaptionBadge } from '../components/Effects';
import { WorkspaceFrame } from '../components/WorkspaceFrame';

export const AnalyticsAgentScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 0 - 50: Analytics (/app/analytics)
  // 100 - 150: Research Agent (/app/agent)
  const stage: 'analytics' | 'agent' = frame < 75 ? 'analytics' : 'agent';

  const localFrame = frame < 75 ? frame : frame - 75;
  const enter = spring({
    frame: localFrame,
    fps,
    config: { damping: 18, stiffness: 115 },
  });

  const opacity = interpolate(enter, [0, 1], [0.25, 1]);
  const translateY = interpolate(enter, [0, 1], [14, 0]);

  return (
    <AbsoluteFill>
      <AmbientBackdrop accentColor="rgba(157,123,255,0.08)" secondaryColor="rgba(162,206,0,0.06)" />

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
          {stage === 'analytics' && (
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
                    Analytics
                  </h1>
                  <p style={{ fontSize: 14, color: THEME.tx2, margin: '6px 0 0' }}>
                    What happened after past agent decisions. Every number carries its sample size,
                    and thin samples say so.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span
                    style={{
                      padding: '7px 14px',
                      borderRadius: 10,
                      border: `1px solid ${THEME.pos}`,
                      background: 'rgba(162,206,0,0.08)',
                      fontSize: 12.5,
                      color: THEME.pos,
                    }}
                  >
                    Decision action: BUY ▾
                  </span>
                  <span
                    style={{
                      padding: '7px 14px',
                      borderRadius: 10,
                      border: `1px solid ${THEME.bdStrong}`,
                      background: THEME.s1,
                      fontSize: 12.5,
                    }}
                  >
                    Window: Last 30 days ▾
                  </span>
                </div>
              </div>

              {/* 6 Decision Analytics Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
                {[
                  { label: 'Decisions in window', value: '184' },
                  { label: 'Independent decisions', value: '142' },
                  { label: 'Known 24h results', value: '128' },
                  { label: 'Measurement pending', value: '14' },
                  { label: 'Unavailable rate', value: '4.2%' },
                  { label: 'WIN / LOSS / FLAT', value: '82 / 31 / 15' },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      padding: '13px 14px',
                      borderRadius: 14,
                      border: `1px solid ${THEME.bd}`,
                      background: THEME.s1,
                    }}
                  >
                    <div style={{ fontSize: 11, color: THEME.tx2 }}>{m.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6 }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Decisions by Confidence Table */}
              <div
                style={{
                  borderRadius: 16,
                  border: `1px solid ${THEME.bd}`,
                  background: THEME.s1,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 0.8fr 0.9fr 0.9fr 0.9fr 1fr 1.1fr',
                    padding: '11px 18px',
                    background: THEME.s2,
                    borderBottom: `1px solid ${THEME.bd}`,
                    fontFamily: THEME.fontMono,
                    fontSize: 10.5,
                    color: THEME.tx2,
                    textTransform: 'uppercase',
                  }}
                >
                  <span>Group</span>
                  <span>Sample (n)</span>
                  <span>Distinct tokens</span>
                  <span>Mean 24h</span>
                  <span>Median 24h</span>
                  <span>Positive-return rate</span>
                  <span>Evidence gate</span>
                </div>
                {[
                  ['All BUY decisions', '128', '64', '+18.42%', '+11.80%', '64.1%', 'Enough to compare'],
                  ['Confidence ≥ 80%', '46', '29', '+27.90%', '+19.40%', '73.9%', 'Enough to compare'],
                  ['Confidence 65% – 79%', '58', '38', '+14.15%', '+9.20%', '60.3%', 'Enough to compare'],
                  ['Confidence < 65%', '24', '19', '+6.40%', '+2.10%', '50.0%', 'Too few to conclude'],
                ].map((row, idx) => (
                  <div
                    key={row[0]}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.5fr 0.8fr 0.9fr 0.9fr 0.9fr 1fr 1.1fr',
                      padding: '12px 18px',
                      borderBottom: idx < 3 ? `1px solid ${THEME.bd}` : 'none',
                      fontSize: 13,
                    }}
                  >
                    <strong>{row[0]}</strong>
                    <span>{row[1]}</span>
                    <span>{row[2]}</span>
                    <b style={{ color: THEME.pos }}>{row[3]}</b>
                    <span style={{ color: THEME.pos }}>{row[4]}</span>
                    <b>{row[5]}</b>
                    <span
                      style={{
                        color: row[6].startsWith('Enough') ? THEME.pos : THEME.amber,
                        fontSize: 12,
                      }}
                    >
                      {row[6]}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          

          {stage === 'agent' && (
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
                    Agent
                  </h1>
                  <p style={{ fontSize: 14, color: THEME.tx2, margin: '6px 0 0' }}>
                    Ask the research assistant about narratives, tokens and signals. It explains
                    data; it cannot trade.
                  </p>
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 14px',
                    borderRadius: 999,
                    background: THEME.s1,
                    border: `1px solid ${THEME.bdStrong}`,
                    fontSize: 12,
                    color: THEME.tx2,
                  }}
                >
                  <ShieldCheck size={15} color={THEME.pos} />
                  <span>Research assistant · No trades. No settings changed.</span>
                </div>
              </div>

              {/* Conversation Thread */}
              <div style={{ display: 'grid', gap: 12 }}>
                {/* User Turn */}
                <div
                  style={{
                    padding: '14px 18px',
                    borderRadius: 16,
                    border: `1px solid ${THEME.bdStrong}`,
                    background: `linear-gradient(135deg, ${THEME.s2}, ${THEME.s1})`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <User size={14} color={THEME.pos} />
                    <b style={{ fontSize: 12.5 }}>You</b>
                  </div>
                  <div style={{ fontSize: 14 }}>
                    Which narratives are accelerating right now, and what risks should I check on
                    $NRXAI before relying on its score?
                  </div>
                </div>

                {/* Assistant Turn */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: 16,
                    border: `1px solid ${THEME.bd}`,
                    background: THEME.s1,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sparkles size={15} color={THEME.pos} />
                      <b style={{ fontSize: 13 }}>Assistant</b>
                    </div>
                    <span
                      style={{
                        fontFamily: THEME.fontMono,
                        fontSize: 11,
                        color: THEME.pos,
                        padding: '3px 10px',
                        borderRadius: 99,
                        border: `1px solid ${THEME.bdStrong}`,
                      }}
                    >
                      Research tools used · 3 (getNarratives, getTokenDetail, getTokenDetail)
                    </span>
                  </div>
                  <p style={{ fontSize: 13.5, color: THEME.tx, lineHeight: 1.6, margin: '0 0 10px' }}>
                    1. <b>Autonomous NEAR Agents</b> leads accelerating narratives (Score 91.4,
                    velocity +18.6, 86.2% organic score across 14 tokens), followed by{' '}
                    <b>On-Chain Orderbook Perps</b> (Score 79.8).
                    <br />
                    2. On <b>$NRXAI</b> ($4.82M MC, $642K liquidity), holder concentration is 24.8% and the latest risk row is fresh. However, check two recorded caveats:
                    Two tokens have stale holder observations and stay explicitly unknown.
                  </p>
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: THEME.bg,
                      border: `1px solid ${THEME.bd}`,
                      fontSize: 12,
                      color: THEME.tx2,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>
                      <b>Suggested monitor:</b> Personal Radar on narrative{' '}
                      <code>autonomous-near-agents</code> with min liquidity $250K & ≥4 net buyers.
                    </span>
                    <span style={{ color: THEME.tx3 }}>Shown for information · Nothing changed</span>
                  </div>
                </div>
              </div>

              {/* Chat Composer */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 16,
                  border: `1px solid ${THEME.bdStrong}`,
                  background: THEME.s1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, color: THEME.tx3 }}>
                  Ask about a narrative, token, or market observation... (Ctrl / Cmd + Enter to send)
                </span>
                <span
                  style={{
                    padding: '6px 14px',
                    borderRadius: 999,
                    background: THEME.tx,
                    color: THEME.bg,
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <ArrowUp size={14} /> Send
                </span>
              </div>
            </>
          )}
        </div>
      </WorkspaceFrame>

      <AnimatedCursor
        waypoints={[
          { frame: 0, x: 180, y: 462, click: true },
          { frame: 28, x: 960, y: 510 },
          { frame: 50, x: 180, y: 494, click: true },
          { frame: 78, x: 1120, y: 475 },
          { frame: 100, x: 180, y: 526, click: true },
          { frame: 130, x: 1260, y: 550 },
        ]}
      />

      <SceneCaptionBadge
        step={stage === 'analytics' ? '06A / DECISION ANALYTICS' : '06B / AI RESEARCH AGENT'}
        title={
          stage === 'analytics'
            ? '24h Post-Decision Outcome Measurement & Sample Sufficiency'
            : 'Read-Only Research Assistant Grounded in Live Research Tools'
        }
        subtitle={
          stage === 'analytics'
            ? 'Transparent sample sizes, deduplicated independent observations & win/loss/flat bands'
            : 'Explains narratives, tokens and risks without executing trades or altering settings'
        }
      />
    </AbsoluteFill>
  );
};
