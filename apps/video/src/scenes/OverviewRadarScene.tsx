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

export const OverviewRadarScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 0 - 70: Overview (/app)
  // 70 - 140: Narrative Radar (/app/radar)
  const isRadar = frame >= 70;

  const panelEnter = spring({
    frame: isRadar ? frame - 70 : frame,
    fps,
    config: { damping: 18, stiffness: 110 },
  });

  const contentOpacity = interpolate(panelEnter, [0, 1], [0.25, 1]);
  const contentY = interpolate(panelEnter, [0, 1], [14, 0]);

  return (
    <AbsoluteFill>
      <AmbientBackdrop />

      <WorkspaceFrame activeMenu={isRadar ? 'radar' : 'overview'}>
        <div
          style={{
            opacity: contentOpacity,
            transform: `translateY(${contentY}px)`,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {!isRadar ? (
            <>
              {/* Overview Heading */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  paddingBottom: 16,
                  borderBottom: `1px solid ${THEME.bd}`,
                }}
              >
                <div>
                  <h1 style={{ fontSize: 34, fontWeight: 500, margin: 0, letterSpacing: '-0.03em' }}>
                    A clearer view of the market.
                  </h1>
                  <p style={{ fontSize: 14.5, color: THEME.tx2, margin: '6px 0 0' }}>
                    Narratives, opportunities and your account activity in one research workspace.
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
                  Refresh
                </span>
              </div>

              {/* 6 Metric Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: 12,
                }}
              >
                {[
                  { label: 'Active narratives', value: '28' },
                  { label: 'Accelerating', value: '9' },
                  { label: 'Tokens observed', value: '1,420' },
                  { label: 'Opportunities, 24h', value: '38' },
                  { label: 'Early alerts, 24h', value: '12' },
                  { label: 'Unread notifications', value: '4' },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 14,
                      border: `1px solid ${THEME.bd}`,
                      background: `linear-gradient(150deg, ${THEME.s2}, ${THEME.s1})`,
                    }}
                  >
                    <div style={{ fontSize: 11, color: THEME.tx2 }}>{m.label}</div>
                    <div
                      style={{
                        fontSize: 26,
                        fontWeight: 600,
                        marginTop: 6,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Market Brief + Emerging Narratives Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: 18 }}>
                {/* Market Brief */}
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
                      marginBottom: 12,
                    }}
                  >
                    <h2 style={{ fontSize: 18, margin: 0 }}>Market brief</h2>
                    <span style={{ fontFamily: THEME.fontMono, fontSize: 11, color: THEME.tx3 }}>
                      Fixed-rule synthesis
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: THEME.tx3, margin: '0 0 12px' }}>
                    Generated from recorded facts using fixed rules.
                  </p>
                  <div style={{ display: 'grid', gap: 10, fontSize: 13.5, color: THEME.tx2, lineHeight: 1.55 }}>
                    <div
                      style={{
                        paddingLeft: 12,
                        borderLeft: `2px solid ${THEME.pos}`,
                        color: THEME.tx,
                      }}
                    >
                      9 narratives are in ACCELERATING stage; Autonomous AI Agents (+14.2 velocity)
                      and Verified Compute Mesh lead 24h social and market evidence.
                    </div>
                    <div style={{ paddingLeft: 12, borderLeft: `2px solid ${THEME.bdStrong}` }}>
                      Liquidity is concentrated across 6 emerging NEP-141 pools with
                      verified liquidity above $250K.
                    </div>
                    <div style={{ paddingLeft: 12, borderLeft: `2px solid ${THEME.bdStrong}` }}>
                      Attention rotation shows capital shifting from saturated meme forks into
                      infrastructure & agentic tooling narratives.
                    </div>
                  </div>
                </div>

                {/* Emerging Narratives Strip */}
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
                      alignItems: 'center',
                      marginBottom: 14,
                    }}
                  >
                    <h2 style={{ fontSize: 18, margin: 0 }}>Emerging narratives</h2>
                    <span style={{ fontSize: 12.5, color: THEME.pos }}>Open radar ↗</span>
                  </div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {[
                      {
                        name: 'Autonomous NEAR Agents',
                        stage: 'Accelerating',
                        score: '91.4',
                        vel: '+18.6',
                      },
                      {
                        name: 'ZK Verifiable Compute',
                        stage: 'Emerging',
                        score: '84.2',
                        vel: '+12.1',
                      },
                      {
                        name: 'On-Chain Orderbook Perps',
                        stage: 'Accelerating',
                        score: '79.8',
                        vel: '+9.4',
                      },
                    ].map((n) => (
                      <div
                        key={n.name}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.7fr 0.9fr 0.8fr 0.8fr auto',
                          alignItems: 'center',
                          padding: '13px 16px',
                          borderRadius: 14,
                          border: `1px solid ${THEME.bd}`,
                          background: THEME.s2,
                          fontSize: 13,
                        }}
                      >
                        <strong style={{ fontSize: 15 }}>{n.name}</strong>
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: 99,
                            border: `1px solid ${THEME.bdStrong}`,
                            fontSize: 11.5,
                            width: 'fit-content',
                            color: n.stage === 'Accelerating' ? THEME.pos : THEME.cyan,
                          }}
                        >
                          {n.stage}
                        </span>
                        <span style={{ color: THEME.tx2 }}>
                          Score <b style={{ color: THEME.tx }}>{n.score}</b>
                        </span>
                        <span style={{ color: THEME.tx2 }}>
                          Velocity <b style={{ color: THEME.pos }}>{n.vel}</b>
                        </span>
                        <span>↗</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Row: Top Opportunity + Attention Rotation */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 18 }}>
                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: 18,
                    border: `1px solid ${THEME.bd}`,
                    background: THEME.s1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 11.5, color: THEME.pos, fontFamily: THEME.fontMono }}>
                      HIGHEST-SCORING RECORDED OPPORTUNITY
                    </span>
                    <h3 style={{ fontSize: 22, margin: '4px 0' }}>$NRXAI · Agentic Mesh Protocol ↗</h3>
                    <span style={{ fontSize: 12.5, color: THEME.tx2 }}>
                      Linked narrative: Autonomous NEAR Agents
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 18 }}>
                    <div>
                      <div style={{ fontSize: 11, color: THEME.tx2 }}>Score</div>
                      <b style={{ fontSize: 22, color: THEME.pos }}>89.6</b>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: THEME.tx2 }}>Price</div>
                      <b style={{ fontSize: 22 }}>$0.0482</b>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: THEME.tx2 }}>Market cap</div>
                      <b style={{ fontSize: 22 }}>$4.82M</b>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: 18,
                    border: `1px solid ${THEME.bd}`,
                    background: THEME.s1,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 16,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: THEME.pos, fontWeight: 600, marginBottom: 6 }}>
                      ▲ Rising (24h Rotation)
                    </div>
                    <div style={{ fontSize: 13, color: THEME.tx }}>
                      Autonomous Agents <span style={{ color: THEME.pos }}>72.8 → 91.4</span>
                    </div>
                    <div style={{ fontSize: 13, color: THEME.tx, marginTop: 4 }}>
                      ZK Compute Mesh <span style={{ color: THEME.pos }}>68.1 → 84.2</span>
                    </div>
                  </div>
                  <div>
                    <div
                      style={{ fontSize: 12, color: THEME.danger, fontWeight: 600, marginBottom: 6 }}
                    >
                      ▼ Falling (24h Rotation)
                    </div>
                    <div style={{ fontSize: 13, color: THEME.tx2 }}>
                      Celebrity PolitiFi <span style={{ color: THEME.danger }}>64.0 → 41.2</span>
                    </div>
                    <div style={{ fontSize: 13, color: THEME.tx2, marginTop: 4 }}>
                      Static NFT Wrappers <span style={{ color: THEME.danger }}>52.4 → 35.8</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Narrative Radar View (/app/radar) */}
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
                    Narrative radar
                  </h1>
                  <p style={{ fontSize: 14.5, color: THEME.tx2, margin: '6px 0 0' }}>
                    Explore lifecycle stage and score. Select a narrative to inspect its evidence.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: THEME.tx2 }}>Filter by stage:</span>
                  <span
                    style={{
                      padding: '7px 16px',
                      borderRadius: 10,
                      border: `1px solid ${THEME.bdStrong}`,
                      background: THEME.s1,
                      fontSize: 13,
                    }}
                  >
                    All stages ▾
                  </span>
                </div>
              </div>

              {/* Radar Plot + Selected Narrative Detail */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
                <div
                  style={{
                    padding: '18px 22px',
                    borderRadius: 18,
                    border: `1px solid ${THEME.bd}`,
                    background: THEME.s1,
                  }}
                >
                  <svg viewBox="0 0 820 260" style={{ width: '100%', height: 245, display: 'block' }}>
                    {[0, 25, 50, 75, 100].map((v) => {
                      const y = 215 - v * 1.8;
                      return (
                        <g key={v}>
                          <path
                            d={`M50 ${y} H790`}
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="1"
                          />
                          <text x={12} y={y + 4} fill={THEME.tx3} fontSize="11">
                            {v}
                          </text>
                        </g>
                      );
                    })}
                    {[
                      'Seed',
                      'Emerging',
                      'Accelerating',
                      'Mainstream',
                      'Saturated',
                      'Decaying',
                      'Inactive',
                    ].map((st, i) => {
                      const x = 95 + i * 108;
                      return (
                        <g key={st}>
                          <path
                            d={`M${x} 25 V215`}
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth="1"
                          />
                          <text x={x} y={242} textAnchor="middle" fill={THEME.tx2} fontSize="11.5">
                            {st}
                          </text>
                        </g>
                      );
                    })}
                    {/* Plotted Narrative Markers */}
                    {[
                      { x: 95, y: 112, label: 'NEAR DePIN Sensors', sel: false },
                      { x: 203, y: 64, label: 'ZK Verifiable Compute', sel: false },
                      { x: 215, y: 88, label: 'Intent Solver Routers', sel: false },
                      { x: 311, y: 50, label: 'Autonomous NEAR Agents', sel: true },
                      { x: 325, y: 74, label: 'On-Chain Orderbook Perps', sel: false },
                      { x: 419, y: 68, label: 'Liquid Restaking Vaults', sel: false },
                      { x: 527, y: 108, label: 'Animal Trench Forks', sel: false },
                      { x: 635, y: 152, label: 'Celebrity PolitiFi', sel: false },
                    ].map((pt) => (
                      <g key={pt.label}>
                        {pt.sel && (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={22}
                            fill="rgba(162,206,0,0.18)"
                            stroke={THEME.pos}
                            strokeWidth="1.5"
                          />
                        )}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={10}
                          fill={pt.sel ? THEME.pos : THEME.s3}
                          stroke={pt.sel ? '#fff' : THEME.tx2}
                          strokeWidth={pt.sel ? 2.5 : 1.5}
                        />
                        {pt.sel && (
                          <text
                            x={pt.x + 18}
                            y={pt.y + 4}
                            fill={THEME.tx}
                            fontSize="12"
                            fontWeight="600"
                          >
                            {pt.label} (91.4)
                          </text>
                        )}
                      </g>
                    ))}
                  </svg>
                </div>

                {/* Selected Narrative Detail Card */}
                <div
                  style={{
                    padding: 22,
                    borderRadius: 18,
                    border: `1px solid ${THEME.pos}`,
                    background: `linear-gradient(155deg, ${THEME.s2}, ${THEME.s1})`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontFamily: THEME.fontMono,
                        fontSize: 10.5,
                        color: THEME.pos,
                        textTransform: 'uppercase',
                      }}
                    >
                      Selected narrative
                    </span>
                    <h2 style={{ fontSize: 22, margin: '6px 0 14px' }}>
                      Autonomous NEAR Agents
                    </h2>
                    <div style={{ display: 'grid', gap: 9, fontSize: 13 }}>
                      {[
                        ['Stage', 'Accelerating'],
                        ['Score', '91.4 / 100'],
                        ['Velocity', '+18.6 (24h)'],
                        ['Organic score', '86.2%'],
                        ['Linked tokens', '14 tokens'],
                      ].map(([k, v]) => (
                        <div
                          key={k}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            paddingBottom: 7,
                            borderBottom: `1px solid ${THEME.bd}`,
                          }}
                        >
                          <span style={{ color: THEME.tx2 }}>{k}</span>
                          <b>{v}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '9px 16px',
                      borderRadius: 999,
                      background: THEME.tx,
                      color: THEME.bg,
                      fontWeight: 600,
                      fontSize: 12.5,
                      textAlign: 'center',
                      marginTop: 12,
                    }}
                  >
                    Open narrative evidence ↗
                  </div>
                </div>
              </div>

              {/* Narrative Ranking Table */}
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
                    gridTemplateColumns: '2fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr',
                    padding: '11px 18px',
                    background: THEME.s2,
                    borderBottom: `1px solid ${THEME.bd}`,
                    fontFamily: THEME.fontMono,
                    fontSize: 10.5,
                    color: THEME.tx2,
                    textTransform: 'uppercase',
                  }}
                >
                  <span>Name</span>
                  <span>Stage</span>
                  <span>Score</span>
                  <span>Velocity</span>
                  <span>Organic</span>
                  <span>Saturation</span>
                  <span>Linked tokens</span>
                </div>
                {[
                  ['Autonomous NEAR Agents', 'Accelerating', '91.4', '+18.6', '86.2', '24.0', '14'],
                  ['ZK Verifiable Compute', 'Emerging', '84.2', '+12.1', '89.5', '15.2', '8'],
                  ['On-Chain Orderbook Perps', 'Accelerating', '79.8', '+9.4', '81.0', '31.4', '11'],
                  ['Intent Solver Routers', 'Emerging', '74.5', '+7.8', '84.1', '12.8', '6'],
                ].map((r, idx) => (
                  <div
                    key={r[0]}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr',
                      padding: '11px 18px',
                      borderBottom: idx < 3 ? `1px solid ${THEME.bd}` : 'none',
                      fontSize: 13,
                      background: idx === 0 ? 'rgba(162,206,0,0.06)' : 'transparent',
                    }}
                  >
                    <strong style={{ color: idx === 0 ? THEME.pos : THEME.tx }}>{r[0]}</strong>
                    <span style={{ color: THEME.tx2 }}>{r[1]}</span>
                    <b>{r[2]}</b>
                    <span style={{ color: THEME.pos }}>{r[3]}</span>
                    <span>{r[4]}%</span>
                    <span>{r[5]}%</span>
                    <span>{r[6]}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </WorkspaceFrame>

      <AnimatedCursor
        waypoints={[
          { frame: 0, x: 750, y: 360 },
          { frame: 40, x: 1180, y: 490 },
          { frame: 68, x: 180, y: 270, click: true },
          { frame: 100, x: 695, y: 340, click: true },
          { frame: 125, x: 1480, y: 525 },
        ]}
      />

      <SceneCaptionBadge
        step={isRadar ? '03B / NARRATIVE RADAR' : '03A / RESEARCH OVERVIEW'}
        title={
          isRadar
            ? 'Narrative Lifecycle Stage vs. Score Plot'
            : 'Market Snapshot, Fixed-Rule Brief & Emerging Narratives'
        }
        subtitle={
          isRadar
            ? 'Inspect organic score, mention velocity, saturation risk & attention rotation'
            : 'Real-time NEAR intelligence bar, 6 key workspace metrics & rotation tracking'
        }
      />
    </AbsoluteFill>
  );
};
