import { Box, alpha, Fade, IconButton, Tooltip } from '@mui/material';
import { ContentCopy, Check } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize from 'rehype-sanitize';
import 'highlight.js/styles/github.css';
import React, { useEffect, useRef, useState } from 'react';
import type { Components } from 'react-markdown';
import { useThemeStore } from '@/stores/themeStore';
import { LazyImage } from '@/components/Common/LazyImage';
import { ImageLightbox } from '@/components/Common/ImageLightbox';
import type { HeadingItem } from './TableOfContents';

interface PostContentProps {
  content: string;
  onHeadingsExtracted?: (headings: HeadingItem[]) => void;
}

const headingLevels = [1, 2, 3, 4, 5, 6] as const;

function useHeadingIds(content: string) {
  const counterRef = useRef(0);
  const idsRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    counterRef.current = 0;
    idsRef.current.clear();
  }, [content]);

  return {
    getId: (level: number) => {
      const index = counterRef.current++;
      const id = `toc-heading-${level}-${index}`;
      idsRef.current.set(index, id);
      return id;
    },
  };
}

function extractHeadings(root: HTMLElement | null): HeadingItem[] {
  if (!root) return [];
  const elements = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
  return Array.from(elements).map((el) => ({
    id: el.id,
    text: el.textContent?.trim() || '',
    level: parseInt(el.tagName[1], 10),
  }));
}

function useHighlightTheme() {
  const { mode } = useThemeStore();

  useEffect(() => {
    const linkId = 'hljs-theme';
    let link = document.getElementById(linkId) as HTMLLinkElement | null;
    const themeHref =
      mode === 'dark'
        ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
        : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';

    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = themeHref;
  }, [mode]);
}

function PreBlock({ children }: { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  const handleCopy = async () => {
    
    
    const codeText = preRef.current?.textContent ?? '';
    if (!codeText) return;
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 复制失败静默处理
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <Tooltip title={copied ? '已复制' : '复制代码'} arrow placement="left">
        <IconButton
          onClick={handleCopy}
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 2,
            color: 'text.secondary',
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.7),
            backdropFilter: 'blur(4px)',
            '&:hover': {
              bgcolor: (theme) => alpha(theme.palette.background.paper, 0.9),
              color: 'primary.main',
            },
          }}
        >
          {copied ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
        </IconButton>
      </Tooltip>
      <pre ref={preRef} style={{ margin: 0 }}>{children}</pre>
    </Box>
  );
}

