import { create } from 'zustand';
import { persist } from 'zustand/middleware';
interface ThemeState {
  mode: 'light' | 'dark';
  toggleMode: () => void;
  setMode: (mode: 'light' | 'dark') => void;
}
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: (() => {
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('theme-mode');
          if (stored === 'light' || stored === 'dark') return stored;
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'light';
      })(),
      toggleMode: () => set((state) => ({ mode: state.mode === 'light' ? 'dark' : 'light' })),
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'theme-mode',
    }
  )
);