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

export const MarketDiscoveryScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 0 - 50: Opportunities (/app/opportunities)
  // 50 - 100: Tokens (/app/tokens)
  // 75 - 150: Tokens & screener
  const stage: 'opportunities' | 'tokens' = frame < 75 ? 'opportunities' : 'tokens';

  const localFrame = frame < 50 ? frame : frame < 100 ? frame - 50 : frame - 100;
  const enter = spring({
    frame: localFrame,
    fps,
    config: { damping: 18, stiffness: 115 },
  });

  const opacity = interpolate(enter, [0, 1], [0.25, 1]);
  const translateY = interpolate(enter, [0, 1], [14, 0]);

  return (
    <AbsoluteFill>
      <AmbientBackdrop accentColor="rgba(80,200,255,0.08)" secondaryColor="rgba(162,206,0,0.06)" />

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
          {stage === 'opportunities' && (
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
                    Opportunities
                  </h1>
                  <p style={{ fontSize: 14, color: THEME.tx2, margin: '6px 0 0' }}>
                    Review recorded research ideas: the narrative behind a token, the model’s
                    assessment and the evidence you still need.
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
                  Open token screener ↗
                </span>
              </div>

              {/* Idea Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {[
                  {
                    sym: 'NRXAI',
                    name: 'Agentic Mesh Protocol',
                    narrative: 'Autonomous NEAR Agents · Accelerating',
                    decision: 'BUY · 84% confidence',
                    score: '89.6',
                    selected: true,
                  },
                  {
                    sym: 'ZKPW',
                    name: 'ZeroProof Verifier',
                    narrative: 'ZK Verifiable Compute · Emerging',
                    decision: 'WATCH · 76% confidence',
                    score: '82.4',
                    selected: false,
                  },
                  {
                    sym: 'OBDX',
                    name: 'Orderbook Liquidity Engine',
                    narrative: 'On-Chain Orderbook Perps · Accelerating',
                    decision: 'BUY · 79% confidence',
                    score: '78.9',
                    selected: false,
                  },
                ].map((idea) => (
                  <div
                    key={idea.sym}
                    style={{
                      padding: 18,
                      borderRadius: 18,
                      border: `1px solid ${idea.selected ? THEME.pos : THEME.bd}`,
                      background: `linear-gradient(145deg, ${THEME.s2}, ${THEME.bg})`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <strong style={{ fontSize: 22 }}>{idea.sym}</strong>
                        <small style={{ display: 'block', color: THEME.tx2, fontSize: 12 }}>
                          {idea.name}
                        </small>
                      </div>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 99,
                          border: `1px solid ${THEME.bdStrong}`,
                          fontSize: 11,
                          height: 'fit-content',
                          color: THEME.pos,
                        }}
                      >
                        Score {idea.score}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: THEME.tx2 }}>{idea.narrative}</div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        paddingTop: 8,
                        borderTop: `1px solid ${THEME.bd}`,
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: THEME.tx2 }}>Recorded decision</span>
                      <b style={{ color: THEME.pos }}>{idea.decision}</b>
                    </div>
                  </div>
                ))}
              </div>

              {/* 6-Dimension Score Breakdown & Bull/Bear/Risk Panel */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 16 }}>
                <div
                  style={{
                    padding: 20,
                    borderRadius: 18,
                    border: `1px solid ${THEME.bd}`,
                    background: THEME.s1,
                  }}
                >
                  <h3 style={{ fontSize: 16, margin: '0 0 14px' }}>
                    Score breakdown · NRXAI ($0.0482 · $4.82M MC)
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    {[
                      { label: 'Narrative', val: 92 },
                      { label: 'Token activity', val: 88 },
                      { label: 'Liquidity', val: 85 },
                      { label: 'Momentum', val: 91 },
                      { label: 'OG score', val: 94 },
                      { label: 'Risk (low is safer)', val: 22 },
                    ].map((s) => (
                      <div key={s.label}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: 12,
                            marginBottom: 5,
                          }}
                        >
                          <span style={{ color: THEME.tx2 }}>{s.label}</span>
                          <b>{s.val}</b>
                        </div>
                        <div
                          style={{
                            height: 5,
                            borderRadius: 4,
                            background: THEME.s3,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${s.val}%`,
                              height: '100%',
                              background: s.label.startsWith('Risk') ? THEME.amber : THEME.pos,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    padding: 20,
                    borderRadius: 18,
                    border: `1px solid ${THEME.bd}`,
                    background: THEME.s1,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 16,
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: 15, color: THEME.pos, margin: '0 0 8px' }}>
                      Supporting case (Bull)
                    </h3>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 16,
                        fontSize: 12,
                        color: THEME.tx2,
                        lineHeight: 1.55,
                      }}
                    >
                      <li>7 independent tracked token-activity entities accumulated +410 NEAR net.</li>
                      <li>Primary OG token in Autonomous NEAR Agents narrative (94 OG score).</li>
                      <li>Pool liquidity verified at $640K on Raydium with 1.8x daily turnover.</li>
                    </ul>
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, color: THEME.amber, margin: '0 0 8px' }}>
                      Counter-case & Guardrails
                    </h3>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 16,
                        fontSize: 12,
                        color: THEME.tx2,
                        lineHeight: 1.55,
                      }}
                    >
                      <li>Top 10 holders control 24.8% of supply; monitor unlock clusters.</li>
                      <li>Invalidation if 6h net token-activity flow drops below -85 NEAR.</li>
                      <li>Risk flags stay visible; missing evidence is marked unknown.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}

          {stage === 'tokens' && (
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
                    Tokens · NRXAI / Agentic Mesh Protocol
                  </h1>
                  <p style={{ fontSize: 13, color: THEME.tx2, margin: '6px 0 0', fontFamily: THEME.fontMono }}>
                    Mint: NRXAim9v2LpK8xQw7eR4tY6uJ1oP3sD5fG8hJ2kL9mN · Source: DEX Screener (Fresh)
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span
                    style={{
                      padding: '7px 14px',
                      borderRadius: 999,
                      border: `1px solid ${THEME.bdStrong}`,
                      fontSize: 12,
                    }}
                  >
                    DEX Screener ↗
                  </span>
                  <span
                    style={{
                      padding: '7px 14px',
                      borderRadius: 999,
                      border: `1px solid ${THEME.bdStrong}`,
                      fontSize: 12,
                    }}
                  >
                    NearBlocks ↗
                  </span>
                </div>
              </div>

              {/* 4 Token Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { label: 'Price (USD)', value: '$0.0482', delta: '+34.8% (24h)' },
                  { label: 'Market cap (USD)', value: '$4,820,400', delta: 'Reported MC' },
                  { label: 'Liquidity (USD)', value: '$642,910', delta: 'Raydium CLMM' },
                  { label: 'Volume, 24h (USD)', value: '$1,184,200', delta: '1.84x turnover' },
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
                    <div style={{ fontSize: 25, fontWeight: 600, marginTop: 4 }}>{m.value}</div>
                    <div style={{ fontSize: 11, color: THEME.pos, marginTop: 2 }}>{m.delta}</div>
                  </div>
                ))}
              </div>

              {/* Source-Linked Price Observation Chart + Holder evidence */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 16 }}>
                <div
                  style={{
                    padding: 20,
                    borderRadius: 18,
                    border: `1px solid ${THEME.bd}`,
                    background: THEME.s1,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}
                  >
                    <strong style={{ fontSize: 15 }}>
                      Price and events · 148 source-linked observations
                    </strong>
                    <span style={{ fontFamily: THEME.fontMono, fontSize: 11, color: THEME.pos }}>
                      +34.82% observed window
                    </span>
                  </div>
                  <svg viewBox="0 0 680 180" style={{ width: '100%', height: 175 }}>
                    {[35, 85, 135].map((y) => (
                      <path
                        key={y}
                        d={`M0 ${y} H680`}
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="1"
                      />
                    ))}
                    <path
                      d="M10 150 L75 144 L140 138 L210 124 L275 130 L340 96 L410 82 L475 64 L540 52 L605 38 L665 26"
                      fill="none"
                      stroke={THEME.pos}
                      strokeWidth="2.5"
                    />
                    <circle cx={665} cy={26} r={5} fill={THEME.pos} />
                  </svg>
                  <div style={{ fontSize: 11.5, color: THEME.tx3 }}>
                    Lines connect recorded DEX Screener observations, never fabricated candles.
                  </div>
                </div>

                {/* Issuers, Holders & Consensus */}
                <div
                  style={{
                    padding: 20,
                    borderRadius: 18,
                    border: `1px solid ${THEME.bd}`,
                    background: THEME.s1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: 16, margin: '0 0 12px' }}>
                      Holder structure evidence
                    </h3>
                    <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                      {[
                        ['Top-10 holder share', '24.8%'],
                        ['Top 10 holders (%)', '24.80%'],
                        ['Holder count', '1,240'],
                        ['Independent entities', '7 clusters'],
                        ['Fresh risk flags', '1 warning'],
                        ['Net token-activity flow (24h)', '+412.50 NEAR'],
                      ].map(([k, v]) => (
                        <div
                          key={k}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            paddingBottom: 6,
                            borderBottom: `1px solid ${THEME.bd}`,
                          }}
                        >
                          <span style={{ color: THEME.tx2 }}>{k}</span>
                          <b style={{ color: v.startsWith('+') ? THEME.pos : THEME.tx }}>{v}</b>
                        </div>
                      ))}
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
          { frame: 0, x: 180, y: 300, click: true },
          { frame: 25, x: 520, y: 380 },
          { frame: 50, x: 180, y: 332, click: true },
          { frame: 78, x: 780, y: 540 },
          { frame: 100, x: 180, y: 365, click: true },
          { frame: 130, x: 1120, y: 490 },
        ]}
      />

      <SceneCaptionBadge
        step={stage === 'opportunities' ? '04A / OPPORTUNITIES' : '04B / TOKENS & SCREENER'}
        title={
          stage === 'opportunities'
            ? 'Opportunity Score Breakdown, Bull/Bear Cases & Risk Guardrails'
            : 'Source-Linked DEX Screener Observations & Holder evidence'
        }
        subtitle={
          stage === 'opportunities'
            ? 'Discover a thesis ? Evaluate the evidence ? Verify the market'
            : 'Holder distribution, liquidity and fresh risk flags'
        }
      />
    </AbsoluteFill>
  );
};
