import { Children, memo, useState } from 'react';
import type { ReactNode } from 'react';
import { Box, Link, alpha, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { Components } from 'react-markdown';
import type { SxProps, Theme } from '@mui/material/styles';
import { ImageLightbox } from '@/components/Common/ImageLightbox';
import { buildChatMediaUrl } from '@/api/chat';

/**
 * 聊天消息内容渲染。
 *
 * 链接解析只走一套引擎（react-markdown）：
 * - 裸 URL 自动转链接由 remark-gfm 的 autolink 完成；
 * - [文字](url) 由 Markdown 语法解析。
 * 两者输出全部统一收口到下方自定义 `a` 组件，天然不冲突。
 * 这里不再自己用正则抓 URL，避免与 Markdown 链接逻辑打架。
 *
 * 安全：使用 rehype-sanitize 白名单，并剪掉聊天不需要的重元素
 * （图片、表格、iframe、媒体、标题等），仅保留行内格式/代码/链接/列表/段落。
 *
 * 引用：发送引用时拼成的 `> [@xx：原文](cite:<原消息时间戳>)` 会被渲染成
 * 一块带左侧色条的引用条（与正文明显区隔）；点击该引用条可回调定位到原消息。
 */

// 聊天场景不需要的重标签，从白名单中移除
const BLOCKED_TAGS = new Set([
  'input',
  'iframe',
  'video',
  'audio',
  'table',
  'tbody',
  'thead',
  'tfoot',
  'tr',
  'td',
  'th',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'details',
  'summary',
]);

// 默认 schema 只放行常见协议，把「引用定位」用到的 cite 协议补进去，
// 否则 cite:xxx 的链接会被 sanitize 直接剥掉 href，无法点击。
// 同理，聊天图片用到的 chat-media: 协议也要放行 src，否则 img 的 src 会被剥掉。
const DEFAULT_PROTOCOLS = (defaultSchema.protocols?.href as readonly string[] | undefined) || [];

const chatSchema = {
  ...defaultSchema,
  tagNames: (defaultSchema.tagNames as string[]).filter((t) => !BLOCKED_TAGS.has(t)),
  protocols: {
    ...((defaultSchema.protocols as Record<string, string[]>) || {}),
    href: [...DEFAULT_PROTOCOLS, 'cite'],
    src: [
      ...((defaultSchema.protocols as Record<string, string[]>)?.src || ['http', 'https']),
      'chat-media',
    ],
  },
};

interface ChatMessageContentProps {
  content: string;
  /** 聊天室 key：用于把 chat-media://{id} 的图片协议还原成可访问的图片 URL */
  roomKey: string;
  /** 聊天气泡主题注入的图片圆角等样式（跟随后台主题配置） */
  imageSx?: SxProps<Theme>;
  /** 点击引用条时回调，参数为被引用消息的时间戳；用于滚动定位到原消息 */
  onReplyQuoteClick?: (timestamp: number) => void;
}

/** 在 JSX children 中递归查找「引用定位」的 cite 链接，返回被引用消息的时间戳 */
function findCiteTs(children: ReactNode): number | null {
  let found: number | null = null;
  Children.forEach(children, (child) => {
    if (found !== null || !Object.prototype.hasOwnProperty.call(child, 'props')) return;
    const props = (child as { props?: Record<string, unknown> }).props ?? {};
    let href = typeof props.href === 'string' ? props.href : undefined;
    if (!href) {
      const node = props.node as { properties?: Record<string, unknown> } | undefined;
      href = typeof node?.properties?.href === 'string' ? node.properties.href : undefined;
    }
    if (typeof href === 'string' && href.startsWith('cite:')) {
      found = Number(href.slice(5));
      return;
    }
    if (props.children !== undefined) {
      const nested = findCiteTs(props.children as ReactNode);
      if (nested !== null) found = nested;
    }
  });
  return found;
}

type HastNode = {
  properties?: { href?: unknown };
  children?: HastNode[];
};

/**
 * 在 react-markdown 传入的原始 hAST 节点上递归查找 cite: 链接。
 *
 * 光靠上面的 children 递归不够可靠：自定义 `a` 组件会把 cite: 链接拦下
 * 渲染成普通 span，href 被消费后不再存在于渲染产物里，导致 children 通道
 * 永远找不到时间戳。而 react-markdown 会为每个组件注入原始 `node`（hAST），
 * 它不受自定义组件影响，从这条通道遍历最稳定。
 */
function findCiteTsInNode(node: HastNode | undefined | null): number | null {
  if (!node || typeof node !== 'object') return null;
  const { properties, children: subs } = node;
  const href = properties?.href;
  if (typeof href === 'string' && href.startsWith('cite:')) {
    return Number(href.slice(5));
  }
  if (Array.isArray(subs)) {
    for (const child of subs) {
      const ts = findCiteTsInNode(child);
      if (ts !== null) return ts;
    }
  }
  return null;
}

const MEDIA_RE = /^chat-media:\/\/(.+)$/;

/**
 * 聊天图片：加载中显示转圈占位，加载完成后淡入图片；点击交给外层放大预览。
 * 注意：img 始终渲染在 DOM（占位之上，仅用 opacity 控制显隐），
 * 不能 display:none 隐藏——否则 loading="lazy" 的图片不被视口命中，永不触发加载。
 */
function ChatImage({ src, alt, onOpen, imageSx }: { src: string; alt: string; onOpen: () => void; imageSx?: SxProps<Theme> }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Box sx={{ position: 'relative', width: 'fit-content', maxWidth: '100%', m: '0.25em 0' }}>
      {!loaded && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 1,
            bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
          }}
        >
          <CircularProgress size={24} thickness={5} />
        </Box>
      )}
      <Box
        component="img"
        src={src}
        alt={alt || '图片'}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onClick={loaded ? onOpen : undefined}
        sx={{
          position: 'relative',
          display: 'block',
          maxWidth: '100%',
          maxHeight: 320,
          objectFit: 'contain',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          cursor: loaded ? 'zoom-in' : 'wait',
          opacity: loaded ? 1 : 0,
          transition: 'opacity .25s ease',
          ...imageSx,
        }}
      />
    </Box>
  );
}

