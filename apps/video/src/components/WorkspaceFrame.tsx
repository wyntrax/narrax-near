import React from 'react';
import {
  LayoutDashboard,
  Radar,
  Orbit,
  Coins,
  Bell,
  ChartColumn,
  FlaskConical,
  Bot,
  Settings,
  ShieldCheck,
  ArrowUpRight,
  LogOut,
  PanelLeftClose,
  Sun,
} from 'lucide-react';
import { NarraxMark, PoweredByBadge, THEME } from '../theme';

export type NavKey =
  | 'overview'
  | 'radar'
  | 'opportunities'
  | 'tokens'
  | 'alerts'
  | 'analytics'
  | 'agent'
  | 'settings'
  | 'personalRadar'
  | 'theses'
  | 'briefing'
  | 'admin';

export const NAV_ITEMS: Array<{
  key: NavKey;
  label: string;
  path: string;
  Icon: React.FC<{ size?: number; color?: string }>;
  badge?: string;
  section?: 'core' | 'pro' | 'admin';
}> = [
  { key: 'overview', label: 'Overview', path: '/app', Icon: LayoutDashboard, section: 'core' },
  { key: 'radar', label: 'Radar', path: '/app/radar', Icon: Radar, section: 'core' },
  { key: 'opportunities', label: 'Opportunities', path: '/app/opportunities', Icon: Orbit, section: 'core' },
  { key: 'tokens', label: 'Tokens', path: '/app/tokens', Icon: Coins, section: 'core' },
  { key: 'alerts', label: 'Alerts', path: '/app/alerts', Icon: Bell, badge: '4', section: 'core' },
  { key: 'analytics', label: 'Analytics', path: '/app/analytics', Icon: ChartColumn, section: 'core' },
  { key: 'agent', label: 'Agent', path: '/app/agent', Icon: Bot, section: 'core' },
  { key: 'settings', label: 'Settings', path: '/app/settings', Icon: Settings, section: 'core' },
  { key: 'personalRadar', label: 'Personal Radar', path: '/app/personal-radar', Icon: Radar, section: 'pro' },
  { key: 'theses', label: 'Thesis Tracker', path: '/app/theses', Icon: FlaskConical, section: 'pro' },
  { key: 'briefing', label: 'Personal Briefing', path: '/app/briefing', Icon: Bell, section: 'pro' },
  { key: 'admin', label: 'Admin', path: '/app/admin', Icon: ShieldCheck, section: 'admin' },
];

