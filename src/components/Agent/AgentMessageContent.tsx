import { memo, useEffect, useRef, useState } from 'react';
import { Box, alpha, IconButton, Tooltip } from '@mui/material';
import { ContentCopy, Check } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize from 'rehype-sanitize';
import type { Components } from 'react-markdown';

/**
 * Agent 消息的 Markdown 渲染。
 *
 * 这是一套「聊天专用」的紧凑渲染，而不是文章查看器那套排版：
 * - 行距紧凑（line-height）、块间距小，符合聊天气泡的观感；
 * - 完整解析 GFM：标题 / 列表 / 引用 / 表格 / 任务列表 / 删除线 / 行内与块级代码 / 链接 / 图片；
 * - 代码块带语法高亮 + 一键复制；
 * - 通过 rehype-sanitize 过滤危险 HTML。
 */

// 代码块固定使用深色面板，因此无论站点处于明/暗模式、或使用何种气泡主题，
// 语法高亮统一用 github-dark，保证浅色文字在深色面板上始终可读。
function useHighlightTheme() {
  useEffect(() => {
    const linkId = 'hljs-theme';
    let link = document.getElementById(linkId) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
      document.head.appendChild(link);
    }
  }, []);
}

// 代码块：复制按钮 + 紧凑排版
function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  const handleCopy = async () => {
    const text = preRef.current?.textContent ?? '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 复制失败静默忽略
    }
  };

  return (
    <Box sx={{ position: 'relative', my: 0.75 }}>
      <Tooltip title={copied ? '已复制' : '复制代码'} placement="left">
        <IconButton
          onClick={handleCopy}
          size="small"
          sx={{
            position: 'absolute',
            top: 6,
            right: 6,
            zIndex: 2,
            p: 0.5,
            color: 'text.secondary',
            bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
            backdropFilter: 'blur(4px)',
            '&:hover': { bgcolor: (t) => alpha(t.palette.background.paper, 0.9), color: 'primary.main' },
          }}
        >
          {copied ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Box
        component="pre"
        ref={preRef}
        sx={{
          m: 0,
          p: 1.25,
          overflowX: 'auto',
          borderRadius: 1,
          fontSize: '0.8em',
          lineHeight: 1.55,
          bgcolor: '#0d1117',
          color: '#c9d1d9',
          border: '1px solid rgba(255,255,255,0.08)',
          fontFamily: mono,
        }}
      >
        <Box component="code" className={className} sx={{ fontFamily: 'inherit', color: 'inherit' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export default memo(function AgentMessageContent({ content }: { content: string }) {
  useHighlightTheme();

  const components: Components = {
    // 标题：紧凑，聊天气泡里 h1 不宜过大
    h1: (props) => <Box component="h1" {...props} sx={{ m: '0.5em 0 0.3em', fontSize: '1.15em', fontWeight: 800, lineHeight: 1.4 }} />,
    h2: (props) => <Box component="h2" {...props} sx={{ m: '0.5em 0 0.3em', fontSize: '1.1em', fontWeight: 800, lineHeight: 1.4 }} />,
    h3: (props) => <Box component="h3" {...props} sx={{ m: '0.45em 0 0.25em', fontSize: '1.05em', fontWeight: 800, lineHeight: 1.4 }} />,
    h4: (props) => <Box component="h4" {...props} sx={{ m: '0.4em 0 0.2em', fontSize: '1em', fontWeight: 800, lineHeight: 1.4 }} />,
    h5: (props) => <Box component="h5" {...props} sx={{ m: '0.4em 0 0.2em', fontSize: '0.95em', fontWeight: 700, lineHeight: 1.4 }} />,
    h6: (props) => <Box component="h6" {...props} sx={{ m: '0.4em 0 0.2em', fontSize: '0.9em', fontWeight: 700, lineHeight: 1.4 }} />,

    p: ({ node: _n, ...props }) => (
      <Box component="p" sx={{ m: '0.25em 0', lineHeight: 1.6 }} {...props} />
    ),

    a: ({ node: _n, ...props }) => (
      <Box component="a" target="_blank" rel="noopener noreferrer" sx={{ color: 'primary.main', textDecoration: 'underline', wordBreak: 'break-all' }} {...props} />
    ),

    ul: (props) => <Box component="ul" sx={{ m: '0.25em 0', pl: 2.25, lineHeight: 1.6 }} {...props} />,
    ol: (props) => <Box component="ol" sx={{ m: '0.25em 0', pl: 2.25, lineHeight: 1.6 }} {...props} />,
    li: (props) => <Box component="li" sx={{ m: '0.12em 0', lineHeight: 1.6 }} {...props} />,
    input: ({ checked, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
      <Box component="input" type="checkbox" checked={!!checked} readOnly disabled sx={{ mr: 0.75, verticalAlign: 'middle' }} {...props} />
    ),

    blockquote: (props) => (
      <Box
        component="blockquote"
        sx={{
          m: '0.4em 0',
          pl: 1,
          borderLeft: 3,
          borderColor: (t) => alpha(t.palette.primary.main, 0.45),
          bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
          borderRadius: '0 0.35em 0.35em 0',
          py: 0.25,
          pr: 0.75,
          color: 'text.secondary',
          '& p': { m: '0.2em 0' },
        }}
        {...props}
      />
    ),

    hr: (props) => <Box component="hr" sx={{ my: 1, border: 'none', borderTop: '1px solid', borderColor: 'divider' }} {...props} />,

    strong: (props) => <Box component="strong" sx={{ fontWeight: 800 }} {...props} />,
    em: (props) => <Box component="em" {...props} />,
    del: (props) => <Box component="del" sx={{ opacity: 0.7 }} {...props} />,

    // 行内代码
    code: ({ node, className, children, ...props }: any) => {
      const languageMatch = /language-(\w+)/.exec(className || '');
      const isBlock =
        !!languageMatch ||
        (!!node?.position && node.position.start.line !== node.position.end.line);
      if (isBlock) {
        return <CodeBlock className={className}>{children}</CodeBlock>;
      }
      return (
        <Box
          component="code"
          sx={{
            px: 0.4,
            py: 0.05,
            borderRadius: 0.35,
            bgcolor: (t) => alpha(t.palette.text.primary, 0.08),
            fontFamily: mono,
            fontSize: '0.88em',
            wordBreak: 'break-all',
          }}
          {...props}
        >
          {children}
        </Box>
      );
    },

    // 表格（带横向滚动）
    table: (props) => (
      <Box sx={{ overflowX: 'auto', my: 0.5, borderRadius: 1 }}>
        <Box
          component="table"
          sx={{ fontSize: '0.85em', borderCollapse: 'collapse', m: 0, minWidth: 360 }}
          {...props}
        />
      </Box>
    ),
    th: (props) => (
      <Box
        component="th"
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          px: 1,
          py: 0.5,
          fontWeight: 700,
          bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
          textAlign: 'left' as const,
        }}
        {...props}
      />
    ),
    td: (props) => (
      <Box component="td" sx={{ border: '1px solid', borderColor: 'divider', px: 1, py: 0.5 }} {...props} />
    ),

    img: ({ node: _n, ...props }) => (
      <Box component="img" sx={{ maxWidth: '100%', height: 'auto', borderRadius: 1, my: 0.5, display: 'block' }} {...props} />
    ),
  };

  return (
    <Box
      sx={{
        fontSize: 'inherit',
        '& > :first-child': { marginTop: '0 !important' },
        '& > :last-child': { marginBottom: '0 !important' },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize, rehypeHighlight]} components={components}>
        {content}
      </ReactMarkdown>
    </Box>
  );
});