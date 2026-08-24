import { Box, alpha, Fade, IconButton, Tooltip } from '@mui/material';
import { ContentCopy, Check } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';
import React, { Children, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import type { Components } from 'react-markdown';
import { useThemeStore } from '@/stores/themeStore';
import { useSiteStore } from '@/stores/siteStore';
import { resolveSpacingConfig } from '@/utils/spacingConfig';

import { ImageLightbox } from '@/components/Common/ImageLightbox';
import { LazyImage } from '@/components/Common/LazyImage';
import type { HeadingItem } from './TableOfContents';

interface PostContentProps {
  content: string;
  onHeadingsExtracted?: (headings: HeadingItem[]) => void;
}

const headingLevels = [1, 2, 3, 4, 5, 6] as const;


function flattenText(
  children: React.ReactNode,
  out: string[] = []
): string[] {
  Children.forEach(children, (child) => {
    if (child == null || typeof child === 'boolean') return;
    if (typeof child === 'string' || typeof child === 'number') {
      out.push(String(child).trim());
    } else if (isValidElement<{ children?: React.ReactNode }>(child)) {
      flattenText(child.props?.children, out);
    }
  });
  return out;
}


function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'heading'
  );
}


function useHeadingIds() {
  const seenRef = useRef<Record<string, number>>({});

  
  seenRef.current = {};

  return {
    getId: (text: string, level: number) => {
      const base = `toc-heading-${level}-${slugify(text)}`;
      const count = seenRef.current[base] || 0;
      seenRef.current[base] = count + 1;
      return count === 0 ? base : `${base}-${count}`;
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
  const { getId } = useHeadingIds();
  const rootRef = useRef<HTMLDivElement>(null);
  const enableLatex = useSiteStore((s) => s.config.enableLatex ?? false);
  const imageDisplayMode = useSiteStore((s) => s.config.imageDisplayMode ?? 'fixed');
  const spacing = resolveSpacingConfig(useSiteStore((s) => s.config.spacing));
  const [latexPlugins, setLatexPlugins] = useState<{
    remarkMath: unknown;
    rehypeKatex: unknown;
  } | null>(null);

  
  useEffect(() => {
    if (!enableLatex) {
      setLatexPlugins(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      import('remark-math'),
      import('rehype-katex'),
    ]).then(([rm, rk]) => {
      if (!cancelled) {
        setLatexPlugins({ remarkMath: rm.default, rehypeKatex: rk.default });
      }
    });
    return () => { cancelled = true; };
  }, [enableLatex]);

  const sanitizeSchema = useMemo(() => {
    if (!enableLatex) return undefined;
    return {
      ...defaultSchema,
      tagNames: [
        ...(defaultSchema.tagNames || []),
        'math', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'msqrt', 'mroot',
        'mrow', 'mtable', 'mtr', 'mtd', 'merror', 'mpadded', 'mphantom',
        'menclose', 'annotation', 'semantics', 'mprescripts', 'none', 'mtext',
      ],
      attributes: {
        ...defaultSchema.attributes,
        
        span: [...((defaultSchema.attributes && defaultSchema.attributes['*']) || []), 'className', 'style', 'ariaHidden'],
        
        math: ['xmlns', 'display', 'className'],
        annotation: ['encoding', 'className'],
        mrow: ['className'],
        mi: ['className'],
        mo: ['className'],
        mn: ['className'],
        msup: ['className'],
        msub: ['className'],
        mfrac: ['className'],
        msqrt: ['className'],
        mroot: ['className'],
        mtext: ['className'],
      },
    };
  }, [enableLatex]);

  const remarkPlugins = useMemo(() => {
    const plugins = [remarkGfm];
    if (latexPlugins?.remarkMath) {
      
      plugins.push([latexPlugins.remarkMath, {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']]
      }] as any);
    }
    return plugins;
  }, [latexPlugins]);

  const rehypePlugins = useMemo(() => {
    const plugins: any[] = [];
    if (latexPlugins?.rehypeKatex) {
      plugins.push([latexPlugins.rehypeKatex, { output: 'html' }]);
    }
    if (sanitizeSchema) {
      plugins.push([rehypeSanitize, sanitizeSchema]);
    } else {
      plugins.push(rehypeSanitize);
    }
    plugins.push(rehypeHighlight);
    return plugins;
  }, [latexPlugins, sanitizeSchema]);

  const [lightbox, setLightbox] = useState<{ open: boolean; src: string; alt: string }>({
    open: false,
    src: '',
    alt: '',
  });

  useEffect(() => {
    
    if (!rootRef.current) return;
    const headings = extractHeadings(rootRef.current);
    onHeadingsExtracted?.(headings);
    
    
  }, [content, onHeadingsExtracted, latexPlugins]);
  const headingComponents: Components = {};
  headingLevels.forEach((level) => {
    const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
    const Heading = ({
      children,
      ...props
    }: { children?: React.ReactNode; [key: string]: unknown }) => (
      <Tag id={getId(flattenText(children).join(' '), level)} {...props}>
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
          mt: { xs: `${spacing.articleHeadingGap.mobile}px`, md: `${spacing.articleHeadingGap.desktop}px` },
          mb: 2,
          fontWeight: 700,
          color: 'text.primary',
          overflowWrap: 'break-word',
        },
        '& h1': { fontSize: { xs: '1.5rem', md: '2rem' } },
        '& h2': { fontSize: { xs: '1.25rem', md: '1.6rem' } },
        '& h3': { fontSize: { xs: '1.125rem', md: '1.3rem' } },
        '& p': {
          mb: { xs: `${spacing.articleParagraphGap.mobile}px`, md: `${spacing.articleParagraphGap.desktop}px` },
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
        
        
        '& .katex-display': {
          overflow: 'auto hidden',
          overflowWrap: 'normal',
          my: 2.5,
          py: 2,
          px: 2.5,
          backgroundColor: (theme) =>
            alpha(theme.palette.background.default, theme.palette.mode === 'light' ? 0.4 : 0.3),
          borderRadius: 1,
          borderLeft: '3px solid',
          borderColor: 'primary.main',
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': {
            height: 6,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: (theme) => alpha(theme.palette.divider, 0.5),
            borderRadius: 3,
          },
        },
        
        '& p:has(.katex)': {
          lineHeight: 2.2,
        },
        
        
        '& .katex': {
          fontFeatureSettings: '"kern"',
          color: 'inherit',
          verticalAlign: '-0.2em',
        },
      }}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={{
          ...headingComponents,
          pre: PreBlock,
          a: ({ href, node, children, ...props }) => {
            
            
            const openInNewTab = /^(https?:|mailto:|tel:|#)/i.test(href || '');
            return (
              <a
                href={href}
                target={openInNewTab ? '_blank' : undefined}
                rel={openInNewTab ? 'noopener noreferrer' : undefined}
                {...props}
              >
                {children}
              </a>

            );
          },
          table: ({ children }) => (
            <Box
              className="table-wrapper"
              onTouchMove={(e) => e.stopPropagation()}
            >
              <table>{children}</table>

            </Box>

          ),
          img: ({ src, alt }) =>
            imageDisplayMode === 'natural' ? (
              
              
              <Box
                component="span"
                sx={{ display: 'block', width: '100%', cursor: 'zoom-in' }}
                onClick={() => src && setLightbox({ open: true, src, alt: alt || '' })}
              >
                <LazyImage
                  src={src}
                  alt={alt || ''}
                  objectFit="contain"
                  placeholder="color"
                  style={{
                    display: 'block',
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '100%',
                    maxHeight: '80vh',
                    margin: '0 auto',
                    borderRadius: 1,
                  }}
                />
              </Box>

            ) : (
              
              
              
              
              <Box
                component="span"
                sx={{
                  display: 'block',
                  width: '100%',
                  paddingTop: '75%',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 1,
                  bgcolor: (theme) => alpha(theme.palette.background.paper, 0.05),
                  cursor: 'zoom-in',
                }}
                onClick={() => src && setLightbox({ open: true, src, alt: alt || '' })}
              >
                {}
                <Box
                  component="img"
                  src={src}
                  alt={alt || ''}
                  loading="lazy"
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    maxWidth: '100%',
                    maxHeight: '100%',
                  }}
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