export const WorkspaceFrame: React.FC<{
  activeMenu: NavKey;
  urlPath?: string;
  children: React.ReactNode;
  scale?: number;
  rotateX?: number;
  rotateY?: number;
  translateY?: number;
}> = ({
  activeMenu,
  urlPath,
  children,
  scale = 1,
  rotateX = 0,
  rotateY = 0,
  translateY = 0,
}) => {
  const activeItem = NAV_ITEMS.find((n) => n.key === activeMenu) ?? NAV_ITEMS[0];
  const resolvedUrl = urlPath ?? `narrax.ai${activeItem.path}`;

  return (
    <div
      style={{
        width: 1740,
        height: 940,
        margin: '32px auto 0',
        borderRadius: 22,
        border: `1px solid ${THEME.bdStrong}`,
        background: THEME.bg,
        boxShadow:
          '0 40px 110px rgba(0, 0, 0, 0.82), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.12)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: THEME.fontBody,
        color: THEME.tx,
        transform: `perspective(1800px) translateY(${translateY}px) scale(${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transformOrigin: 'center center',
      }}
    >
      {/* Browser Top Chrome */}
      <div
        style={{
          height: 42,
          background: '#0a0a0d',
          borderBottom: `1px solid ${THEME.bd}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          gap: 14,
          flexShrink: 0,
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
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '4px 20px',
            borderRadius: 999,
            background: THEME.s1,
            border: `1px solid ${THEME.bd}`,
            fontFamily: THEME.fontMono,
            fontSize: 11.5,
            color: THEME.tx2,
            minWidth: 380,
            justifyContent: 'center',
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: THEME.pos }} />
          <span>{resolvedUrl}</span>
        </div>
        <div
          style={{
            fontFamily: THEME.fontMono,
            fontSize: 10.5,
            color: THEME.tx3,
            letterSpacing: '0.06em',
          }}
        >
          PRO TIER · VERIFIED
        </div>
      </div>

      {/* Intelligence Bar */}
      <div
        style={{
          height: 38,
          borderBottom: `1px solid ${THEME.bd}`,
          background: 'rgba(17, 17, 21, 0.9)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 22px',
          gap: 28,
          fontFamily: THEME.fontMono,
          fontSize: 11.5,
          color: THEME.tx2,
          flexShrink: 0,
        }}
      >
        <span>
          NEAR <b style={{ color: THEME.tx, marginLeft: 6 }}>$5.20</b>
        </span>
        <span>
          Narrative heat <b style={{ color: THEME.tx, marginLeft: 6 }}>78.4</b>
        </span>
        <span>
          Observed tokens <b style={{ color: THEME.tx, marginLeft: 6 }}>1,420</b>
        </span>
        <span>
          Opportunities, 24h <b style={{ color: THEME.tx, marginLeft: 6 }}>38</b>
        </span>
        <span style={{ marginLeft: 'auto', color: THEME.tx3, fontSize: 11 }}>
          Snapshot data · Updated 12s ago
        </span>
      </div>

      {/* Shell Body: Sidebar + Main Area */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left Research Sidebar */}
        <aside
          style={{
            width: 236,
            borderRight: `1px solid ${THEME.bd}`,
            background: `linear-gradient(170deg, ${THEME.s1}, ${THEME.bg})`,
            padding: '18px 12px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            {/* Brand */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '2px 10px 16px',
                fontFamily: THEME.fontDisplay,
                fontWeight: 700,
                fontSize: 21,
                letterSpacing: '0.04em',
              }}
            >
              <NarraxMark size={26} />
              <span>NARRAX</span>
            </div>

            <div
              style={{
                padding: '0 10px 8px',
                fontFamily: THEME.fontMono,
                fontSize: 9.5,
                letterSpacing: '0.08em',
                color: THEME.tx3,
                textTransform: 'uppercase',
              }}
            >
              Research workspace
            </div>

            {/* 15 Menu Items */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {NAV_ITEMS.map(({ key, label, Icon, badge }) => {
                const isActive = key === activeMenu;
                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6.5px 12px',
                      borderRadius: 999,
                      fontSize: 12.5,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? THEME.tx : THEME.tx2,
                      background: isActive
                        ? `linear-gradient(${THEME.panelTop}, ${THEME.panelBottom})`
                        : 'transparent',
                      border: isActive
                        ? '1px solid rgba(255, 255, 255, 0.24)'
                        : '1px solid transparent',
                      boxShadow: isActive
                        ? 'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 16px rgba(0,0,0,0.35)'
                        : 'none',
                    }}
                  >
                    <Icon size={15} color={isActive ? THEME.pos : THEME.tx2} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {label}
                    </span>
                    {badge && (
                      <b
                        style={{
                          marginLeft: 'auto',
                          minWidth: 19,
                          height: 19,
                          borderRadius: 99,
                          background: isActive ? THEME.pos : THEME.tx,
                          color: THEME.bg,
                          fontSize: 10,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 5px',
                        }}
                      >
                        {badge}
                      </b>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Bottom */}
          <div
            style={{
              borderTop: `1px solid ${THEME.bd}`,
              paddingTop: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ padding: '4px 10px' }}>
              <PoweredByBadge compact />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                color: THEME.tx2,
                fontSize: 11.5,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <ArrowUpRight size={14} /> Manage access
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <LogOut size={13} />
                <PanelLeftClose size={13} />
              </span>
            </div>
          </div>
        </aside>

        {/* Right Content Column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Top Research Tools Bar */}
          <div
            style={{
              height: 50,
              borderBottom: `1px solid ${THEME.bd}`,
              padding: '0 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(5, 6, 9, 0.75)',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: THEME.fontMono,
                fontSize: 10.5,
                letterSpacing: '0.07em',
                color: THEME.tx2,
                textTransform: 'uppercase',
              }}
            >
              NARRAX / RESEARCH WORKSPACE / <b style={{ color: THEME.tx }}>{activeItem.label}</b>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: 999,
                  border: `1px solid ${THEME.bd}`,
                  fontSize: 11.5,
                  color: THEME.tx2,
                }}
              >
                EN ▾
              </span>
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  border: `1px solid ${THEME.bd}`,
                  display: 'grid',
                  placeItems: 'center',
                  color: THEME.tx2,
                }}
              >
                <Sun size={14} />
              </span>
            </div>
          </div>

          {/* Main Workspace Canvas */}
          <main
            style={{
              flex: 1,
              padding: '26px 34px',
              backgroundColor: THEME.bg,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
