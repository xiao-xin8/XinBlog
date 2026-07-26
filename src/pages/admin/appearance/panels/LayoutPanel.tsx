import { Box, Typography, Paper, ToggleButtonGroup, ToggleButton, alpha } from '@mui/material';
import { Loading } from '@/components/Common/Loading';
import { PostListGrid } from '@/components/Post/PostListGrid';
import { PostListHorizontal } from '@/components/Post/PostListHorizontal';
import { PostListMagazine } from '@/components/Post/PostListMagazine';
import { layouts } from '../useAppearanceEditor';
import type { AppearanceEditor } from '../useAppearanceEditor';

export function LayoutPanel({ editor }: { editor: AppearanceEditor }) {
  const { postLayout, setPostLayout, previewPosts, previewLoading } = editor;

  const renderPreview = () => {
    if (previewLoading) {
      return <Loading text="加载预览中..." />;
    }
    switch (postLayout) {
      case 'list':
        return <PostListHorizontal posts={previewPosts.slice(0, 2)} />;
      case 'magazine':
        return <PostListMagazine posts={previewPosts.slice(0, 3)} />;
      case 'grid':
      default:
        return <PostListGrid posts={previewPosts} />;
    }
  };

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: 1,
          mb: 3,
          overflow: 'hidden',
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
              : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          选择布局
        </Typography>
        <ToggleButtonGroup
          value={postLayout}
          exclusive
          onChange={(_, value) => value && setPostLayout(value)}
          fullWidth
          orientation="vertical"
          sx={{
            gap: 2,
            '& .MuiToggleButtonGroup-grouped': {
              flex: 1,
              border: 'none',
              borderRadius: (theme) => `${Math.min(16, theme.shape.borderRadius)}px !important`,
            },
          }}
        >
          {layouts.map((layout) => (
            <ToggleButton
              key={layout.id}
              value={layout.id}
              sx={{
                border: '2px solid',
                borderColor: postLayout === layout.id ? 'primary.main' : 'transparent',
                backgroundColor: (theme) =>
                  postLayout === layout.id
                    ? alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.08 : 0.15)
                    : alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.03 : 0.06),
                flexDirection: { xs: 'row', md: 'column' },
                justifyContent: { xs: 'flex-start', md: 'center' },
                py: { xs: 1.5, md: 3 },
                px: { xs: 2, md: 0 },
                gap: { xs: 2, md: 1 },
                color: postLayout === layout.id ? 'primary.main' : 'text.secondary',
                textAlign: { xs: 'left', md: 'center' },
                '&:hover': {
                  backgroundColor: (theme) =>
                    alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.12 : 0.2),
                },
              }}
            >
              {layout.icon}
              <Box sx={{ textAlign: { xs: 'left', md: 'center' } }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                  {layout.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                  {layout.desc}
                </Typography>
              </Box>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: 1,
          mb: 3,
          overflow: 'hidden',
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
              : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            实时预览
          </Typography>
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
              typography: 'caption',
              fontWeight: 600,
            }}
          >
            {layouts.find((l) => l.id === postLayout)?.name}
          </Box>
        </Box>
        <Box sx={{ pointerEvents: 'none', maxWidth: '100%', overflow: 'hidden' }}>{renderPreview()}</Box>
      </Paper>
    </>
  );
}
