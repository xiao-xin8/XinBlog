import { useMemo } from 'react';
import { createTheme, type ThemeOptions, alpha } from '@mui/material/styles';
import { getActiveColors, useThemeConfigStore, type CustomThemeConfig } from '@/stores/themeConfigStore';
import { useThemeStore } from '@/stores/themeStore';
import { themePresets } from '@/types/theme';
declare module '@mui/material/styles' {
  interface Palette {
    gradient: {
      primary: string;
      hero: string;
    };
  }
  interface PaletteOptions {
    gradient?: {
      primary?: string;
      hero?: string;
    };
  }
}
export const getThemeOptions = (
  mode: 'light' | 'dark',
  config?: Partial<CustomThemeConfig>
): ThemeOptions => {
  const storeConfig = useThemeConfigStore.getState();
  const activeConfig: CustomThemeConfig = { ...storeConfig, ...config };
  const colors = getActiveColors(activeConfig);
  const { borderRadius } = activeConfig;
  const preset = themePresets.find((p) => p.id === activeConfig.presetId);
  const isSolid = Boolean(preset?.solid);
  return {
    palette: {
      mode,
      primary: {
        main: colors.primary,
        light: colors.primaryLight,
        dark: colors.primaryDark,
        contrastText: '#ffffff',
      },
      secondary: {
        main: colors.secondary,
        light: colors.secondaryLight,
        dark: colors.secondaryDark,
        contrastText: '#ffffff',
      },
      background: {
        default: mode === 'light' ? '#f5f7ff' : '#0f111a',
        paper: mode === 'light' ? '#ffffff' : '#1a1d2e',
      },
      text: {
        primary: mode === 'light' ? '#1a1d2e' : '#e8eaf6',
        secondary: mode === 'light' ? '#5d6273' : '#9fa3b5',
      },
      divider:
        mode === 'light'
          ? alpha(colors.primary, 0.12)
          : alpha('#ffffff', 0.08),
      gradient: {
        primary: isSolid
          ? colors.primary
          : `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
        hero: isSolid
          ? alpha(colors.primary, 0.1)
          : mode === 'light'
            ? `linear-gradient(135deg, ${colors.primary}18 0%, ${colors.secondary}18 100%)`
            : `linear-gradient(135deg, ${colors.primary}18 0%, ${colors.secondary}18 100%)`,
      },
    },
    typography: {
      fontFamily: '"Inter", "PingFang SC", "Microsoft YaHei", sans-serif',
      h1: {
        fontWeight: 700,
        letterSpacing: '-0.02em',
      },
      h2: {
        fontWeight: 700,
        letterSpacing: '-0.01em',
      },
      h3: {
        fontWeight: 600,
      },
      h4: {
        fontWeight: 600,
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    shape: {
      borderRadius,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: Math.max(8, borderRadius - 4),
            boxShadow: 'none',
            '&:hover': {
              boxShadow: `0 4px 12px ${colors.primary}40`,
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: Math.max(8, borderRadius),
            boxShadow:
              theme.palette.mode === 'light'
                ? `0 4px 20px ${colors.primary}14`
                : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow:
                theme.palette.mode === 'light'
                  ? `0 8px 30px ${colors.primary}26`
                  : `0 8px 30px ${alpha(theme.palette.common.black, 0.35)}`,
            },
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: Math.max(6, borderRadius - 6),
            fontWeight: 500,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: 'none',
            boxShadow:
              theme.palette.mode === 'light'
                ? `0 1px 0 ${colors.primary}1a`
                : `0 1px 0 ${alpha('#ffffff', 0.05)}`,
          }),
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRight: 'none',
            boxShadow:
              theme.palette.mode === 'light'
                ? `4px 0 24px ${colors.primary}14`
                : `4px 0 24px ${alpha(theme.palette.common.black, 0.3)}`,
          }),
        },
      },
    },
  };
};
export const createAppTheme = (mode: 'light' | 'dark', config?: Partial<CustomThemeConfig>) =>
  createTheme(getThemeOptions(mode, config));
export function useAppTheme() {
  const { mode } = useThemeStore();
  const presetId = useThemeConfigStore((state) => state.presetId);
  const useCustomColors = useThemeConfigStore((state) => state.useCustomColors);
  const customColors = useThemeConfigStore((state) => state.customColors);
  const borderRadius = useThemeConfigStore((state) => state.borderRadius);
  return useMemo(
    () => createAppTheme(mode, { presetId, useCustomColors, customColors, borderRadius }),
    [mode, presetId, useCustomColors, customColors, borderRadius]
  );
}