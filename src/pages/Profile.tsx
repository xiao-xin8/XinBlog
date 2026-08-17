import { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Avatar,
  Button,
  TextField,
  Chip,
  alpha,
  Alert,
  Skeleton,
  Fade,
} from '@mui/material';
import { AutoAwesome, CameraAlt, Save, Person, Email, Badge } from '@mui/icons-material';
import { useAuthStore } from '@/stores/authStore';
import { fetchUserProfile, updateUserProfile } from '@/api/user';
import { Loading } from '@/components/Common/Loading';
import type { UserProfile } from '@/api/user';
import { useSnackbar } from 'notistack';

const MAX_AVATAR_SIZE = 30 * 1024;

import { getBase64Size, compressImage } from '@/utils/image';



const roleLabels: Record<string, string> = {
  guest: '访客',
  admin: '管理员',
  super_admin: '超级管理员',
};

export function Profile() {
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile>({
    nickname: '',
    bio: '',
    avatar: '',
  });
  const [avatarLoading, setAvatarLoading] = useState(false);
  const userExists = !!user;

  useEffect(() => {
    let mounted = true;
    const fallbackAvatar = user?.avatar || '';
    setLoading(true);
    fetchUserProfile().then((data) => {
      if (!mounted) return;
      if (data) {
        setProfile({
          nickname: data.nickname || '',
          bio: data.bio || '',
          avatar: data.avatar || fallbackAvatar,
        });
      } else if (userExists) {
        setProfile((prev) => ({ ...prev, avatar: fallbackAvatar }));
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [user?.avatar, userExists]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImage(file, MAX_AVATAR_SIZE, 400);
      if (getBase64Size(base64) > MAX_AVATAR_SIZE) {
        setMessage({ type: 'error', text: '头像压缩后仍超过 30KB' });
        return;
      }
      setAvatarLoading(true);
      setProfile((prev) => ({ ...prev, avatar: base64 }));
      setMessage(null);
    } catch {
      setMessage({ type: 'error', text: '头像处理失败' });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const ok = await updateUserProfile({
      nickname: (profile.nickname || '').trim(),
      bio: (profile.bio || '').trim(),
      avatar: profile.avatar,
    });
    if (ok) {
      updateUser({ avatar: profile.avatar });
      enqueueSnackbar('个人资料已保存', { variant: 'success' });
    } else {
      enqueueSnackbar('保存失败，请稍后再试', { variant: 'error' });
    }
    setSaving(false);
  };

  if (!isAuthenticated) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 6, sm: 8 }, minHeight: { xs: '60dvh', sm: 'auto' }, display: 'flex', alignItems: 'center' }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 1,
            textAlign: 'center',
            width: '100%',
            boxShadow: (theme) =>
              theme.palette.mode === 'light'
                ? `0 8px 40px ${alpha(theme.palette.primary.main, 0.1)}`
                : `0 8px 40px ${alpha(theme.palette.common.black, 0.3)}`,
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            请先登录
          </Typography>
          <Typography variant="body2" color="text.secondary">
            登录后即可查看和编辑个人资料
          </Typography>
        </Paper>
      </Container>
    );
  }

  if (loading) {
    return <Loading text="加载个人资料中..." />;
  }

  return (
    <Fade in timeout={400}>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {/* Header Card */}
      <Paper
        elevation={0}
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 1,
          mb: 3,
          p: { xs: 3, sm: 4, md: 5 },
          textAlign: 'center',
          background: (theme) => theme.palette.gradient.hero,
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? `0 8px 40px ${alpha(theme.palette.primary.main, 0.12)}`
              : `0 8px 40px ${alpha(theme.palette.common.black, 0.3)}`,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: { xs: 12, sm: 16 },
            right: { xs: 16, sm: 24 },
            color: (theme) => alpha(theme.palette.primary.main, 0.25),
          }}
        >
          <AutoAwesome sx={{ fontSize: { xs: 28, sm: 40 } }} />
        </Box>
        <Box
          sx={{
            position: 'absolute',
            bottom: { xs: 12, sm: 20 },
            left: { xs: 16, sm: 28 },
            color: (theme) => alpha(theme.palette.secondary.main, 0.25),
          }}
        >
          <AutoAwesome sx={{ fontSize: { xs: 20, sm: 28 } }} />
        </Box>

        <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
          {avatarLoading && !profile.avatar && (
            <Skeleton
              variant="circular"
              sx={{
                width: { xs: 96, sm: 120 },
                height: { xs: 96, sm: 120 },
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            />
          )}
          <Avatar
            src={profile.avatar || undefined}
            onLoad={() => setAvatarLoading(false)}
            onError={() => setAvatarLoading(false)}
            sx={{
              width: { xs: 96, sm: 120 },
              height: { xs: 96, sm: 120 },
              mx: 'auto',
              fontSize: { xs: 40, sm: 48 },
              fontWeight: 700,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.primary.main, 0.3)}`,
            }}
          >
            {user?.username.charAt(0).toUpperCase()}
          </Avatar>
          <Button
            component="label"
            sx={{
              position: 'absolute',
              bottom: 0,
              right: { xs: -4, sm: -8 },
              minWidth: 0,
              width: { xs: 44, sm: 40 },
              height: { xs: 44, sm: 40 },
              borderRadius: '50%',
              bgcolor: 'background.paper',
              color: 'primary.main',
              boxShadow: 2,
              '&:hover': { bgcolor: 'background.paper' },
            }}
          >
            <CameraAlt sx={{ fontSize: { xs: 20, sm: 18 } }} />
            <input type="file" accept="image/*" hidden onChange={handleAvatarChange} />
          </Button>
        </Box>

        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }, overflowWrap: 'break-word' }}>
          {profile.nickname || user?.username}
        </Typography>
        {profile.bio && (
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2, fontSize: { xs: '0.875rem', sm: '1rem' }, overflowWrap: 'break-word' }}>
            {profile.bio}
          </Typography>
        )}
        <Chip
          label={roleLabels[user?.role || 'guest']}
          size="small"
          sx={{
            borderRadius: (theme) => Math.max(6, theme.shape.borderRadius - 6),
            px: 1,
            fontWeight: 600,
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.7),
            color: 'primary.main',
            backdropFilter: 'blur(8px)',
          }}
        />
      </Paper>

      {/* Form Card */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 1,
          p: { xs: 3, md: 4 },
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
              : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
        }}
      >
        {message && (
          <Alert severity={message.type} sx={{ mb: 3, borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4) }}>
            {message.text}
          </Alert>
        )}

        <Box sx={{ display: 'grid', gap: 3 }}>
          <TextField
            label="用户名"
            value={user?.username || ''}
            InputProps={{ startAdornment: <Person color="action" sx={{ mr: 1 }} /> }}
            disabled
            fullWidth
          />
          <TextField
            label="邮箱"
            value={user?.email || ''}
            InputProps={{ startAdornment: <Email color="action" sx={{ mr: 1 }} /> }}
            disabled
            fullWidth
          />
          <TextField
            label="昵称"
            value={profile.nickname}
            onChange={(e) => setProfile((prev) => ({ ...prev, nickname: e.target.value }))}
            InputProps={{ startAdornment: <Badge color="action" sx={{ mr: 1 }} /> }}
            fullWidth
            placeholder="给自己取个好听的昵称"
          />
          <TextField
            label="个性签名"
            value={profile.bio}
            onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))}
            fullWidth
            multiline
            rows={3}
            placeholder="写一句话，展示此刻的心情"
          />

          <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={saving}
              fullWidth
              sx={{
                px: 4,
                py: 1.2,
                borderRadius: (theme) => Math.max(8, theme.shape.borderRadius - 4),
                fontWeight: 700,
                background: (theme) => theme.palette.gradient.primary,
                color: (theme) => (theme.palette.mode === 'light' ? '#fff' : '#000'),
              }}
            >
              {saving ? '保存中...' : '保存资料'}
            </Button>
          </Box>
        </Box>
      </Paper>
      </Container>
    </Fade>
  );
}
