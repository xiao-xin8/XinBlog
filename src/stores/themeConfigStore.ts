import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSiteStore } from '@/stores/siteStore';
import { themePresets, type ThemeColorConfig } from '@/types/theme';

export interface CustomThemeConfig {
  presetId: string;
  customColors: ThemeColorConfig;
  useCustomColors: boolean;
  borderRadius: number;
  loaded: boolean;
  loadConfig: () => Promise<void>;
  saveConfig: (config: Partial<Omit<CustomThemeConfig, 'loaded' | 'loadConfig' | 'saveConfig'>>) => Promise<boolean>;
}

const defaultPreset = themePresets[0];

const initialState: Omit<CustomThemeConfig, 'loadConfig' | 'saveConfig'> = {
  presetId: defaultPreset.id,
  customColors: { ...defaultPreset.colors },
  useCustomColors: false,
  borderRadius: 16,
  loaded: false,
};

function applyThemePatch(patch: Partial<CustomThemeConfig>): Partial<CustomThemeConfig> {
  const next: Partial<CustomThemeConfig> = { loaded: true };
  if (patch.presetId !== undefined) next.presetId = patch.presetId;
  if (patch.useCustomColors !== undefined) next.useCustomColors = patch.useCustomColors;
  if (patch.customColors !== undefined) next.customColors = patch.customColors;
  if (patch.borderRadius !== undefined) {
    next.borderRadius = Math.min(32, Math.max(0, patch.borderRadius));
  }
  return next;
}

export const useThemeConfigStore = create<CustomThemeConfig>()(
  persist(
    (set, get) => ({
      ...initialState,

      loadConfig: async () => {
        
        const siteTheme = useSiteStore.getState().config.theme;
        if (siteTheme) {
          set(applyThemePatch(siteTheme));
          return;
        }
        set({ loaded: true });
      },

      saveConfig: async (newConfig) => {
        const merged = {
          presetId: get().presetId,
          customColors: get().customColors,
          useCustomColors: get().useCustomColors,
          borderRadius: get().borderRadius,
          ...newConfig,
        };

        
        set({ ...merged, loaded: true });
        return true;
      },
    }),
    {
      name: 'theme-config',
      merge: (persistedState, currentState) => {
        const merged = { ...currentState, ...(persistedState as CustomThemeConfig) };
        
        if (merged.borderRadius > 32) {
          merged.borderRadius = 32;
        }
        return merged;
      },
    }
  )
);

export function getActiveColors(config: CustomThemeConfig): ThemeColorConfig {
  if (config.useCustomColors) {
    return config.customColors;
  }
  const preset = themePresets.find((p) => p.id === config.presetId) || defaultPreset;
  return preset.colors;
}
