import * as React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { vars } from 'nativewind';
import {
  DEFAULT_ACCENT,
  DEFAULT_THEME,
  paletteToVars,
  resolvePalette,
  themeById,
  type AccentId,
  type ThemeId,
} from '@/lib/themes';

const STORAGE_KEY = '@actually-usable-calendar/theme';

interface ThemeContextValue {
  /** Whether stored preferences have been loaded */
  ready: boolean;
  themeId: ThemeId;
  accentId: AccentId;
  isDark: boolean;
  setTheme: (id: ThemeId) => void;
  setAccent: (id: AccentId) => void;
  /** NativeWind `vars()` style — spread onto the root view to apply the palette */
  style: object;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME);
  const [accentId, setAccentId] = useState<AccentId>(DEFAULT_ACCENT);
  const [ready, setReady] = useState(false);

  // Load persisted preferences once.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as { themeId?: ThemeId; accentId?: AccentId };
        if (parsed.themeId) setThemeId(parsed.themeId);
        if (parsed.accentId) setAccentId(parsed.accentId);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on change (after hydration so defaults don't overwrite stored values).
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ themeId, accentId })).catch(
      () => undefined
    );
  }, [ready, themeId, accentId]);

  const style = useMemo(
    () => vars(paletteToVars(resolvePalette(themeId, accentId))),
    [themeId, accentId]
  );

  const setTheme = useCallback((id: ThemeId) => setThemeId(id), []);
  const setAccent = useCallback((id: AccentId) => setAccentId(id), []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      ready,
      themeId,
      accentId,
      isDark: themeById(themeId).mode === 'dark',
      setTheme,
      setAccent,
      style,
    }),
    [ready, themeId, accentId, setTheme, setAccent, style]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
