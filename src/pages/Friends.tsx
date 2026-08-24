import { useEffect, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Grid,
  alpha,
  Fade,
  Skeleton,
  Card,
  CardActionArea,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
  Button,
  CircularProgress,
  Zoom,
  Avatar,
  IconButton,
} from '@mui/material';
import { Link as LinkIcon, Add, ListAlt, CloudUpload, Delete } from '@mui/icons-material';
import { useSiteStore } from '@/stores/siteStore';
import { useAuthStore } from '@/stores/authStore';
import { fetchFriends, applyFriend, fetchMyFriendApplications } from '@/api/friends';
import { uploadMedia } from '@/api/media';
import type { FriendLink, FriendsConfig, FriendApplication } from '@/types';
import { LazyImage } from '@/components/Common/LazyImage';
import { useSnackbar } from 'notistack';
import { compressImage, getBase64Size } from '@/utils/image';

const APPLY_MAX_AVATAR_SIZE = 30 * 1024;

function ApplyFriendDialog({ open, needsAudit, onClose, onSubmitted }: {
  open: boolean;
  needsAudit: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setUrl('');
      setDescription('');
      setEmail(user?.email || '');
      setAvatar('');
    }
  }, [open, user]);

  const handleAvatarUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const base64 = await compressImage(file, APPLY_MAX_AVATAR_SIZE, 400);
      if (getBase64Size(base64) > APPLY_MAX_AVATAR_SIZE) {
        enqueueSnackbar('头像压缩后仍超过 30KB', { variant: 'error' });
        return;
      }
      setAvatarUploading(true);
      const media = await uploadMedia(file.name, base64);
      setAvatar(media.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '头像上传失败';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await applyFriend({ name: name.trim(), url: url.trim(), description: description.trim(), email: email.trim(), avatar: avatar.trim() });
      setSubmitting(false);
      const msg = needsAudit ? '友链申请已提交，等待审核' : '友链申请成功';
      enqueueSnackbar(msg, { variant: 'success' });
      onSubmitted();
    } catch (err) {
      setSubmitting(false);
      enqueueSnackbar(err instanceof Error ? err.message : '提交失败', { variant: 'error' });
    }
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} maxWidth="sm" fullWidth TransitionComponent={Zoom} BackdropProps={{ 'aria-hidden': false }}>
      <form onSubmit={handleSubmit}>
        <DialogTitle>申请友链</DialogTitle>

        <DialogContent>
          <Stack spacing={3} sx={{ mt: 0.5 }}>
            {}
            <Stack direction="row" spacing={2} alignItems="center">
              {avatar ? (
                <Avatar src={avatar} variant="rounded" sx={{ width: 56, height: 56 }} />
              ) : (
                <Avatar variant="rounded" sx={{ width: 56, height: 56, bgcolor: 'action.hover' }}>
                  <IconButton component="label" size="small" sx={{ color: 'text.secondary' }}>
                    <CloudUpload fontSize="small" />
                    <input type="file" accept="image/*" hidden onChange={(e) => { handleAvatarUpload(e.target.files?.[0]); e.target.value = ''; }} />
                  </IconButton>

                </Avatar>

              )}
              <Box>
                <Stack direction="row" spacing={1}>
                  <Button component="label" size="small" variant="outlined" startIcon={avatarUploading ? <CircularProgress size={14} /> : <CloudUpload fontSize="small" />} disabled={avatarUploading}>
                    上传头像
                    <input type="file" accept="image/*" hidden onChange={(e) => { handleAvatarUpload(e.target.files?.[0]); e.target.value = ''; }} />
                  </Button>

                  {avatar && (
                    <IconButton size="small" color="inherit" onClick={() => setAvatar('')} disabled={avatarUploading} aria-label="清除头像">
                      <Delete fontSize="small" />
                    </IconButton>

                  )}
                </Stack>

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  选填，建议正方形图片，30KB 以内自动压缩
                </Typography>

              </Box>

            </Stack>

            <TextField label="站点名称" value={name} onChange={(e) => setName(e.target.value)} fullWidth required placeholder="你的站点名称" />
            <TextField
              label="站点链接"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              fullWidth
              required
              placeholder="https://example.com"
              InputProps={{ startAdornment: <LinkIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }}
            />
            <TextField label="一句话介绍" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline rows={2} />
            <TextField
              label="联系方式（邮箱）"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              type="email"
              placeholder="方便站长与你联系"
              helperText="用于通过审核或需要确认时的联系方式，不会公开展示"
            />
          </Stack>

        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-end' }}>
          <Button onClick={onClose} color="inherit" disabled={submitting}>取消</Button>

          <Button type="submit" variant="contained" startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <Add />} disabled={submitting}>
            {submitting ? '提交中...' : '提交申请'}
          </Button>

        </DialogActions>

      </form>

    </Dialog>

  );
}

