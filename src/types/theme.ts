export interface ThemeColorConfig {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  nameEn: string;
  colors: ThemeColorConfig;
  solid?: boolean;
}

export const themePresets: ThemePreset[] = [
  {
    id: 'aurora',
    name: '极光',
    nameEn: 'Aurora',
    colors: {
      primary: '#14b8a6',
      primaryLight: '#2dd4bf',
      primaryDark: '#0d9488',
      secondary: '#06b6d4',
      secondaryLight: '#22d3ee',
      secondaryDark: '#0891b2',
    },
  },
  {
    id: 'sunset',
    name: '落日',
    nameEn: 'Sunset',
    colors: {
      primary: '#f97316',
      primaryLight: '#fb923c',
      primaryDark: '#ea580c',
      secondary: '#ec4899',
      secondaryLight: '#f472b6',
      secondaryDark: '#db2777',
    },
  },
  {
    id: 'ocean',
    name: '海洋',
    nameEn: 'Ocean',
    colors: {
      primary: '#06b6d4',
      primaryLight: '#22d3ee',
      primaryDark: '#0891b2',
      secondary: '#3b82f6',
      secondaryLight: '#60a5fa',
      secondaryDark: '#2563eb',
    },
  },
  {
    id: 'sakura',
    name: '樱雾',
    nameEn: 'Sakura',
    colors: {
      primary: '#f472b6',
      primaryLight: '#f9a8d4',
      primaryDark: '#db2777',
      secondary: '#c084fc',
      secondaryLight: '#d8b4fe',
      secondaryDark: '#a855f7',
    },
  },
  {
    id: 'emerald',
    name: '翡翠',
    nameEn: 'Emerald',
    colors: {
      primary: '#10b981',
      primaryLight: '#34d399',
      primaryDark: '#059669',
      secondary: '#14b8a6',
      secondaryLight: '#2dd4bf',
      secondaryDark: '#0d9488',
    },
  },
  {
    id: 'noir',
    name: '墨夜',
    nameEn: 'Noir',
    solid: true,
    colors: {
      primary: '#1f2937',
      primaryLight: '#374151',
      primaryDark: '#0f172a',
      secondary: '#1f2937',
      secondaryLight: '#374151',
      secondaryDark: '#0f172a',
    },
  },
  {
    id: 'sand',
    name: '暖砂',
    nameEn: 'Sand',
    solid: true,
    colors: {
      primary: '#b08968',
      primaryLight: '#c9a87e',
      primaryDark: '#8a6d4f',
      secondary: '#b08968',
      secondaryLight: '#c9a87e',
      secondaryDark: '#8a6d4f',
    },
  },
  {
    id: 'slate',
    name: '黛蓝',
    nameEn: 'Slate',
    solid: true,
    colors: {
      primary: '#475569',
      primaryLight: '#64748b',
      primaryDark: '#334155',
      secondary: '#475569',
      secondaryLight: '#64748b',
      secondaryDark: '#334155',
    },
  },
  {
    id: 'rosegold',
    name: '玫瑰金',
    nameEn: 'Rose Gold',
    solid: true,
    colors: {
      primary: '#bd8063',
      primaryLight: '#d4a08a',
      primaryDark: '#9c6249',
      secondary: '#bd8063',
      secondaryLight: '#d4a08a',
      secondaryDark: '#9c6249',
    },
  },
  {
    id: 'forest',
    name: '森野',
    nameEn: 'Forest',
    solid: true,
    colors: {
      primary: '#4d7c5f',
      primaryLight: '#6a9b7d',
      primaryDark: '#365940',
      secondary: '#4d7c5f',
      secondaryLight: '#6a9b7d',
      secondaryDark: '#365940',
    },
  },
];
