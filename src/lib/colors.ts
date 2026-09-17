export interface SubjectColor {
  /** Left accent bar / main border color */
  accent: string;
  /** Translucent background tint */
  bg: string;
  /** Text color leaning toward the subject hue */
  text: string;
}

/**
 * Curated palette tuned for the dark theme. Each entry is a hex color plus a
 * translucent background derived from it.
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

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const CACHE = new Map<string, SubjectColor>();

export function subjectColor(subject: string): SubjectColor {
  const cached = CACHE.get(subject);
  if (cached) return cached;

  const palette = PALETTE[hashString(subject.toLowerCase()) % PALETTE.length];
  const color: SubjectColor = {
    accent: palette.accent,
    bg: hexToRgba(palette.accent, 0.14),
    text: palette.text,
  };
  CACHE.set(subject, color);
  return color;
}