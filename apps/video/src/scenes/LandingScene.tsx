import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  ArrowUpRight,
  AudioLines,
  Check,
  Focus,
  MessageCircle,
  Radar,
  ScanLine,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
import { NarraxMark, PoweredByBadge, THEME } from '../theme';
import { AmbientBackdrop, AnimatedCursor, SceneCaptionBadge } from '../components/Effects';

export const LandingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Intro reveal (frames 0-40)
  const introProgress = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 90 },
  });

  // Scroll down the landing page smoothly between frames 40 and 105
  const scrollPhase1 = spring({
    frame: frame - 40,
    fps,
    durationInFrames: 35,
    config: { damping: 24, stiffness: 80 },
  });
  const scrollPhase2 = spring({
    frame: frame - 80,
    fps,
    durationInFrames: 35,
    config: { damping: 24, stiffness: 80 },
  });

  const scrollY =
    interpolate(scrollPhase1, [0, 1], [0, -340]) +
    interpolate(scrollPhase2, [0, 1], [0, -360]);

  const browserScale = interpolate(introProgress, [0, 1], [0.92, 1]);
  const browserOpacity = interpolate(introProgress, [0, 0.5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Wire flow offset
  const dashOffset = -(frame * 4.5);

  return (
    <AbsoluteFill>
      <AmbientBackdrop accentColor="rgba(255,255,255,0.09)" secondaryColor="rgba(162,206,0,0.07)" />

      {/* Browser Window */}
      <div
        style={{
          width: 1720,
          height: 930,
          margin: '34px auto 0',
          borderRadius: 24,
          border: `1px solid ${THEME.bdStrong}`,
          background: THEME.bg,
          boxShadow: '0 40px 120px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.12)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transform: `scale(${browserScale})`,
          opacity: browserOpacity,
          fontFamily: THEME.fontBody,
          color: THEME.tx,
        }}
      >
        {/* Sticky Marketing Site Header */}
        <header
          style={{
            height: 76,
            padding: '0 64px',
            borderBottom: `1px solid ${THEME.bd}`,
            background: 'rgba(5, 6, 9, 0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 20,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <NarraxMark size={32} />
            <span
              style={{
                fontFamily: THEME.fontDisplay,
                fontWeight: 700,
                fontSize: 24,
                letterSpacing: '0.05em',
              }}
            >
              NARRAX
            </span>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                border: `1px solid ${THEME.bd}`,
                background: THEME.s1,
                fontFamily: THEME.fontMono,
                fontSize: 11,
                color: THEME.tx2,
              }}
            >
              EARLY ACCESS
            </span>
          </div>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 14, color: THEME.tx2 }}>
            <span style={{ color: THEME.tx }}>Home</span>
            <span>How it works</span>
            <span>Product</span>
            <span>Tiers</span>
            <span>FAQ</span>
            <span
              style={{
                padding: '9px 18px',
                borderRadius: 999,
                background: `linear-gradient(${THEME.panelTop}, ${THEME.panelBottom})`,
                border: `1px solid ${THEME.bdStrong}`,
                color: THEME.tx,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 500,
              }}
            >
              Get early access <ArrowUpRight size={15} />
            </span>
          </nav>
        </header>

        {/* Scrollable Marketing Body */}
        <div
          style={{
            flex: 1,
            padding: '42px 84px 120px',
            transform: `translateY(${scrollY}px)`,
          }}
        >
          {/* Hero Intro */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginBottom: 34,
            }}
          >
            <div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: THEME.s1,
                    border: `1px solid ${THEME.bd}`,
                    fontFamily: THEME.fontMono,
                    fontSize: 12,
                    color: THEME.tx2,
                  }}
                >
                  <NarraxMark size={15} /> Research on NEAR
                </span>
                <span
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: THEME.s1,
                    border: `1px solid ${THEME.bd}`,
                    fontFamily: THEME.fontMono,
                    fontSize: 12,
                    color: THEME.pos,
                  }}
                >
                  EARLY ACCESS
                </span>
              </div>
              <h1
                style={{
                  fontSize: 54,
                  fontWeight: 500,
                  lineHeight: 1.06,
                  letterSpacing: '-0.04em',
                  margin: 0,
                }}
              >
                See the narrative
                <br />
                <span style={{ color: THEME.tx2 }}>before the crowd does.</span>
              </h1>
              <p
                style={{
                  fontSize: 17,
                  color: THEME.tx2,
                  maxWidth: 540,
                  margin: '16px 0 0',
                  lineHeight: 1.6,
                }}
              >
                Connect the conversation, the narratives and the tokens. Make up your own mind with more
                context.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 230 }}>
              <div
                style={{
                  padding: '13px 22px',
                  borderRadius: 999,
                  background: `linear-gradient(${THEME.panelTop}, ${THEME.panelBottom})`,
                  border: `1px solid ${THEME.pos}`,
                  boxShadow: '0 0 28px rgba(162, 206, 0, 0.22)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <span>Get early access</span>
                <ArrowUpRight size={17} color={THEME.pos} />
              </div>
              <div
                style={{
                  padding: '12px 22px',
                  borderRadius: 999,
                  border: `1px solid ${THEME.bdStrong}`,
                  color: THEME.tx2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 14,
                }}
              >
                <span>Explore the research</span>
                <span>↓</span>
              </div>
            </div>
          </div>

          {/* SignalGraph Component Replica */}
          <div
            style={{
              border: `1px solid ${THEME.bdStrong}`,
              borderRadius: 24,
              background: `radial-gradient(ellipse at 65% 0, rgba(255,255,255,0.06), transparent 60%), ${THEME.bg}`,
              overflow: 'hidden',
              marginBottom: 48,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '14px 22px',
                borderBottom: `1px solid ${THEME.bd}`,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 14px',
                  borderRadius: 999,
                  background: THEME.s2,
                  border: `1px solid ${THEME.bd}`,
                  fontSize: 12.5,
                }}
              >
                ⌘ Research workflow
              </span>
              <span style={{ fontFamily: THEME.fontMono, fontSize: 11, color: THEME.tx2 }}>
                Illustrated process · not live data
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  color: THEME.tx,
                }}
              >
                Open radar <ArrowUpRight size={15} />
              </span>
            </div>

            <div
              style={{
                height: 310,
                display: 'grid',
                gridTemplateColumns: '26% 1fr 26%',
                alignItems: 'center',
                position: 'relative',
                padding: '16px 48px',
              }}
            >
              {/* Wires SVG */}
              <svg
                viewBox="0 0 1100 340"
                preserveAspectRatio="none"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              >
                <g stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" fill="none">
                  <path d="M280 70C420 70 390 170 550 170" />
                  <path d="M280 170H550" />
                  <path d="M280 270C420 270 390 170 550 170" />
                  <path d="M550 170C710 170 680 105 820 105" />
                  <path d="M550 170C710 170 680 235 820 235" />
                </g>
                <g
                  stroke={THEME.pos}
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="18 220"
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                >
                  <path d="M280 70C420 70 390 170 550 170" />
                  <path d="M280 170H550" />
                  <path d="M280 270C420 270 390 170 550 170" />
                  <path d="M550 170C710 170 680 105 820 105" />
                  <path d="M550 170C710 170 680 235 820 235" />
                </g>
              </svg>

              {/* Left Sources */}
              <div style={{ display: 'grid', gap: 16, zIndex: 2 }}>
                {[
                  { name: 'X', sub: 'The conversation', Icon: ScanLine },
                  { name: 'Reddit', sub: 'Community discussions', Icon: MessageCircle },
                  { name: 'TikTok', sub: 'Culture & attention', Icon: AudioLines },
                ].map(({ name, sub, Icon }, idx) => (
                  <div
                    key={name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      borderRadius: 14,
                      border: `1px solid ${THEME.bdStrong}`,
                      background: `linear-gradient(145deg, ${THEME.panelTop}, ${THEME.panelBottom})`,
                    }}
                  >
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 9,
                        background: THEME.s2,
                        border: `1px solid ${THEME.bd}`,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Icon size={17} />
                    </span>
                    <div>
                      <strong style={{ fontSize: 14, display: 'block' }}>{name}</strong>
                      <span style={{ fontSize: 11.5, color: THEME.tx2 }}>{sub}</span>
                    </div>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontFamily: THEME.fontMono,
                        fontSize: 10,
                        color: THEME.tx3,
                      }}
                    >
                      0{idx + 1}
                    </span>
                  </div>
                ))}
              </div>

              {/* Center Core Emblem */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    width: 92,
                    height: 92,
                    borderRadius: 26,
                    border: `1px solid ${THEME.bdStrong}`,
                    background: `radial-gradient(ellipse at 30% 0, rgba(162,206,0,0.22), transparent 65%), linear-gradient(${THEME.panelTop}, ${THEME.panelBottom})`,
                    boxShadow: '0 0 60px rgba(162,206,0,0.14)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <NarraxMark size={44} />
                </div>
                <strong
                  style={{
                    fontFamily: THEME.fontDisplay,
                    fontSize: 19,
                    letterSpacing: '0.14em',
                    marginTop: 14,
                  }}
                >
                  NARRAX
                </strong>
                <span style={{ fontSize: 12, color: THEME.tx2 }}>From activity to context</span>
              </div>

              {/* Right Outputs */}
              <div style={{ display: 'grid', gap: 18, zIndex: 2 }}>
                <div
                  style={{
                    padding: '16px 18px',
                    borderRadius: 16,
                    border: `1px solid ${THEME.bdStrong}`,
                    background: `linear-gradient(150deg, ${THEME.panelTop}, ${THEME.panelBottom})`,
                  }}
                >
                  <Radar size={20} color={THEME.pos} />
                  <strong style={{ display: 'block', fontSize: 14, marginTop: 8 }}>
                    Narrative radar
                  </strong>
                  <p style={{ fontSize: 12, color: THEME.tx2, margin: '4px 0 0' }}>
                    Follow topics, sources and lifecycle stages.
                  </p>
                </div>
                <div
                  style={{
                    padding: '16px 18px',
                    borderRadius: 16,
                    border: `1px solid ${THEME.bdStrong}`,
                    background: `linear-gradient(150deg, ${THEME.panelTop}, ${THEME.panelBottom})`,
                  }}
                >
                  <Focus size={20} color={THEME.cyan} />
                  <strong style={{ display: 'block', fontSize: 14, marginTop: 8 }}>
                    Connected evidence
                  </strong>
                  <p style={{ fontSize: 12, color: THEME.tx2, margin: '4px 0 0' }}>
                    Inspect observations. Keep uncertainty in view.
                  </p>
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 24px',
                borderTop: `1px solid ${THEME.bd}`,
                fontFamily: THEME.fontMono,
                fontSize: 10.5,
                color: THEME.tx2,
              }}
            >
              <span>X / Reddit / TikTok · selected watchlists</span>
              <span>Research, not prediction · Powered by Narrax</span>
            </div>
          </div>

          {/* Section 01: How It Works */}
          <div style={{ marginBottom: 48 }}>
            <p
              style={{
                fontFamily: THEME.fontMono,
                fontSize: 12,
                color: THEME.pos,
                margin: '0 0 10px',
              }}
            >
              01 / From noise to context
            </p>
            <h2 style={{ fontSize: 34, fontWeight: 500, margin: '0 0 24px' }}>
              Follow the signal. Understand the story.
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
              {[
                {
                  num: '01',
                  title: "Find what's forming",
                  body: 'See narratives by stage and momentum. Understand what is emerging and what is already crowded.',
                  Icon: ScanLine,
                },
                {
                  num: '02',
                  title: 'Connect the evidence',
                  body: 'Explore related tokens and observed-token activity, with the uncertainty kept in view.',
                  Icon: Waypoints,
                },
                {
                  num: '03',
                  title: 'Keep your judgment',
                  body: 'Research is context, not a promise. Check the evidence and decide what deserves a closer look.',
                  Icon: ShieldCheck,
                },
              ].map(({ num, title, body, Icon }) => (
                <div
                  key={num}
                  style={{
                    padding: 24,
                    borderRadius: 20,
                    border: `1px solid ${THEME.bd}`,
                    background: THEME.s1,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 22,
                    }}
                  >
                    <span
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        border: `1px solid ${THEME.bdStrong}`,
                        background: THEME.s2,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Icon size={22} color={THEME.pos} />
                    </span>
                    <span style={{ fontFamily: THEME.fontMono, fontSize: 12, color: THEME.tx2 }}>
                      {num}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 20, margin: '0 0 10px' }}>{title}</h3>
                  <p style={{ fontSize: 14, color: THEME.tx2, margin: 0, lineHeight: 1.6 }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 03: Access levels */}
          <div>
            <p
              style={{
                fontFamily: THEME.fontMono,
                fontSize: 12,
                color: THEME.pos,
                margin: '0 0 10px',
              }}
            >
              03 / Your access · Powered by Narrax
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {[
                {
                  tier: 'Early access',
                  req: 'No token holding required. Join through early access.',
                  perks: ['Narrative research', 'Token research', 'Research overview'],
                  highlight: false,
                },
                {
                  tier: 'Member',
                  req: 'Reserved research level; admin grant only.',
                  perks: ['Token screener', 'Narrative rotation', 'Opportunities'],
                  highlight: false,
                },
                {
                  tier: 'Pro',
                  req: 'Reserved research level; admin grant only.',
                  perks: ['Decision analytics', 'Personal Radar & Theses', 'Personal Briefing'],
                  highlight: true,
                },
              ].map((card) => (
                <div
                  key={card.tier}
                  style={{
                    padding: 22,
                    borderRadius: 18,
                    border: `1px solid ${card.highlight ? THEME.pos : THEME.bd}`,
                    background: card.highlight ? THEME.s2 : THEME.s1,
                    boxShadow: card.highlight ? '0 0 32px rgba(162,206,0,0.12)' : 'none',
                  }}
                >
                  <h3 style={{ fontSize: 21, margin: '0 0 8px' }}>{card.tier}</h3>
                  <div
                    style={{
                      fontFamily: THEME.fontMono,
                      fontSize: 11,
                      color: card.highlight ? THEME.pos : THEME.tx2,
                      paddingBottom: 14,
                      borderBottom: `1px solid ${THEME.bd}`,
                      marginBottom: 14,
                    }}
                  >
                    {card.req}
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {card.perks.map((p) => (
                      <div
                        key={p}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 12.5,
                          color: THEME.tx2,
                        }}
                      >
                        <Check size={14} color={THEME.pos} />
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Animated Cursor clicking "Get early access" */}
      <AnimatedCursor
        waypoints={[
          { frame: 0, x: 960, y: 520 },
          { frame: 28, x: 1480, y: 245, click: true },
          { frame: 70, x: 980, y: 420 },
          { frame: 115, x: 1640, y: 74, click: true },
        ]}
      />

      <SceneCaptionBadge
        step="01 / LANDING PAGE"
        title="See the Narrative Before the Crowd Does"
        subtitle="Interactive evidence workflow, 3-step methodology & local research access"
      />
    </AbsoluteFill>
  );
};
