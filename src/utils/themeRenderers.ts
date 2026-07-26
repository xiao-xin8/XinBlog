import { alpha } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { Post, SiteConfig, PostCardThemeConfig, ThemeParamSchema, ThemeParamOption } from '@/types';

export interface PostCardRenderContext {
  post: Post;
  config: SiteConfig;
  themeColor: string;
  borderRadius: number;
}

export interface PostCardRenderOutput {
  layout: 'overlay' | 'clean';
  mediaAsBackground?: boolean;
  root?: SxProps<Theme>;
  media?: SxProps<Theme>;
  overlay?: SxProps<Theme>;
  content?: SxProps<Theme>;
  tag?: SxProps<Theme>;
  title?: SxProps<Theme>;
  excerpt?: SxProps<Theme>;
  meta?: SxProps<Theme>;
}

export interface PostCardRenderer<P = Record<string, unknown>> {
  id: string;
  name: string;
  description?: string;
  aliases?: string[];
  defaultParams: P;
  schema: ThemeParamSchema[];
  render: (params: P, context: PostCardRenderContext) => PostCardRenderOutput;
}

const textPositionOptions: ThemeParamOption[] = [
  { value: 'bottom-left', label: '左下角' },
  { value: 'bottom-center', label: '底部居中' },
  { value: 'bottom-right', label: '右下角' },
];

const titleSizeOptions: ThemeParamOption[] = [
  { value: 'small', label: '小' },
  { value: 'medium', label: '中' },
  { value: 'large', label: '大' },
];

function titleSizeValue(size?: string): string {
  if (!size || size === 'medium') return '1.25rem';
  if (size === 'small') return '1rem';
  if (size === 'large') return '1.5rem';
  return size;
}

function isEmptyColor(v?: string): boolean {
  if (!v) return true;
  const s = v.trim().toLowerCase();
  return ['#000', '#000000', '000000', '000', 'rgb(0,0,0)', 'rgba(0,0,0,0)', 'transparent'].includes(s);
}

function resolveColor(value: string | undefined, fallback: string): string {
  
  return isEmptyColor(value) ? fallback : (value as string);
}

function resolveBorderColor(params: { borderColor?: string }, themeColor: string): string {
  return resolveColor(params.borderColor, themeColor || '#5b7cfa');
}

function resolveBorderRadius(params: { borderRadius?: number }, siteRadius: number): number {
  return params.borderRadius ?? siteRadius ?? 16;
}

function applyParamsToStyles<T>(styles: T, params: Record<string, unknown>): T {
  if (typeof styles === 'string') {
    return styles.replace(/\{\{\s*([^{}\s]+)\s*\}\}/g, (_, key) => {
      const v = params[key];
      return v !== undefined ? String(v) : `{{${key}}}`;
    }) as unknown as T;
  }
  if (Array.isArray(styles)) {
    return styles.map((item) => applyParamsToStyles(item, params)) as unknown as T;
  }
  if (styles && typeof styles === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(styles)) {
      result[k] = applyParamsToStyles(v, params);
    }
    return result as T;
  }
  return styles;
}

