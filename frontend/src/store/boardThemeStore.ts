import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BoardTheme {
  name: string;
  label: string;
  light: string;
  dark: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  { name: 'classic',   label: 'Classic',   light: '#f0d9b5', dark: '#b58863' },
  { name: 'green',     label: 'Green',     light: '#f0d9b5', dark: '#4a7c59' },
  { name: 'blue',      label: 'Blue',      light: '#dee3e6', dark: '#788a94' },
  { name: 'navy',      label: 'Navy',      light: '#e8edf9', dark: '#4d7ab5' },
  { name: 'walnut',    label: 'Walnut',    light: '#e3c28a', dark: '#7a4d2a' },
  { name: 'ice',       label: 'Ice',       light: '#e8f4f8', dark: '#5b9ab5' },
  { name: 'purple',    label: 'Purple',    light: '#ede0f5', dark: '#7e57c2' },
  { name: 'midnight',  label: 'Midnight',  light: '#d0d8e4', dark: '#1a3a6c' },
  { name: 'slate',     label: 'Slate',     light: '#d5d8dc', dark: '#4a5568' },
  { name: 'coral',     label: 'Coral',     light: '#fef3e2', dark: '#c0392b' },
];

interface BoardThemeState {
  themeName: string;
  setTheme: (name: string) => void;
  getTheme: () => BoardTheme;
}

export const useBoardThemeStore = create<BoardThemeState>()(
  persist(
    (set, get) => ({
      themeName: 'classic',
      setTheme: (name) => set({ themeName: name }),
      getTheme: () =>
        BOARD_THEMES.find((t) => t.name === get().themeName) ?? BOARD_THEMES[0],
    }),
    { name: 'chess-insight-board-theme' },
  ),
);
