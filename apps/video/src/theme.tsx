import React from 'react';

export const THEME = {
  bg: '#050609',
  bgPanel: '#0d0d10',
  s1: '#111115',
  s2: '#17171c',
  s3: '#202027',
  panelTop: '#1c1c22',
  panelBottom: '#0d0d10',
  bd: 'rgba(255, 255, 255, 0.12)',
  bdStrong: 'rgba(255, 255, 255, 0.24)',
  tx: '#f0f0f4',
  tx2: '#a4a4ad',
  tx3: '#757582',
  pos: '#a2ce00',
  cyan: '#50c8ff',
  amber: '#e8a838',
  danger: '#e97777',
  purple: '#9d7bff',
  fontDisplay: "'Outfit', 'Rajdhani', system-ui, -apple-system, sans-serif",
  fontBody: "'Outfit', 'Barlow', system-ui, -apple-system, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
};

export const NarraxMark: React.FC<{ size?: number; color?: string }> = ({
  size = 36,
  color = THEME.tx,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 241 241"
    width={size}
    height={size}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M47.92 32.15C55.54 31.08 59.6 35.87 64.56 40.61C71.92 47.62 79.24 54.56 86.5 61.67C119.86 94.36 153.7 126.34 186.74 159.42C193.53 166.22 200.36 172.92 207.19 179.65C209.36 181.79 212.23 183.66 213.89 186.27C217.46 191.87 216.92 200.15 211.88 204.72C207.2 208.98 200.32 209.87 194.79 206.7C190.9 204.46 188.04 200.41 184.8 197.36C177.62 190.58 170.6 183.57 163.67 176.5C128.65 140.81 91.59 107.23 56.32 71.84C51.24 66.74 40 58.3 37.27 52.2C33.64 44.07 38.91 33.41 47.92 32.15ZM158.5 116.44C152.13 110.13 145.76 103.81 139.39 97.5C142.49 91.89 154.66 81.69 159.73 76.56C168.35 67.85 177.05 59.22 185.7 50.53C190.59 45.62 195.42 39.25 201.1 35.27C206.57 31.44 215.13 32.22 219.65 37.19C224.17 42.14 224.26 50.63 219.77 55.61C206.74 70.06 191.91 83.19 178.2 97.03C173.94 101.32 162.94 114.16 158.5 116.44ZM40.93 75.46C43.61 74.72 45.14 76.99 46.89 78.6C50.77 82.17 54.47 85.91 58.29 89.54C59.69 90.87 62.17 92.58 62.52 94.59C63.79 101.91 62.41 113.42 62.38 121.17C62.3 140.83 62.06 160.5 62.25 180.17C62.35 189.38 62.31 203.05 49.79 203.86C34.26 204.86 34.01 192.34 34.02 180.83C34.06 155.94 34.34 131.06 34.36 106.17C34.37 98.24 31.19 78.13 40.93 75.46ZM107.5 132.89C113.88 139.09 120.25 145.3 126.63 151.5C123.64 157.3 116.7 162.32 112.2 167.03C106.85 172.64 101.37 178.23 96.17 184C92.77 187.77 89.29 192.67 85.26 195.76C81.21 198.86 74.84 198.59 71.17 195C66.2 190.15 66.48 179.94 69.17 173.99C71.52 168.8 79.64 162.14 83.79 157.96C90.79 150.9 99.98 138.35 107.5 132.89Z"
      transform="translate(-7.98036 0.2009)"
      fill={color}
      fillRule="evenodd"
      stroke={color}
      strokeWidth="0.25"
      strokeLinejoin="round"
    />
  </svg>
);

export const PoweredByBadge: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      fontSize: compact ? 11 : 12,
      color: THEME.tx2,
      fontFamily: THEME.fontBody,
      letterSpacing: '0.04em',
    }}
  >
    <span>Powered by</span>
    <NarraxMark size={compact ? 16 : 19} />
    <b style={{ color: THEME.tx, fontWeight: 600 }}>Narrax</b>
    <span style={{ opacity: 0.7 }}>↗</span>
  </div>
);
