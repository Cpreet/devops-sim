import type { NodeKind, AreaKind } from '../sim/types';

// Phaser uses 0x hex numbers; React/CSS uses '#hex' strings.
// This file provides both forms where needed.

export const canvas = {
    bg: 0xf0f2f6,
    bgCss: '#f0f2f6',
    gridStroke: 0xd0d5e0,
    gridStrokeAlpha: 0.7,
    gridFill: 0xe8ecf2,
    gridFillAlpha: 0.35,
    gridDot: 0xb8bfcc,
    gridDotAlpha: 0.5,
} as const;

export const area: Record<AreaKind, { fill: number; fillAlpha: number; stroke: number; strokeAlpha: number; labelBg: string; labelBgHex: number; labelText: string }> = {
    PUBLIC: { fill: 0x2196f3, fillAlpha: 0.07, stroke: 0x2196f3, strokeAlpha: 0.3, labelBg: '#2196F3', labelBgHex: 0x2196f3, labelText: '#ffffff' },
    APP:    { fill: 0x4caf50, fillAlpha: 0.07, stroke: 0x4caf50, strokeAlpha: 0.3, labelBg: '#4CAF50', labelBgHex: 0x4caf50, labelText: '#ffffff' },
    DATA:   { fill: 0xff9800, fillAlpha: 0.07, stroke: 0xff9800, strokeAlpha: 0.3, labelBg: '#E65100', labelBgHex: 0xe65100, labelText: '#ffffff' },
    ASYNC:  { fill: 0x7e57c2, fillAlpha: 0.07, stroke: 0x7e57c2, strokeAlpha: 0.3, labelBg: '#7E57C2', labelBgHex: 0x7e57c2, labelText: '#ffffff' },
};

export const node: Record<NodeKind, { base: number; accent: string; css: string }> = {
    LB:     { base: 0x2196f3, accent: '#2196F3', css: '#2196F3' },
    API:    { base: 0x4caf50, accent: '#4CAF50', css: '#4CAF50' },
    DB:     { base: 0xe65100, accent: '#E65100', css: '#E65100' },
    CACHE:  { base: 0xff9800, accent: '#FF9800', css: '#FF9800' },
    QUEUE:  { base: 0x7e57c2, accent: '#7E57C2', css: '#7E57C2' },
    WORKER: { base: 0x607d8b, accent: '#607D8B', css: '#607D8B' },
};

export const edge: {
    default: { color: number; alpha: number; width: number };
    active: { color: number; alpha: number; width: number };
    warning: { color: number; alpha: number; width: number };
    error: { color: number; alpha: number; width: number };
    selected: { widthAdd: number; alphaAdd: number };
    shadow: { color: number; alpha: number; widthAdd: number };
    arrowSize: number;
    arrowOffset: number;
    pulse: { radius: number; alpha: number };
} = {
    default: { color: 0x90a4ae, alpha: 0.55, width: 2.5 },
    active:  { color: 0x2196f3, alpha: 0.75, width: 2.5 },
    warning: { color: 0xf9a825, alpha: 0.75, width: 2.5 },
    error:   { color: 0xe53935, alpha: 0.8, width: 2.5 },
    selected: { widthAdd: 1.0, alphaAdd: 0.15 },
    shadow:  { color: 0x000000, alpha: 0.06, widthAdd: 4 },
    arrowSize: 10,
    arrowOffset: 16,
    pulse: { radius: 3.5, alpha: 0.7 },
};

export const selection: { color: number; colorCss: string; alpha: number; ringWidth: number } = {
    color: 0x2979ff,
    colorCss: '#2979FF',
    alpha: 0.15,
    ringWidth: 2.5,
};

export const status: { ok: { hex: number; css: string }; warn: { hex: number; css: string }; error: { hex: number; css: string } } = {
    ok:      { hex: 0x43a047, css: '#43A047' },
    warn:    { hex: 0xf9a825, css: '#F9A825' },
    error:   { hex: 0xe53935, css: '#E53935' },
};

export const hover = {
    validFill: 0x2196f3,
    validFillAlpha: 0.08,
    validStroke: 0x2196f3,
    validStrokeAlpha: 0.35,
    invalidFill: 0xe53935,
    invalidFillAlpha: 0.08,
    invalidStroke: 0xe53935,
    invalidStrokeAlpha: 0.4,
    cursorFill: 0x2979ff,
    cursorFillAlpha: 0.12,
    cursorStroke: 0x2979ff,
    cursorStrokeAlpha: 0.6,
} as const;

export const ui = {
    panelBg: '#ffffff',
    panelBorder: '#e0e4eb',
    surfaceBg: '#f5f6f9',
    textPrimary: '#1a2233',
    textSecondary: '#5f6b7a',
    textTertiary: '#8a94a6',
    textMuted: '#b0b8c8',
    accent: '#2979FF',
    accentLight: '#e3ecff',
    border: '#e0e4eb',
    borderLight: '#eef0f4',
    divider: '#eef0f4',
    inputBg: '#f5f6f9',
    inputBorder: '#d0d5e0',
    inputFocus: '#2979FF',
    shadow: '0 1px 3px rgba(0,0,0,0.06)',
    shadowMd: '0 2px 8px rgba(0,0,0,0.08)',
} as const;

export const typography = {
    fontSans: "'Inter', system-ui, -apple-system, sans-serif",
    fontMono: "'JetBrains Mono', 'Fira Code', monospace",
    sizes: {
        xs: '10px',
        sm: '11px',
        base: '12px',
        md: '13px',
        lg: '14px',
        xl: '16px',
    },
    weights: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
    },
} as const;

export const spacing = {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    xxl: '20px',
    panel: '16px',
} as const;

export const radial = {
    radius: 100,
    innerRatio: 0.55,
    bgFill: 0xffffff,
    bgAlpha: 0.96,
    selectedFill: 0x2979ff,
    selectedAlpha: 0.15,
    stroke: 0xd0d5e0,
    centerFill: 0xf5f6f9,
    centerStroke: 0xd0d5e0,
    labelColor: '#1a2233',
    labelSelectedColor: '#2979FF',
} as const;

export const KIND_LABELS: Record<NodeKind, string> = {
    LB: 'LB',
    API: 'API',
    DB: 'DB',
    CACHE: 'CACHE',
    QUEUE: 'QUEUE',
    WORKER: 'WORKER',
};