function getHostName(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function MyApplicationsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const [apps, setApps] = useState<FriendApplication[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const d = await fetchMyFriendApplications();
        setApps(d.list);
      } catch (err) {
        enqueueSnackbar(err instanceof Error ? err.message : '加载申请记录失败', { variant: 'error' });
      } finally {
        setLoading(false);
      }
    })();
    
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth TransitionComponent={Zoom}>
      <DialogTitle>我的友链申请</DialogTitle>

      <DialogContent>
        {loading && apps.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>

        ) : apps.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            暂无申请记录
          </Typography>

        ) : (
          <Stack spacing={1.5}>
            {apps.map((a) => (
              <Box key={a.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {a.name}
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      color:
                        a.status === 'approved' ? 'success.main' : a.status === 'rejected' ? 'error.main' : 'warning.main',
                    }}
                  >
                    {a.status === 'approved' ? '已通过' : a.status === 'rejected' ? '已驳回' : '待审核'}
                  </Typography>

                </Stack>

                <Typography variant="caption" color="text.secondary">
                  {a.url}
                </Typography>

                {a.status === 'rejected' && (
                  <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="caption" color="error.main">
                      {a.remark ? `驳回原因：${a.remark}` : '您的申请已被驳回'}
                    </Typography>

                  </Box>

                )}
              </Box>

            ))}
          </Stack>

        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>关闭</Button>

      </DialogActions>

    </Dialog>

  );
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
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { enqueueSnackbar } = useSnackbar();
  const [friends, setFriends] = useState<FriendLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [myAppsOpen, setMyAppsOpen] = useState(false);

  const handleOpenApply = () => {
    if (!isAuthenticated) {
      enqueueSnackbar('请先登录后再申请友链', { variant: 'info' });
      return;
    }
    setApplyOpen(true);
  };

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
    <Fade in timeout={400}>
    <Box>
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


      {friendsConfig?.applyEnabled && (
        <Stack
          spacing={2}
          sx={{ position: 'fixed', right: { xs: 20, md: 32 }, bottom: { xs: 20, md: 32 }, zIndex: (t) => t.zIndex.fab, alignItems: 'center' }}
        >
          {isAuthenticated && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => setMyAppsOpen(true)}
              startIcon={<ListAlt fontSize="small" />}
              sx={{
                borderRadius: 21,
                bgcolor: 'background.paper',
                color: 'text.primary',
                boxShadow: (theme) => `0 2px 8px ${alpha(theme.palette.common.black, 0.12)}`,
              }}
            >
              我的申请
            </Button>

          )}
          <Fab
            color="primary"
            aria-label="申请友链"
            onClick={handleOpenApply}
            sx={{
              boxShadow: (theme) => `0 4px 16px ${alpha(theme.palette.primary.main, 0.35)}`,
              '&:hover': { transform: 'scale(1.08)' },
              transition: 'transform 0.2s ease',
            }}
          >
            <Add />
          </Fab>

        </Stack>

      )}
      {friendsConfig?.applyEnabled && (
        <ApplyFriendDialog
          open={applyOpen}
          needsAudit={friendsConfig.applyNeedsAudit !== false}
          onClose={() => setApplyOpen(false)}
          onSubmitted={() => {
            setApplyOpen(false);
            fetchFriends()
              .then((data) => setFriends(data.list))
              .catch(() => setFriends([]));
          }}
        />
      )}
      <MyApplicationsDialog open={myAppsOpen} onClose={() => setMyAppsOpen(false)} />
    </Box>

    </Fade>

  );
}
