import { Box, alpha } from '@mui/material';
import { PostContent } from '@/components/Post/PostContent';
import type { HeadingItem } from '@/components/Post/TableOfContents';
interface PostDetailContentProps {
  content: string;
  onHeadingsExtracted?: (headings: HeadingItem[]) => void;
}
export function PostDetailContent({ content, onHeadingsExtracted }: PostDetailContentProps) {
  return (
    <Box
      className="post-detail-prose"
      sx={{
        '& .markdown-body': {
          color: 'text.primary',
          lineHeight: 1.8,
          fontSize: { xs: '1rem', md: '1.05rem' },
          '& h1, & h2, & h3, & h4, & h5, & h6': {
            mt: 4,
            mb: 2,
            fontWeight: 800,
            color: 'text.primary',
            overflowWrap: 'break-word',
            letterSpacing: '-0.02em',
          },
          '& h1': { fontSize: { xs: '1.75rem', md: '2.25rem' } },
          '& h2': { fontSize: { xs: '1.5rem', md: '1.85rem' } },
          '& h3': { fontSize: { xs: '1.25rem', md: '1.5rem' } },
          '& p': {
            mb: 2,
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
          },
          '& a': {
            color: 'primary.main',
            textDecoration: 'none',
            fontWeight: 600,
            borderBottom: '1px dashed',
            borderColor: 'primary.main',
            transition: 'all 0.3s ease',
            '&:hover': {
              color: 'primary.dark',
              borderBottomStyle: 'solid',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
              px: 0.5,
              borderRadius: 0.5,
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
            py: 1.5,
            my: 3,
            bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.05 : 0.1),
            borderRadius: (t) => `0 ${t.shape.borderRadius}px ${t.shape.borderRadius}px 0`,
            fontStyle: 'italic',
            overflowWrap: 'break-word',
            '& p': { mb: 0, color: 'text.secondary' },
          },
          '& code': {
            bgcolor: (t) =>
              alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.08 : 0.12),
            color: 'text.primary',
            padding: '2px 6px',
            borderRadius: 0.5,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: '0.9em',
            fontWeight: 600,
          },
          '& pre': {
            bgcolor: (t) =>
              alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.08 : 0.12),
            color: 'text.primary',
            borderRadius: 1,
            p: 2,
            overflow: 'auto',
            mb: 3,
            '& code': {
              bgcolor: 'transparent',
              color: 'inherit',
              padding: 0,
              fontSize: '0.9rem',
              fontWeight: 400,
            },
            '& code.hljs': {
              bgcolor: 'transparent !important',
            },
          },
          '& img': {
            display: 'block',
            maxWidth: '100%',
            height: 'auto',
            borderRadius: 1,
            my: 3,
            boxShadow: (t) =>
              t.palette.mode === 'light'
                ? '0 10px 30px rgba(0,0,0,0.08)'
                : '0 10px 30px rgba(0,0,0,0.25)',
          },
          '& hr': {
            border: 'none',
            borderTop: '1px solid',
            borderColor: 'divider',
            my: 4,
          },
        },
      }}
    >
      <PostContent content={content} onHeadingsExtracted={onHeadingsExtracted} />
    </Box>
  );
}