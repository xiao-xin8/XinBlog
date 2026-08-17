import { useEffect } from 'react';
import { Box, Container, Fade, Typography, alpha } from '@mui/material';
import { MusicNote } from '@mui/icons-material';
import { useSiteStore } from '@/stores/siteStore';
import { useSharedMusicPlayer, useSidebarVisible } from '@/components/MusicPlayer/MusicPlayerContext';
import { MusicPlayerCard } from '@/components/MusicPlayer/MusicPlayerCard';






export function MusicPage() {
  const music = useSiteStore((s) => s.config.music);
  const player = useSharedMusicPlayer();
  const { setShowSidebar } = useSidebarVisible();

  useEffect(() => {
    setShowSidebar(false);
    return () => setShowSidebar(true);
  }, [setShowSidebar]);

  return (
    <Fade in timeout={400}>
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
          <MusicNote sx={{ color: 'primary.main', fontSize: 28 }} />
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            音乐播放器
          </Typography>
        </Box>

        {!music?.enabled ? (
          <Box
            sx={{
              p: 4,
              borderRadius: 1,
              border: '1px dashed',
              borderColor: 'divider',
              textAlign: 'center',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.02),
            }}
          >
            <MusicNote sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              音乐播放器未启用
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
              请在管理后台 → 音乐播放器中开启并配置
            </Typography>
          </Box>
        ) : (
          <MusicPlayerCard config={music} player={player} />
        )}
      </Container>
    </Fade>
  );
}