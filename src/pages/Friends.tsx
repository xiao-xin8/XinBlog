import { useEffect, useState } from 'react';
import { Container, Box, Typography, Paper, Grid, alpha, Fade, Skeleton, Card, CardActionArea } from '@mui/material';
import { Link as LinkIcon } from '@mui/icons-material';
import { useSiteStore } from '@/stores/siteStore';
import { fetchFriends } from '@/api/friends';
import type { FriendLink, FriendsConfig } from '@/types';
import { LazyImage } from '@/components/Common/LazyImage';
function getHostName(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
function FriendCard({ friend, config }: { friend: FriendLink; config: FriendsConfig }) {
  const accentColor = config.cardColor || undefined;
  const isCompact = config.cardStyle === 'compact';
  const avatarRadius = config.avatarShape === 'circle' ? '50%' : 1;
  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: 1,
        overflow: 'hidden',
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
        boxShadow: (theme) =>
          theme.palette.mode === 'light'
            ? `0 4px 20px ${alpha(accentColor || theme.palette.primary.main, 0.08)}`
            : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? `0 8px 30px ${alpha(accentColor || theme.palette.primary.main, 0.16)}`
              : `0 8px 30px ${alpha(theme.palette.common.black, 0.35)}`,
        },
      }}
    >
      <CardActionArea
        component="a"
        href={friend.url}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          display: 'flex',
          flexDirection: isCompact ? 'row' : 'column',
          alignItems: isCompact ? 'center' : 'flex-start',
          gap: isCompact ? 2 : 2,
          p: isCompact ? 2 : 3,
          height: '100%',
          textAlign: 'left',
          borderRadius: 0,
        }}
      >
      {friend.avatar ? (
        <Box
          sx={{
            width: isCompact ? 56 : 72,
            height: isCompact ? 56 : 72,
            flexShrink: 0,
            borderRadius: avatarRadius,
            overflow: 'hidden',
            boxShadow: (theme) => `0 4px 16px ${alpha(accentColor || theme.palette.primary.main, 0.2)}`,
          }}
        >
          <LazyImage
            src={friend.avatar}
            alt={friend.name}
            objectFit="cover"
            placeholder="color"
            style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}
          />
        </Box>
      ) : (
        <Box
          sx={{
            width: isCompact ? 56 : 72,
            height: isCompact ? 56 : 72,
            flexShrink: 0,
            borderRadius: avatarRadius,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: (theme) =>
              `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            color: 'primary.contrastText',
            fontSize: isCompact ? '1.25rem' : '1.5rem',
            fontWeight: 700,
          }}
        >
          {friend.name.charAt(0)}
        </Box>
      )}
      <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: config.showDescription && friend.description ? 0.75 : 0 }}>
          <Typography
            variant={isCompact ? 'subtitle1' : 'h6'}
            sx={{
              fontWeight: 700,
              overflowWrap: 'break-word',
              minWidth: 0,
              color: 'text.primary',
            }}
          >
            {friend.name}
          </Typography>
          <LinkIcon
            fontSize="small"
            sx={{
              flexShrink: 0,
              color: accentColor ? 'inherit' : 'text.secondary',
              opacity: 0.6,
              ...(accentColor ? { color: accentColor } : {}),
            }}
          />
        </Box>
        {config.showDescription && friend.description && (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              lineHeight: 1.6,
              overflowWrap: 'break-word',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {friend.description}
          </Typography>
        )}
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.75,
            overflowWrap: 'break-word',
            color: accentColor || 'text.secondary',
            opacity: accentColor ? 0.9 : 0.7,
          }}
        >
          {getHostName(friend.url)}
        </Typography>
      </Box>
      </CardActionArea>
    </Card>
  );
}
export function Friends() {
  const { config } = useSiteStore();
  const friendsConfig = config.friends;
  const [friends, setFriends] = useState<FriendLink[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!friendsConfig?.enabled) return;
    let mounted = true;
    setLoading(true);
    fetchFriends()
      .then((data) => {
        if (!mounted) return;
        setFriends(data.list);
      })
      .catch(() => {
        if (!mounted) return;
        setFriends([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [friendsConfig?.enabled]);
  return (
    <Fade in timeout={500}>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 }, pb: { xs: 8, md: 12 } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 6 },
            mb: { xs: 3, md: 4 },
            borderRadius: 1,
            textAlign: 'center',
            background: (theme) =>
              `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
            boxShadow: (theme) =>
              theme.palette.mode === 'light'
                ? `0 8px 40px ${alpha(theme.palette.primary.main, 0.1)}`
                : `0 8px 40px ${alpha(theme.palette.common.black, 0.3)}`,
          }}
        >
          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 800,
              mb: 2,
              fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' },
              overflowWrap: 'break-word',
            }}
          >
            {friendsConfig?.title || '友链'}
          </Typography>
          {friendsConfig?.subtitle && (
            <Typography
              variant="h6"
              color="primary.main"
              sx={{
                fontWeight: 500,
                fontSize: { xs: '1rem', sm: '1.25rem' },
                overflowWrap: 'break-word',
              }}
            >
              {friendsConfig.subtitle}
            </Typography>
          )}
        </Paper>
        {!friendsConfig?.enabled ? (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, md: 6 },
              borderRadius: 1,
              textAlign: 'center',
              background: (theme) =>
                `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
              boxShadow: (theme) =>
                theme.palette.mode === 'light'
                  ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                  : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
              友链功能暂未开启
            </Typography>
            <Typography variant="body2" color="text.secondary">
              站长正在整理有趣的站点，稍后再来看看吧～
            </Typography>
          </Paper>
        ) : loading ? (
          <Grid container spacing={{ xs: 2, md: 3 }}>
            {Array.from({ length: 6 }).map((_, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 1 }} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Fade in timeout={400}>
            <Box>
              {friends.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 4, md: 6 },
                    borderRadius: 1,
                    textAlign: 'center',
                    background: (theme) =>
                      `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
                    boxShadow: (theme) =>
                      theme.palette.mode === 'light'
                        ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                        : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    暂无友链
                  </Typography>
                </Paper>
              ) : (
                <Grid container spacing={{ xs: 2, md: 3 }}>
                  {friends.map((friend) => (
                    <Grid item xs={12} sm={6} md={4} key={friend.id}>
                      <FriendCard friend={friend} config={friendsConfig} />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          </Fade>
        )}
      </Container>
    </Fade>
  );
}