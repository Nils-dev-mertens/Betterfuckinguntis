/**
 * Theme catalog. Every palette is a set of raw HSL triplets (`H S% L%`)
 * matching the variables in global.css — the tailwind config wraps each one
 * in hsl(var(--x)), so switching a theme (or accent) is just re-assigning
 * these values at runtime.
 *
 * Dark presets are intentionally *not* accent-only variants: each theme
 * tints the whole surface stack (background, cards, borders, muted text)
 * with its own hue, so Ocean reads blue, Forest reads green, etc. — not
 * "the same dark grey with a different button color".
 */
export interface Palette {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
}

export type ThemeMode = 'dark' | 'light';
export type ThemeId =
  | 'default'
  | 'violet'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'mono'
  | 'crimson'
  | 'light';
export type AccentId = 'none' | 'violet' | 'blue' | 'teal' | 'green' | 'amber' | 'red' | 'pink';

export interface ThemeDef {
  id: ThemeId;
  name: string;
  mode: ThemeMode;
  palette: Palette;
}

/**
 * Builds a dark palette whose surfaces carry the theme hue. Neutral strength
 * controls how far the tint is pushed: 0 = pure grey, higher = moodier.
 */
function darkPalette(
  hue: number,
  opts: {
    /** 0–1: how much of the hue bleeds into surfaces (default 0.35) */
    tint?: number;
    sat?: number;
    bgL?: number;
    cardL?: number;
    primaryL?: number;
    accentL?: number;
    mutedL?: number;
  } = {}
): Palette {
  const t = Math.min(1, Math.max(0, opts.tint ?? 0.35));
  const sat = opts.sat ?? 90;
  const bgL = opts.bgL ?? 7;
  const cardL = opts.cardL ?? 10;
  const primaryL = opts.primaryL ?? 66;
  const accentL = opts.accentL ?? 22;
  const mutedL = opts.mutedL ?? 15;

  // Surface saturation scales with tint: untinted stays grey, tinted themes
  // get clearly colored backgrounds.
  const s = (base: number) => Math.round(base * t);
  const borderHsl = `${hue} ${s(14)}% ${cardL + 7}%`;

  return {
    background: `${hue} ${s(30)}% ${bgL}%`,
    foreground: `${hue} ${s(12)}% 95%`,
    card: `${hue} ${s(28)}% ${cardL}%`,
    cardForeground: `${hue} ${s(12)}% 95%`,
    popover: `${hue} ${s(26)}% ${cardL + 1}%`,
    popoverForeground: `${hue} ${s(12)}% 95%`,
    primary: `${hue} ${sat}% ${primaryL}%`,
    primaryForeground: `0 0% 100%`,
    secondary: `${hue} ${s(18)}% ${mutedL}%`,
    secondaryForeground: `${hue} ${s(16)}% 90%`,
    muted: `${hue} ${s(18)}% ${mutedL}%`,
    mutedForeground: `${hue} ${s(10)}% 62%`,
    accent: `${hue} ${Math.round(s(40) + 10)}% ${accentL}%`,
    accentForeground: `${hue} 95% 86%`,
    destructive: `0 72% 55%`,
    destructiveForeground: `0 0% 100%`,
    border: borderHsl,
    input: borderHsl,
    ring: `${hue} ${sat}% ${primaryL}%`,
  };
}

