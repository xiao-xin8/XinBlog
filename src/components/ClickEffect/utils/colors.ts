import type { ClickEffectColorMode } from '@/types';

const MACARON_COLORS = [
  '#f472b6',
  '#fb7185',
  '#f87171',
  '#fb923c',
  '#fbbf24',
  '#a3e635',
  '#34d399',
  '#22d3ee',
  '#60a5fa',
  '#818cf8',
  '#a78bfa',
  '#c084fc',
  '#f9a8d4',
  '#fda4af',
];

export function getRandomColor(): string {
  return MACARON_COLORS[Math.floor(Math.random() * MACARON_COLORS.length)];
}

export function resolveEffectColor(
  colorMode: ClickEffectColorMode,
  customColor: string | undefined,
  themeColor: string
): string {
  if (colorMode === 'custom' && customColor) return customColor;
  if (colorMode === 'random') return getRandomColor();
  return themeColor;
}

export function resolveEffectColors(
  colorMode: ClickEffectColorMode,
  customColor: string | undefined,
  themeColor: string,
  count: number
): string[] {
  if (colorMode === 'custom' && customColor) return Array(count).fill(customColor);
  if (colorMode === 'random') return Array.from({ length: count }, getRandomColor);
  return Array(count).fill(themeColor);
}
