import { Paper, Typography, Grid, Box, Chip, alpha, Fade, ButtonBase } from '@mui/material';
import { Article, Palette, PermMedia, People } from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { fetchDashboard } from '@/api/admin';
import { peekCache } from '@/api/client';
import { Loading } from '@/components/Common/Loading';
import type { DashboardCounts, DashboardResponse } from '@/api/admin';

export function AdminDashboard() {
  const navigate = useNavigate();
  const dashboardCache = peekCache<DashboardResponse>('/api/v1/admin/dashboard');
  const [counts, setCounts] = useState<DashboardCounts>(
    dashboardCache.data?.counts || { posts: 0, tags: 0, media: 0, users: 0 }
  );
  const [loading, setLoading] = useState(!dashboardCache.hit);

  useEffect(() => {
    if (!dashboardCache.hit) setLoading(true);
    fetchDashboard().then((data) => {
      if (data) setCounts(data.counts);
      setLoading(false);
    });
    // dashboardCache 在每次 render 都会重新创建，此处只需要在组件挂载时获取一次数据
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <Loading text="加载站点数据中..." />;
  }

  const stats = [
    { title: '文章总数', value: counts.posts, icon: <Article />, color: 'primary.main', path: '/admin/posts' },
    { title: '标签总数', value: counts.tags, icon: <Palette />, color: 'secondary.main', path: '/admin/tags' },
    { title: '媒体总数', value: counts.media, icon: <PermMedia />, color: 'success.main', path: '/admin/media' },
    { title: '用户总数', value: counts.users, icon: <People />, color: 'warning.main', path: '/admin/users' },
  ];

  return (
    <Fade in timeout={400}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
          站点概览
        </Typography>

        <Grid container spacing={3}>
          {stats.map((stat) => (
            <Grid item xs={12} sm={6} lg={3} key={stat.title}>
              <ButtonBase
                onClick={() => navigate(stat.path)}
                sx={{
                  width: '100%',
                  display: 'block',
                  borderRadius: 1,
                  textAlign: 'left',
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2, sm: 3 },
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    boxShadow: (theme) =>
                      theme.palette.mode === 'light'
                        ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                        : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
                    transition: (theme) =>
                      theme.transitions.create(['box-shadow', 'transform'], {
                        duration: theme.transitions.duration.short,
                      }),
                    '&:hover': {
                      boxShadow: (theme) =>
                        theme.palette.mode === 'light'
                          ? `0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}`
                          : `0 8px 28px ${alpha(theme.palette.common.black, 0.35)}`,
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: { xs: 44, sm: 52 },
                      height: { xs: 44, sm: 52 },
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      backgroundColor: stat.color,
                      boxShadow: `0 4px 12px ${stat.color}40`,
                      flexShrink: 0,
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'break-word' }}>
                      {stat.title}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, overflowWrap: 'break-word' }}>
                      {stat.value}
                    </Typography>
                  </Box>
                </Paper>
              </ButtonBase>
            </Grid>
          ))}
        </Grid>

        <Paper
          elevation={0}
          sx={{
            mt: 4,
            p: { xs: 2, sm: 3, md: 4 },
            borderRadius: 1,
            boxShadow: (theme) =>
              theme.palette.mode === 'light'
                ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            快捷入口
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', minWidth: 0 }}>
            {[
              { label: '前往文章管理', to: '/admin/posts', color: 'primary' },
              { label: '前往标签管理', to: '/admin/tags', color: 'secondary' },
              { label: '前往媒体管理', to: '/admin/media', color: 'success' },
              { label: '前往用户管理', to: '/admin/users', color: 'warning' },
              { label: '前往评论管理', to: '/admin/comments', color: 'error' },
              { label: '前往 AI 管理', to: '/admin/ai', color: 'info' },
              { label: '前往友链管理', to: '/admin/friends', color: 'primary' },
              { label: '前往主题管理', to: '/admin/themes', color: 'secondary' },
              { label: '前往外观设置', to: '/admin/appearance', color: 'success' },
              { label: '前往高级设置', to: '/admin/advanced', color: 'warning' },
            ].map((item) => {
              const paletteColor = item.color as 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
              return (
                <Chip
                  key={item.to}
                  label={item.label}
                  component={Link}
                  to={item.to}
                  clickable
                  sx={{
                    borderRadius: 1,
                    px: 1,
                    py: 2.5,
                    minHeight: 44,
                    height: 'auto',
                    fontWeight: 600,
                    backgroundColor: (theme) =>
                      alpha(theme.palette[paletteColor].main, theme.palette.mode === 'light' ? 0.1 : 0.2),
                    color: `${item.color}.main`,
                    '& .MuiChip-label': {
                      whiteSpace: 'normal',
                      overflowWrap: 'break-word',
                      maxWidth: '100%',
                    },
                  }}
                />
              );
            })}
          </Box>
        </Paper>
      </Box>
    </Fade>
  );
}