export const THEMES: ThemeDef[] = [
  // Calm violet-grey — the original look.
  { id: 'default', name: 'Default', mode: 'dark', palette: darkPalette(258, { tint: 0.3 }) },
  // Deep purple: visibly purple background, magenta-leaning primary.
  { id: 'violet', name: 'Violet', mode: 'dark', palette: darkPalette(276, { tint: 0.55, primaryL: 70 }) },
  // Blue-black: cold navy surfaces, sky-blue primary.
  { id: 'ocean', name: 'Ocean', mode: 'dark', palette: darkPalette(215, { tint: 0.6, primaryL: 62 }) },
  // Green-black: pine surfaces, mint primary.
  { id: 'forest', name: 'Forest', mode: 'dark', palette: darkPalette(155, { tint: 0.5, primaryL: 55, sat: 75 }) },
  // Warm brown-amber: ember-tinted surfaces, orange primary.
  { id: 'sunset', name: 'Sunset', mode: 'dark', palette: darkPalette(24, { tint: 0.5, primaryL: 62, sat: 85 }) },
  // Pure greyscale — no hue anywhere.
  { id: 'mono', name: 'Mono', mode: 'dark', palette: darkPalette(240, { tint: 0, sat: 0, primaryL: 72 }) },
  {
    id: 'crimson',
    name: 'Crimson',
    mode: 'light',
    // White with red — clean paper background, red as the only accent.
    palette: {
      background: `0 0% 100%`,
      foreground: `0 0% 10%`,
      card: `0 0% 98%`,
      cardForeground: `0 0% 10%`,
      popover: `0 0% 99%`,
      popoverForeground: `0 0% 10%`,
      primary: `0 72% 48%`,
      primaryForeground: `0 0% 100%`,
      secondary: `0 0% 95%`,
      secondaryForeground: `0 0% 12%`,
      muted: `0 0% 95%`,
      mutedForeground: `0 0% 42%`,
      accent: `0 85% 95%`,
      accentForeground: `0 70% 30%`,
      destructive: `0 72% 48%`,
      destructiveForeground: `0 0% 100%`,
      border: `0 0% 88%`,
      input: `0 0% 88%`,
      ring: `0 72% 48%`,
    },
  },
  {
    id: 'light',
    name: 'Light',
    mode: 'light',
    palette: {
      background: `0 0% 100%`,
      foreground: `240 10% 4%`,
      card: `0 0% 98%`,
      cardForeground: `240 10% 4%`,
      popover: `0 0% 99%`,
      popoverForeground: `240 10% 4%`,
      primary: `258 90% 56%`,
      primaryForeground: `0 0% 100%`,
      secondary: `240 5% 94%`,
      secondaryForeground: `240 6% 10%`,
      muted: `240 5% 94%`,
      mutedForeground: `240 4% 44%`,
      accent: `258 60% 92%`,
      accentForeground: `258 70% 32%`,
      destructive: `0 72% 48%`,
      destructiveForeground: `0 0% 100%`,
      border: `240 6% 88%`,
      input: `240 6% 88%`,
      ring: `258 90% 56%`,
    },
  },
];

/** Accent overrides — applied on top of any theme's primary/ring/accent. */
export const ACCENTS: { id: AccentId; name: string; hsl: string }[] = [
  { id: 'none', name: 'Theme default', hsl: '' },
  { id: 'violet', name: 'Violet', hsl: '258 90% 66%' },
  { id: 'blue', name: 'Blue', hsl: '214 90% 60%' },
  { id: 'teal', name: 'Teal', hsl: '176 75% 44%' },
  { id: 'green', name: 'Green', hsl: '145 70% 48%' },
  { id: 'amber', name: 'Amber', hsl: '38 92% 56%' },
  { id: 'red', name: 'Red', hsl: '0 80% 60%' },
  { id: 'pink', name: 'Pink', hsl: '330 85% 62%' },
];

export const DEFAULT_THEME: ThemeId = 'default';
export const DEFAULT_ACCENT: AccentId = 'none';

export function themeById(id: ThemeId): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function accentById(id: AccentId) {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}

/**
 * Resolves the final palette: the theme's own values, with primary, ring and
 * accent-family variables replaced when a custom accent is chosen. Accent
 * text colors derive from the accent hue so custom accents stay readable.
 */
export function resolvePalette(themeId: ThemeId, accentId: AccentId): Palette {
  const theme = themeById(themeId);
  const accent = accentById(accentId);
  if (accent.id === 'none') return theme.palette;
  const p = theme.palette;
  const hue = accent.hsl.split(' ')[0];
  return {
    ...p,
    primary: accent.hsl,
    ring: accent.hsl,
    primaryForeground: '0 0% 100%',
    accent: theme.mode === 'dark' ? '0 0% 15%' : `${hue} 60% 94%`,
    accentForeground: theme.mode === 'dark' ? `${hue} 95% 86%` : `${hue} 70% 28%`,
  };
}

/** Maps a palette onto the CSS variable names used across the app. */
export function paletteToVars(palette: Palette): Record<string, string> {
  return {
    '--background': palette.background,
    '--foreground': palette.foreground,
    '--card': palette.card,
    '--card-foreground': palette.cardForeground,
    '--popover': palette.popover,
    '--popover-foreground': palette.popoverForeground,
    '--primary': palette.primary,
    '--primary-foreground': palette.primaryForeground,
    '--secondary': palette.secondary,
    '--secondary-foreground': palette.secondaryForeground,
    '--muted': palette.muted,
    '--muted-foreground': palette.mutedForeground,
    '--accent': palette.accent,
    '--accent-foreground': palette.accentForeground,
    '--destructive': palette.destructive,
    '--destructive-foreground': palette.destructiveForeground,
    '--border': palette.border,
    '--input': palette.input,
    '--ring': palette.ring,
  };
}
