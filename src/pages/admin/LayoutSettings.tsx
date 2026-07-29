import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  Select,
  MenuItem,
  alpha,
  useMediaQuery,
  Fade,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { GridView, ViewList, AutoStories, Refresh } from '@mui/icons-material';
import { useUIStore } from '@/stores/uiStore';
import { fetchPosts } from '@/api/posts';
import { PostListGrid } from '@/components/Post/PostListGrid';
import { PostListHorizontal } from '@/components/Post/PostListHorizontal';
import { PostListMagazine } from '@/components/Post/PostListMagazine';
import type { PostLayoutMode } from '@/stores/uiStore';
import type { Post } from '@/types';
import { useSnackbar } from 'notistack';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
const layouts: { id: PostLayoutMode; name: string; desc: string; icon: React.ReactNode }[] = [
  {
    id: 'grid',
    name: '网格卡片',
    desc: '三列等宽卡片，适合图片较多的博客',
    icon: <GridView sx={{ fontSize: { xs: 28, md: 40 } }} />,
  },
  {
    id: 'list',
    name: '横向列表',
    desc: '大图 + 文字左右交替排列，大气高级',
    icon: <ViewList sx={{ fontSize: { xs: 28, md: 40 } }} />,
  },
  {
    id: 'magazine',
    name: '杂志布局',
    desc: '首篇精选大卡片，其余双列展示',
    icon: <AutoStories sx={{ fontSize: { xs: 28, md: 40 } }} />,
  },
];
export function AdminLayoutSettings() {
  const ui = useUIStore();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  const [selected, setSelected] = useState<PostLayoutMode>(ui.postLayout);
  const [initialSelected, setInitialSelected] = useState<PostLayoutMode>(ui.postLayout);
  const isDirty = selected !== initialSelected;
  const [saving, setSaving] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  useEffect(() => {
    fetchPosts().then((data) => {
      if (data.length) setPosts(data);
    });
  }, []);
  const applyLayout = async () => {
    setSaving(true);
    const ok = await ui.saveConfig({ postLayout: selected });
    if (ok) {
      ui.setPostLayout(selected);
      setInitialSelected(selected);
      enqueueSnackbar('布局已保存', { variant: 'success' });
    } else {
      enqueueSnackbar('布局保存失败，请稍后再试', { variant: 'error' });
    }
    setSaving(false);
  };
  const renderPreview = () => {
    switch (selected) {
      case 'list':
        return <PostListHorizontal posts={posts.slice(0, 2)} />;
      case 'magazine':
        return <PostListMagazine posts={posts.slice(0, 3)} />;
      case 'grid':
      default:
        return <PostListGrid posts={posts} />;
    }
  };
  return (
    <Fade in timeout={400}>
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        文章布局
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        选择首页文章列表的展示风格，实时预览效果。
      </Typography>
      {}
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
        {isMobileAdmin ? (
          <FormControl size="small" fullWidth>
            <Select
              value={selected}
              onChange={(e) => setSelected(e.target.value as PostLayoutMode)}
              sx={{
                borderRadius: (t) => t.shape.borderRadius * 1.5,
                bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                '& .MuiSelect-select': {
                  fontWeight: 600,
                  color: 'primary.main',
                  py: 1,
                  px: 2,
                },
              }}
            >
              {layouts.map((layout) => (
                <MenuItem key={layout.id} value={layout.id}>
                  {layout.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <ToggleButtonGroup
            value={selected}
            exclusive
            onChange={(_, value) => value && setSelected(value)}
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
                  borderColor: selected === layout.id ? 'primary.main' : 'transparent',
                  backgroundColor: (theme) =>
                    selected === layout.id
                      ? alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.08 : 0.15)
                      : alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.03 : 0.06),
                  flexDirection: { xs: 'row', md: 'column' },
                  justifyContent: { xs: 'flex-start', md: 'center' },
                  py: { xs: 1.5, md: 3 },
                  px: { xs: 2, md: 0 },
                  gap: { xs: 2, md: 1 },
                  color: selected === layout.id ? 'primary.main' : 'text.secondary',
                  textAlign: { xs: 'left', md: 'center' },
                  '&:hover': {
                    backgroundColor: (theme) =>
                      alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.12 : 0.2),
                  },
                }}
              >
                {layout.icon}
                <Box sx={{ textAlign: { xs: 'left', md: 'center' }, minWidth: 0 }}>
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
        )}
      </Paper>
      {}
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 2, flexWrap: 'wrap', minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, overflowWrap: 'break-word' }}>
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
            {layouts.find((l) => l.id === selected)?.name}
          </Box>
        </Box>
        <Box sx={{ pointerEvents: 'none', maxWidth: '100%', overflow: 'hidden' }}>
          {renderPreview()}
        </Box>
      </Paper>
      {}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', minWidth: 0 }}>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={() => setSelected('grid')}
          sx={{ px: { xs: 3, sm: 4 }, py: 1.2, borderRadius: 1 }}
        >
          恢复默认
        </Button>
      </Box>
      <FloatingSaveButton show={isDirty} saving={saving} onClick={applyLayout} label="应用布局" />
    </Box>
    </Fade>
  );
}