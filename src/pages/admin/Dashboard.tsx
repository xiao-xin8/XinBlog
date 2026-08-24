import { Paper, Typography, Grid, Box, Chip, alpha, Fade, ButtonBase, ToggleButton, ToggleButtonGroup, useTheme } from '@mui/material';
import { Article, Palette, PermMedia, People, Visibility } from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchDashboard } from '@/api/admin';
import { peekCache } from '@/api/client';
import { Loading } from '@/components/Common/Loading';
import { useSiteStore } from '@/stores/siteStore';
import type { DashboardCounts, DashboardTrends, DashboardResponse } from '@/api/admin';

const DAY_RANGES = [7, 30, 90] as const;


const SERIES = [
  { key: 'posts', label: '文章', color: 'primary' },
  { key: 'comments', label: '评论', color: 'secondary' },
  { key: 'likes', label: '点赞', color: 'success' },
  { key: 'users', label: '注册', color: 'warning' },
  { key: 'media', label: '媒体', color: 'info' },
] as const;

export function AdminDashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const site = useSiteStore();
  
  const showStats = site.config.enableDashboardStats ?? true;
  const dashboardCache = peekCache<DashboardResponse>('/api/v1/admin/dashboard');
  const [days, setDays] = useState<number>(30);
  const [counts, setCounts] = useState<DashboardCounts>(
    dashboardCache.data?.counts || { posts: 0, tags: 0, media: 0, users: 0, views: 0 }
  );
  const [trends, setTrends] = useState<DashboardTrends | null>(dashboardCache.data?.trends || null);
  const [loading, setLoading] = useState(!dashboardCache.hit);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    if (!dashboardCache.hit) setLoading(true);
    fetchDashboard(days).then((data) => {
      if (!mounted) return;
      if (data) {
        setCounts(data.counts);
        setTrends(data.trends);
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
    
    
  }, [days]);

  if (loading) {
    return <Loading text="加载站点数据中..." />;
  }

  const stats = [
    { title: '文章总数', value: counts.posts, icon: <Article />, color: 'primary.main', path: '/admin/posts' },
    { title: '标签总数', value: counts.tags, icon: <Palette />, color: 'secondary.main', path: '/admin/tags' },
    { title: '媒体总数', value: counts.media, icon: <PermMedia />, color: 'success.main', path: '/admin/media' },
    { title: '用户总数', value: counts.users, icon: <People />, color: 'warning.main', path: '/admin/users' },
  ];

  
  const dates = trends?.dates || [];
  const chartData = dates.map((date, i) => {
    const row: Record<string, string | number> = { date: date.slice(5) };
    if (trends) for (const s of SERIES) row[s.label] = trends[s.key][i];
    return row;
  });

  const toggleSeries = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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


        {showStats && (
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
          {}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                内容趋势
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.12), color: 'primary.main' }}>
                <Visibility fontSize="small" />
                <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  总阅读量 {counts.views.toLocaleString()} 次
                </Typography>

              </Box>

            </Box>

            <ToggleButtonGroup
              size="small"
              exclusive
              value={days}
              onChange={(_, v) => v && setDays(v)}
              sx={{ borderRadius: 1 }}
            >
              {DAY_RANGES.map((d) => (
                <ToggleButton key={d} value={d} sx={{ px: { xs: 1.5, sm: 2 }, fontWeight: 600, borderRadius: 'inherit' }}>
                  {d} 天
                </ToggleButton>

              ))}
            </ToggleButtonGroup>

          </Box>


          {}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
            {SERIES.map((s) => {
              const color = theme.palette[s.color].main;
              const off = hidden.has(s.key);
              return (
                <Chip
                  key={s.key}
                  label={s.label}
                  size="small"
                  clickable
                  onClick={() => toggleSeries(s.key)}
                  sx={{
                    fontWeight: 600,
                    opacity: off ? 0.4 : 1,
                    border: `1px solid ${alpha(color, 0.4)}`,
                    color,
                    bgcolor: off ? 'transparent' : alpha(color, 0.1),
                  }}
                />
              );
            })}
          </Box>


          <Fade in timeout={400}>
            <Box sx={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.secondary, 0.15)} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: theme.palette.text.secondary }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
                  <YAxis tick={{ fontSize: 12, fill: theme.palette.text.secondary }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: `1px solid ${alpha(theme.palette.text.secondary, 0.15)}`,
                      background: theme.palette.background.paper,
                      fontSize: 13,
                    }}
                    labelFormatter={(label) => `${label}`}
                  />
                  {SERIES.filter((s) => !hidden.has(s.key)).map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.label}
                      stroke={theme.palette[s.color].main}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      connectNulls
                    />
                  ))}
                </LineChart>

              </ResponsiveContainer>

            </Box>

          </Fade>

        </Paper>

        )}

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