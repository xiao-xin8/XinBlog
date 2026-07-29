import { Box, Typography, alpha } from '@mui/material';
import dayjs from 'dayjs';
import type { Post, PostDetailThemeConfig } from '@/types';
interface PostDetailThemePreviewProps {
  post: Post | null;
  theme: PostDetailThemeConfig;
}
function PreviewLine({
  width,
  height = 10,
  mb = 1,
  bg = 'action.hover',
}: {
  width: string;
  height?: number;
  mb?: number;
  bg?: string;
}) {
  return <Box sx={{ height, width, bgcolor: bg, borderRadius: 0.5, mb }} />;
}
function PreviewSectionTitle({ text }: { text: string }) {
  return (
    <Typography
      variant="caption"
      sx={{
        display: 'block',
        fontWeight: 900,
        mb: 1.5,
        pl: 1,
        borderLeft: '3px solid',
        borderColor: 'primary.main',
        color: 'text.primary',
        letterSpacing: '0.05em',
      }}
    >
      {text}
    </Typography>
  );
}
function PreviewProse() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <PreviewLine width="100%" />
      <PreviewLine width="96%" />
      <PreviewLine width="88%" />
      <Box sx={{ height: 12 }} />
      <PreviewLine width="100%" />
      <PreviewLine width="92%" />
      <PreviewLine width="85%" />
      <Box sx={{ height: 12 }} />
      <PreviewLine width="76%" />
    </Box>
  );
}
export function PostDetailThemePreview({ post, theme }: PostDetailThemePreviewProps) {
  const params = theme.params || {};
  const isGlass = theme.variant === 'glass';
  const glassOpacity = Number(params.glassOpacity ?? theme.glassOpacity ?? 0.6);
  const showSidebar = params.showSidebar ?? theme.showSidebar ?? true;
  const showAuthorCard = params.showAuthorCard ?? theme.showAuthorCard ?? true;
  const showRecentPosts = params.showRecentPosts ?? theme.showRecentPosts ?? true;
  const showTOC = params.showTOC ?? theme.showTOC ?? true;
  const samplePost = post || {
    id: 'preview',
    title: '示例文章标题',
    slug: 'preview',
    content: '这是一段用于预览文章详情主题样式的示例正文。',
    excerpt: '',
    cover: '',
    author: 'Xin',
    tags: [{ id: 'preview', name: '示例标签', slug: 'preview', count: 0 }],
    createdAt: dayjs().format(),
    updatedAt: dayjs().format(),
    readingTime: 3,
    views: 128,
  };
  const coverBlock = (
    <Box
      sx={{
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: 1,
        bgcolor: 'action.hover',
        mb: 2,
      }}
    />
  );
  const metaBlock = (
    <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
      <Box sx={{ px: 1.5, py: 0.5, borderRadius: '999px', bgcolor: (t) => alpha(t.palette.primary.main, 0.1) }}>
        <Typography variant="caption" color="primary.main" fontWeight={700}>
          写作时间：{dayjs(samplePost.createdAt).format('YYYY-MM-DD')}
        </Typography>
      </Box>
      <Box sx={{ px: 1.5, py: 0.5, borderRadius: '999px', bgcolor: (t) => alpha(t.palette.secondary.main, 0.1) }}>
        <Typography variant="caption" color="secondary.main" fontWeight={700}># 示例标签</Typography>
      </Box>
    </Box>
  );
  const tocPreview = (
    <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'background.paper' }}>
      <PreviewSectionTitle text="TABLE OF CONTENTS" />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <PreviewLine width="70%" height={6} mb={0.75} />
        <PreviewLine width="55%" height={6} mb={0.75} />
        <PreviewLine width="60%" height={6} mb={0.75} />
        <PreviewLine width="48%" height={6} mb={0} />
      </Box>
    </Box>
  );
  const authorPreview = (
    <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'background.paper', textAlign: 'center' }}>
      <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: 'action.hover', mx: 'auto', mb: 1 }} />
      <Typography variant="body2" fontWeight={700}>作者</Typography>
      <PreviewLine width="80%" height={5} mb={0} bg="action.hover" />
    </Box>
  );
  const recentPreview = (
    <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'background.paper' }}>
      <PreviewSectionTitle text="RECOMMENDED" />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <PreviewLine width="80%" height={7} mb={0} />
        <PreviewLine width="65%" height={7} mb={0} />
        <PreviewLine width="72%" height={7} mb={0} />
      </Box>
    </Box>
  );
  const sidebar = (
    <Box sx={{ width: { xs: '100%', md: 180, lg: 200 }, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {showAuthorCard && authorPreview}
      {showRecentPosts && recentPreview}
      {showTOC && tocPreview}
    </Box>
  );
  return (
    <Box
      sx={{
        width: '100%',
        maxHeight: 480,
        overflow: 'auto',
        p: { xs: 0.5, sm: 1 },
        bgcolor: (t) => alpha(t.palette.primary.main, 0.03),
        borderRadius: 1,
      }}
    >
      {isGlass ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
          }}
        >
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              borderRadius: 1,
              bgcolor: (t) =>
                t.palette.mode === 'light'
                  ? `rgba(255,255,255,${glassOpacity})`
                  : `rgba(30,41,59,${Math.max(0.3, glassOpacity - 0.2)})`,
              backdropFilter: 'blur(12px)',
              border: (t) => `1px solid ${alpha(t.palette.divider, 0.4)}`,
              p: { xs: 2, sm: 3 },
            }}
          >
            {coverBlock}
            {metaBlock}
            <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
              {samplePost.title}
            </Typography>
            <PreviewProse />
          </Box>
          {showSidebar && sidebar}
        </Box>
      ) : (
        <Box sx={{ maxWidth: 720, mx: 'auto', p: { xs: 2, sm: 3 } }}>
          {coverBlock}
          {metaBlock}
          <Typography variant="h5" fontWeight={800} sx={{ mb: 2 }}>
            {samplePost.title}
          </Typography>
          <PreviewProse />
        </Box>
      )}
    </Box>
  );
}