export function PostContent({ content, onHeadingsExtracted }: PostContentProps) {
  useHighlightTheme();
  const { getId } = useHeadingIds(content);
  const rootRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<{ open: boolean; src: string; alt: string }>({
    open: false,
    src: '',
    alt: '',
  });

  useEffect(() => {
    
    const headings = extractHeadings(rootRef.current);
    onHeadingsExtracted?.(headings);
  }, [content, onHeadingsExtracted]);

  const headingComponents: Components = {};
  headingLevels.forEach((level) => {
    const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
    const Heading = ({
      children,
      ...props
    }: { children?: React.ReactNode; [key: string]: unknown }) => (
      <Tag id={getId(level)} {...props}>
        {children}
      </Tag>
    );
    
    (headingComponents as any)[Tag] = Heading;
  });

  return (
    <Fade in timeout={400}>
      <Box
        ref={rootRef}
        className="markdown-body"
        sx={{
          color: 'text.primary',
        lineHeight: 1.8,
        fontSize: { xs: '1rem', md: '1.05rem' },
        '& h1, & h2, & h3, & h4, & h5, & h6': {
          mt: 4,
          mb: 2,
          fontWeight: 700,
          color: 'text.primary',
          overflowWrap: 'break-word',
        },
        '& h1': { fontSize: { xs: '1.5rem', md: '2rem' } },
        '& h2': { fontSize: { xs: '1.25rem', md: '1.6rem' } },
        '& h3': { fontSize: { xs: '1.125rem', md: '1.3rem' } },
        '& p': {
          mb: 2,
          overflowWrap: 'break-word',
          whiteSpace: 'pre-wrap',
        },
        '& a': {
          color: 'primary.main',
          textDecoration: 'none',
          borderBottom: '1px solid transparent',
          '&:hover': {
            borderColor: 'primary.main',
          },
        },
        '& ul, & ol': {
          pl: 3,
          mb: 2,
        },
        '& li': {
          mb: 0.75,
          overflowWrap: 'break-word',
        },
        '& blockquote': {
          borderLeft: '4px solid',
          borderColor: 'primary.main',
          pl: 2,
          py: 0.5,
          my: 2,
          backgroundColor: (theme) =>
            alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.05 : 0.1),
          borderRadius: (theme) => `0 ${theme.shape.borderRadius}px ${theme.shape.borderRadius}px 0`,
          fontStyle: 'italic',
          overflowWrap: 'break-word',
        },
        '& code': {
          backgroundColor: (theme) =>
            theme.palette.mode === 'light'
              ? alpha(theme.palette.primary.main, 0.08)
              : alpha(theme.palette.primary.main, 0.12),
          color: 'text.primary',
          padding: '2px 6px',
          borderRadius: 1,
          fontFamily: '"Fira Code", monospace',
          fontSize: '0.9em',
        },
        '& pre': {
          backgroundColor: (theme) =>
            theme.palette.mode === 'light'
              ? alpha(theme.palette.primary.main, 0.08)
              : alpha(theme.palette.primary.main, 0.12),
          borderRadius: 1,
          p: 2,
          overflow: 'auto',
          mb: 2,
          '& code': {
            backgroundColor: 'transparent',
            color: 'inherit',
            padding: 0,
            fontSize: '0.9rem',
          },
          '& code.hljs': {
            backgroundColor: 'transparent !important',
          },
        },
        '& img': {
          maxWidth: '100%',
          borderRadius: 1,
          my: 2,
        },
        '& hr': {
          border: 'none',
          borderTop: '1px solid',
          borderColor: 'divider',
          my: 4,
        },
        '& .table-wrapper': {
          overflowX: 'auto',
          overflowY: 'hidden',
          maxWidth: '100%',
          mb: 2,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': {
            height: 8,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: (theme) => alpha(theme.palette.divider, 0.3),
            borderRadius: 1,
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.3),
            borderRadius: 1,
            '&:hover': {
              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.5),
            },
          },
        },
        '& table': {
          width: 'auto',
          minWidth: '100%',
          borderCollapse: 'collapse',
          '& th, & td': {
            border: '1px solid',
            borderColor: 'divider',
            p: 1.5,
            textAlign: 'left',
            whiteSpace: 'nowrap',
          },
          '& th': {
            backgroundColor: (theme) =>
              alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.08 : 0.15),
            fontWeight: 700,
          },
        },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize, rehypeHighlight]}
        components={{
          ...headingComponents,
          pre: PreBlock,
          table: ({ children }) => (
            <Box
              className="table-wrapper"
              onTouchMove={(e) => e.stopPropagation()}
            >
              <table>{children}</table>
            </Box>
          ),
          img: ({ src, alt }) => (
            <Box
              component="span"
              sx={{
                display: 'inline-block',
                maxWidth: '100%',
                cursor: 'zoom-in',
                '& img': { my: 0 },
              }}
              onClick={() => src && setLightbox({ open: true, src, alt: alt || '' })}
            >
              <LazyImage
                src={src}
                alt={alt || ''}
                objectFit="contain"
                placeholder="color"
                style={{ maxWidth: '100%', borderRadius: 8 }}
              />
            </Box>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      <ImageLightbox
        open={lightbox.open}
        src={lightbox.src}
        alt={lightbox.alt}
        onClose={() => setLightbox((prev) => ({ ...prev, open: false }))}
      />
    </Box>
    </Fade>
  );
}
