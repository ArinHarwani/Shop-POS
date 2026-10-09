/**
 * Visual design tokens strictly following user instructions.
 * Light theme only. Minimal paper bill pad aesthetic.
 */
export const TOKENS = {
  colors: {
    bg: '#FFFFFF',
    text: '#1A1A1A',
    textSecondary: '#6B6B6B',
    border: '#E6E6E6',
    panel: '#F6F6F4',
    accent: 'var(--accent, #1F3A5F)',
    statusOk: '#15803D',
    statusWarn: '#B45309',
    statusErr: '#B91C1C',
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    bodySize: '17px',
    labelSize: '15px',
    totalSize: '32px',
    minSize: '15px',
  },
  geometry: {
    radius: '8px',
    minTapHeight: '52px',
    spacingBetweenButtons: '12px',
  },
};