export function renderCloudCardStyles(
  theme: PostCardThemeConfig,
  context: PostCardRenderContext
): PostCardRenderOutput {
  const layout = theme.layout === 'overlay' ? 'overlay' : 'clean';
  const styleParams = {
    themeColor: context.themeColor,
    borderRadius: context.borderRadius,
    ...(theme.params || {}),
  };
  const resolved = theme.styles ? applyParamsToStyles(theme.styles, styleParams) : {};
  const output: PostCardRenderOutput = {
    layout,
    mediaAsBackground: layout === 'overlay',
    ...resolved,
  };
  if (layout === 'overlay' && !output.media) {
    output.media = {
      position: 'absolute',
      inset: 0,
      zIndex: 0,
      backgroundImage: context.post.cover ? `url(${context.post.cover})` : undefined,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return output;
}

export function buildPostCardOutput(
  theme: PostCardThemeConfig,
  context: PostCardRenderContext
): PostCardRenderOutput | null {
  const renderer = getPostCardRenderer(theme.variant);
  const styleParams = {
    themeColor: context.themeColor,
    borderRadius: context.borderRadius,
    ...(theme.params || {}),
  };
  let output: PostCardRenderOutput;
  if (renderer) {
    const params = { ...(theme.params || {}), ...theme };
    output = renderer.render(params, context);
    if (theme.styles) {
      output = {
        ...output,
        ...applyParamsToStyles(theme.styles, styleParams),
      };
    }
  } else if (theme.styles) {
    output = renderCloudCardStyles(theme, context);
  } else {
    return null;
  }
  return output;
}

export const overlayCardRenderer: PostCardRenderer<{
  borderWidth: number;
  borderRadius: number;
  borderColor: string;
  backgroundColor: string;
  titleSize: 'small' | 'medium' | 'large';
  textPosition: 'bottom-left' | 'bottom-center' | 'bottom-right';
  textColor: string;
  showExcerpt: boolean;
  showTags: boolean;
  showMeta: boolean;
}> = {
  id: 'overlay-card',
  name: '叠加画报',
  description: '以文章封面作为背景，底部叠加文字的画报风格卡片。',
  aliases: ['border-image'],
  defaultParams: {
    borderWidth: 4,
    borderRadius: 24,
    borderColor: '',
    backgroundColor: '',
    titleSize: 'large',
    textPosition: 'bottom-left',
    textColor: '#ffffff',
    showExcerpt: true,
    showTags: true,
    showMeta: true,
  },
  schema: [
    { key: 'borderWidth', label: '边框宽度', type: 'number', min: 0, max: 12, step: 1 },
    { key: 'textPosition', label: '文字位置', type: 'select', options: textPositionOptions },
    { key: 'titleSize', label: '标题大小', type: 'select', options: titleSizeOptions },
    { key: 'showExcerpt', label: '显示摘要', type: 'boolean' },
    { key: 'showTags', label: '显示标签', type: 'boolean' },
    { key: 'showMeta', label: '显示阅读时间等元信息', type: 'boolean' },
  ],
  render: (params, { post, config, themeColor }) => {
    const borderColor = resolveBorderColor(params, themeColor);
    const borderRadius = resolveBorderRadius(params, config.theme?.borderRadius ?? 16);
    const alignItems =
      params.textPosition === 'bottom-center'
        ? 'center'
        : params.textPosition === 'bottom-right'
          ? 'flex-end'
          : 'flex-start';
    const textAlign =
      params.textPosition === 'bottom-center'
        ? 'center'
        : params.textPosition === 'bottom-right'
          ? 'right'
          : 'left';

    return {
      layout: 'overlay',
      mediaAsBackground: true,
      root: {
        position: 'relative',
        height: { xs: 260, sm: 300, md: 340 },
        minWidth: 0,
        overflow: 'hidden',
        borderRadius: `${borderRadius}px`,
        border: `${params.borderWidth}px solid ${borderColor}`,
        backgroundColor: post.cover ? 'common.black' : resolveColor(params.backgroundColor, alpha(themeColor, 0.1)),
        transition: 'box-shadow 0.2s ease',
        '@media (hover: hover) and (pointer: fine)': {
          '&:hover': {
            boxShadow: (theme) =>
              theme.palette.mode === 'light'
                ? `0 8px 30px ${alpha(borderColor, 0.25)}`
                : `0 8px 30px ${alpha(theme.palette.common.black, 0.35)}`,
          },
        },
      },
      media: {
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        backgroundImage: post.cover ? `url(${post.cover})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      },
      overlay: {
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        background: (theme) =>
          `linear-gradient(to top, ${alpha(theme.palette.common.black, 0.72)} 0%, ${alpha(
            theme.palette.common.black,
            0.2
          )} 50%, ${alpha(theme.palette.common.black, 0)} 100%)`,
      },
      content: {
        position: 'relative',
        zIndex: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems,
        textAlign,
        p: { xs: 2, sm: 3 },
      },
      tag: {
        backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.2),
        color: 'common.white',
        fontWeight: 500,
        backdropFilter: 'blur(4px)',
      },
      title: {
        fontWeight: 700,
        mb: params.showExcerpt ? 1 : 0,
        lineHeight: 1.3,
        fontSize: titleSizeValue(params.titleSize),
        overflowWrap: 'break-word',
        color: params.textColor || 'common.white',
        textShadow: '0 2px 8px rgba(0,0,0,0.4)',
      },
      excerpt: {
        mb: params.showMeta ? 1.5 : 0,
        lineHeight: 1.6,
        fontSize: { xs: '0.875rem', sm: '0.9375rem' },
        overflowWrap: 'break-word',
        color: 'rgba(255,255,255,0.85)',
        textShadow: '0 1px 4px rgba(0,0,0,0.4)',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      },
      meta: {
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
        color: 'rgba(255,255,255,0.75)',
        typography: 'caption',
        justifyContent: alignItems,
      },
    };
  },
};

export const cleanCardRenderer: PostCardRenderer<{
  borderWidth: number;
  borderRadius: number;
  borderColor: string;
  backgroundColor: string;
  titleSize: 'small' | 'medium' | 'large';
  showExcerpt: boolean;
  showTags: boolean;
  showMeta: boolean;
}> = {
  id: 'clean-card',
  name: '简洁卡片',
  description: '顶部展示封面，下方展示文字信息的经典卡片布局。',
  defaultParams: {
    borderWidth: 0,
    borderRadius: 16,
    borderColor: '',
    backgroundColor: '',
    titleSize: 'medium',
    showExcerpt: true,
    showTags: true,
    showMeta: true,
  },
  schema: [
    { key: 'borderWidth', label: '边框宽度', type: 'number', min: 0, max: 12, step: 1 },
    { key: 'titleSize', label: '标题大小', type: 'select', options: titleSizeOptions },
    { key: 'showExcerpt', label: '显示摘要', type: 'boolean' },
    { key: 'showTags', label: '显示标签', type: 'boolean' },
    { key: 'showMeta', label: '显示阅读时间等元信息', type: 'boolean' },
  ],
  render: (params, { config, themeColor }) => {
    const borderColor = resolveBorderColor(params, themeColor);
    const borderRadius = resolveBorderRadius(params, config.theme?.borderRadius ?? 16);

    return {
      layout: 'clean',
      mediaAsBackground: false,
      root: {
        textDecoration: 'none',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: { xs: 380, sm: 420 },
        minWidth: 0,
        overflow: 'hidden',
        borderRadius: `${borderRadius}px`,
        border: `${params.borderWidth}px solid ${borderColor}`,
        backgroundColor: resolveColor(params.backgroundColor, alpha(themeColor, 0.08)),
        transition: 'box-shadow 0.2s ease',
        '@media (hover: hover) and (pointer: fine)': {
          '&:hover': {
            boxShadow: (theme) =>
              theme.palette.mode === 'light'
                ? `0 8px 30px ${alpha(theme.palette.primary.main, 0.18)}`
                : `0 8px 30px ${alpha(theme.palette.common.black, 0.35)}`,
          },
        },
      },
      media: {
        width: '100%',
        height: { xs: 160, sm: 180, md: 200 },
        borderRadius: () => `${borderRadius}px ${borderRadius}px 0 0`,
        overflow: 'hidden',
        '& img': {
          transition: 'transform 0.3s ease',
        },
      },
      content: {
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 2, sm: 3 },
      },
      tag: {
        backgroundColor: (theme) =>
          alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.1 : 0.2),
        color: 'primary.main',
        fontWeight: 500,
      },
      title: {
        fontWeight: 700,
        mb: 1.5,
        lineHeight: 1.3,
        fontSize: titleSizeValue(params.titleSize),
        overflowWrap: 'break-word',
      },
      excerpt: {
        flexGrow: 1,
        mb: 2,
        lineHeight: 1.7,
        fontSize: { xs: '0.875rem', sm: '1rem' },
        overflowWrap: 'break-word',
        color: 'text.secondary',
        overflow: 'hidden',
      },
      meta: {
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
        color: 'text.secondary',
        typography: 'caption',
      },
    };
  },
};

export const glassCardRenderer: PostCardRenderer<{
  borderWidth: number;
  borderRadius: number;
  borderColor: string;
  backgroundColor: string;
  overlayOpacity: number;
  glassOpacity: number;
  titleSize: 'small' | 'medium' | 'large';
  textPosition: 'bottom-left' | 'bottom-center' | 'bottom-right';
  textColor: string;
  showExcerpt: boolean;
  showTags: boolean;
  showMeta: boolean;
}> = {
  id: 'glass-card',
  name: '玻璃画报',
  description: '半透明毛玻璃质感卡片，封面作为背景，文字悬浮于磨砂渐变之上。',
  aliases: ['glass', 'glass-overlay'],
  defaultParams: {
    borderWidth: 1,
    borderRadius: 24,
    borderColor: '',
    backgroundColor: '',
    overlayOpacity: 0.6,
    glassOpacity: 0.15,
    titleSize: 'large',
    textPosition: 'bottom-left',
    textColor: '#ffffff',
    showExcerpt: true,
    showTags: true,
    showMeta: true,
  },
  schema: [
    { key: 'borderWidth', label: '边框宽度', type: 'number', min: 0, max: 8, step: 1 },
    { key: 'overlayOpacity', label: '底部渐变不透明度', type: 'number', min: 0.1, max: 1, step: 0.05 },
    { key: 'glassOpacity', label: '玻璃面板不透明度', type: 'number', min: 0, max: 0.6, step: 0.05 },
    { key: 'textPosition', label: '文字位置', type: 'select', options: textPositionOptions },
    { key: 'titleSize', label: '标题大小', type: 'select', options: titleSizeOptions },
    { key: 'showExcerpt', label: '显示摘要', type: 'boolean' },
    { key: 'showTags', label: '显示标签', type: 'boolean' },
    { key: 'showMeta', label: '显示阅读时间等元信息', type: 'boolean' },
  ],
  render: (params, { post, config, themeColor }) => {
    const borderColor = resolveBorderColor(params, themeColor);
    const borderRadius = resolveBorderRadius(params, config.theme?.borderRadius ?? 16);
    const alignItems =
      params.textPosition === 'bottom-center'
        ? 'center'
        : params.textPosition === 'bottom-right'
          ? 'flex-end'
          : 'flex-start';
    const textAlign =
      params.textPosition === 'bottom-center'
        ? 'center'
        : params.textPosition === 'bottom-right'
          ? 'right'
          : 'left';

    return {
      layout: 'overlay',
      mediaAsBackground: true,
      root: {
        position: 'relative',
        height: { xs: 280, sm: 320, md: 360 },
        minWidth: 0,
        overflow: 'hidden',
        borderRadius: `${borderRadius}px`,
        border: `${params.borderWidth}px solid ${borderColor}`,
        backgroundColor: post.cover
          ? 'common.black'
          : resolveColor(params.backgroundColor, alpha(themeColor, 0.12)),
        boxShadow: (theme) =>
          theme.palette.mode === 'light'
            ? `0 8px 32px ${alpha(themeColor, 0.15)}`
            : `0 8px 32px ${alpha(theme.palette.common.black, 0.35)}`,
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        '@media (hover: hover) and (pointer: fine)': {
          '&:hover': {
            transform: 'translateY(-6px)',
            boxShadow: (theme) =>
              theme.palette.mode === 'light'
                ? `0 16px 48px ${alpha(themeColor, 0.25)}`
                : `0 16px 48px ${alpha(theme.palette.common.black, 0.45)}`,
          },
        },
      },
      media: {
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        backgroundImage: post.cover ? `url(${post.cover})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transition: 'transform 0.6s ease',
        '@media (hover: hover) and (pointer: fine)': {
          '&:hover': {
            transform: 'scale(1.05)',
          },
        },
      },
      overlay: {
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        background: (theme) =>
          `linear-gradient(to top, ${alpha(theme.palette.common.black, params.overlayOpacity)} 0%, ${alpha(
            theme.palette.common.black,
            params.overlayOpacity * 0.4
          )} 50%, ${alpha(theme.palette.common.black, 0)} 100%)`,
      },
      content: {
        position: 'relative',
        zIndex: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems,
        textAlign,
        p: { xs: 2.5, sm: 3.5 },
        background: (theme) =>
          `linear-gradient(to top, ${alpha(
            theme.palette.mode === 'light' ? theme.palette.common.white : theme.palette.common.black,
            params.glassOpacity
          )} 0%, transparent 70%)`,
        backdropFilter: params.glassOpacity > 0 ? 'blur(8px)' : undefined,
      },
      tag: {
        backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.22),
        color: 'common.white',
        fontWeight: 600,
        backdropFilter: 'blur(8px)',
        border: '1px solid',
        borderColor: (theme) => alpha(theme.palette.common.white, 0.3),
        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
      },
      title: {
        fontWeight: 800,
        mb: params.showExcerpt ? 1 : 0,
        lineHeight: 1.25,
        fontSize: titleSizeValue(params.titleSize),
        overflowWrap: 'break-word',
        color: params.textColor || 'common.white',
        textShadow: '0 2px 8px rgba(0,0,0,0.5)',
      },
      excerpt: {
        mb: params.showMeta ? 1.5 : 0,
        lineHeight: 1.6,
        fontSize: { xs: '0.875rem', sm: '0.9375rem' },
        overflowWrap: 'break-word',
        color: 'rgba(255,255,255,0.82)',
        textShadow: '0 1px 4px rgba(0,0,0,0.4)',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      },
      meta: {
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
        color: 'rgba(255,255,255,0.72)',
        typography: 'caption',
        justifyContent: alignItems,
      },
    };
  },
};

const renderers: PostCardRenderer[] = [
  overlayCardRenderer as unknown as PostCardRenderer,
  cleanCardRenderer as unknown as PostCardRenderer,
  glassCardRenderer as unknown as PostCardRenderer,
];

export function getPostCardRenderer(variant?: string): PostCardRenderer | undefined {
  if (!variant || variant === 'default') return undefined;
  return renderers.find((r) => r.id === variant || r.aliases?.includes(variant));
}

export function listPostCardRenderers(): PostCardRenderer[] {
  return renderers.slice();
}