function ChatMessageContent({ content, roomKey, imageSx, onReplyQuoteClick }: ChatMessageContentProps) {
  // 被点击放大预览的图片 URL；非空时展示全屏查看器
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const components: Components = {
    // 聊天图片：把 chat-media://{id} 还原成 /api/v1/chat/media/{room}/{id} 再显示，
    // 加载中显示转圈占位，点击打开全屏放大预览（ImageLightbox 支持缩放/拖动/旋转）。
    img({ src, alt }) {
      let url = src as string | undefined;
      const m = typeof url === 'string' ? url.match(MEDIA_RE) : null;
      if (m) url = buildChatMediaUrl(roomKey, m[1]);
      if (!url) return null;
      return <ChatImage src={url} alt={alt || '图片'} onOpen={() => setLightboxSrc(url)} imageSx={imageSx} />;
    },
    // 只放行 http/https/mailto，其余协议不渲染成链接；新窗口打开并携带 noopener。
    // cite:xxx 属于本项目的引用定位协议，文字保持主题色，点击交给外层引用条统一处理。
    a({ href, children }) {
      const { palette } = useTheme();
      if (typeof href === 'string' && href.startsWith('cite:')) {
        return <span style={{ color: palette.primary.main }}>{children}</span>;
      }
      const safeHref = href && /^(https?:\/\/|mailto:)/i.test(href);
      if (!safeHref) {
        return <span>{children}</span>;
      }
      return (
        <Link href={href} target="_blank" rel="nofollow noopener noreferrer" underline="hover">
          {children}
        </Link>
      );
    },
    // 引用条：左侧主题色竖线 + 淡背景，与正文明显区隔。
    // 若包含 cite 引用，则整条可点击定位到原消息，并在右侧显示一个向上箭头。
    blockquote({ children, node }) {
      const theme = useTheme();
      const { palette } = theme;
      const r = theme.shape.borderRadius;
      // 双通道解析 cite 时间戳：原始 hAST（稳定）优先，渲染 children（兼容意外情形）兜底。
      const citeTs = findCiteTsInNode(node as HastNode | undefined) ?? findCiteTs(children);
      const baseSx = {
        m: '0 0 0.6em 0',
        p: '0.3em 0.7em',
        borderLeft: `3px solid ${alpha(palette.primary.main, 0.55)}`,
        bgcolor: alpha(palette.primary.main, 0.06),
        borderRadius: `0 ${Math.max(4, r)}px ${Math.max(4, r)}px 0`,
        color: alpha(palette.text.primary, 0.62),
      };
      if (citeTs === null) {
        return (
          <Box component="blockquote" sx={baseSx}>
            {children}
          </Box>
        );
      }
      return (
        <Box
          component="blockquote"
          onClick={() => onReplyQuoteClick?.(citeTs)}
          sx={{
            ...baseSx,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            transition: 'background-color 0.15s ease',
            '&:hover': { bgcolor: alpha(palette.primary.main, 0.12) },
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
          <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: palette.primary.main }}>
            <ArrowUpwardIcon sx={{ fontSize: 16 }} />
          </Box>
        </Box>
      );
    },
    code(props) {
      const { palette } = useTheme();
      const { children } = props;
      // 行内代码标记由 react-markdown 运行时注入（未在公开类型中声明）
      const inline = Boolean((props as unknown as { inline?: boolean }).inline);
      if (inline) {
        return (
          <code
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '0.85em',
              padding: '0.15em 0.4em',
              borderRadius: 4,
              backgroundColor: alpha(palette.text.primary, 0.08),
              color: palette.text.primary,
            }}
          >
            {children}
          </code>
        );
      }
      return (
        <code
          style={{
            display: 'block',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: '0.85em',
            padding: '0.8em 1em',
            borderRadius: 8,
            backgroundColor: alpha(palette.text.primary, 0.06),
            whiteSpace: 'pre',
            overflowX: 'auto',
          }}
        >
          {children}
        </code>
      );
    },
  };

  return (
    <Box
      sx={{
        // 压缩 markdown 块的默认外边距，避免气泡内出现突兀的间距
        '& > :first-of-type': { mt: 0 },
        '& > :last-child': { mb: 0 },
        '& p': { m: '0.25em 0', fontSize: 'inherit', lineHeight: 'inherit' },
        '& ul, & ol': { m: '0.25em 0', pl: '1.4em' },
        '& li': { m: '0.1em 0' },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[[rehypeSanitize, chatSchema] as never]}
        urlTransform={(url) => {
          // react-markdown 默认只放行 http(s)/mailto 等协议，会把聊天图片的
          // chat-media:// 与引用定位的 cite: 协议剥成空串。这里显式放行这两个。
          if (/^(chat-media|cite):/i.test(url)) return url;
          return defaultUrlTransform(url);
        }}
        components={components}
      >
        {content}
      </ReactMarkdown>

      <ImageLightbox open={Boolean(lightboxSrc)} src={lightboxSrc || ''} alt="图片" onClose={() => setLightboxSrc(null)} />
    </Box>
  );
}

// 用 memo 包裹：content / roomKey / onReplyQuoteClick 都没变时不重渲染。
// 打开在线列表、弹右键菜单等会触发 ChatRoomPanel 重渲染，若不加 memo，
// 每条消息的 react-markdown 和 img 都会被重建，图片在 WebKit/Safari 上会卸载重载而闪烁。
export default memo(ChatMessageContent);