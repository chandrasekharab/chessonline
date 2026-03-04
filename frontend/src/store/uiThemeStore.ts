import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UITheme = 'dark' | 'light' | 'system';

interface UIThemeState {
  theme: UITheme;
  setTheme: (t: UITheme) => void;
  /** Resolved theme considering system preference */
  resolved: () => 'dark' | 'light';
}

function resolveTheme(theme: UITheme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return theme;
}

export const useUIThemeStore = create<UIThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (t) => set({ theme: t }),
      resolved: () => resolveTheme(get().theme),
    }),
    { name: 'chess-insight-ui-theme' },
  ),
);
