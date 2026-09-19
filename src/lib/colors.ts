export interface SubjectColor {
  /** Left accent bar / main border color */
  accent: string;
  /** Translucent background tint */
  bg: string;
  /** Text color leaning toward the subject hue */
  text: string;
}

/**
 * Curated subject palette. Each entry is a hex accent plus a lighter text
 * variant for dark backgrounds; light themes reuse the accent, darkened.
 */
const PALETTE: { accent: string; text: string }[] = [
  { accent: '#8b5cf6', text: '#c4b5fd' }, // violet
  { accent: '#3b82f6', text: '#93c5fd' }, // blue
  { accent: '#06b6d4', text: '#67e8f9' }, // cyan
  { accent: '#10b981', text: '#6ee7b7' }, // emerald
  { accent: '#84cc16', text: '#bef264' }, // lime
  { accent: '#f59e0b', text: '#fcd34d' }, // amber
  { accent: '#ec4899', text: '#f9a8d4' }, // pink
  { accent: '#ef4444', text: '#fca5a5' }, // red
  { accent: '#f97316', text: '#fdba74' }, // orange
  { accent: '#a855f7', text: '#d8b4fe' }, // purple
  { accent: '#14b8a6', text: '#5eead4' }, // teal
  { accent: '#6366f1', text: '#a5b4fc' }, // indigo
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Multiplies each channel by `factor` (0–1): 0.7 = darken 30%. */
function shade(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const to2 = (n: number) => Math.round(n * factor).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

const CACHE = new Map<string, SubjectColor>();

function colorFor(subject: string, mode: 'dark' | 'light'): SubjectColor {
  const key = `${subject}|${mode}`;
  const cached = CACHE.get(key);
  if (cached) return cached;

  const palette = PALETTE[hashString(subject.toLowerCase()) % PALETTE.length];
  const color: SubjectColor =
    mode === 'dark'
      ? {
          accent: palette.accent,
          bg: hexToRgba(palette.accent, 0.14),
          text: palette.text,
        }
      : {
          accent: shade(palette.accent, 0.75),
          bg: hexToRgba(shade(palette.accent, 0.8), 0.12),
          text: shade(palette.accent, 0.45),
        };
  CACHE.set(key, color);
  return color;
}

/** Subject color tuned for dark backgrounds (the default themes). */
export function subjectColor(subject: string): SubjectColor {
  return colorFor(subject, 'dark');
}

/** Subject color tuned for light backgrounds (Crimson / Light themes). */
export function lightSubjectColor(subject: string): SubjectColor {
  return colorFor(subject, 'light');
}
