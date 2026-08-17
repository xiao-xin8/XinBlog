import { Box, Paper, Stack, Typography, alpha, Fade } from '@mui/material';
import { useMemo } from 'react';
import type { MusicEditor } from './useMusicEditor';
import { MusicPlayerCard } from '@/components/MusicPlayer/MusicPlayerCard';
import { MusicPlayerWidget } from '@/components/MusicPlayer/MusicPlayerWidget';
import { useMusicPlayer } from '@/components/MusicPlayer/useMusicPlayer';






export function MusicPreviewPanel({ editor }: { editor: MusicEditor }) {
  const previewConfig = useMemo(() => editor.buildConfig(), [editor]);

  
  const player = useMusicPlayer(previewConfig);

  return (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          borderRadius: 1,
          border: '2px dashed',
          borderColor: 'primary.main',
          bgcolor: (t) => alpha(t.palette.primary.main, 0.02),
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
          预览
        </Typography>
        <Fade in timeout={400}>
          <Box>
            <MusicPlayerCard config={previewConfig} player={player} />
          </Box>
        </Fade>
      </Paper>

      {/* 侧边悬浮工具预览（真实 fixed 叠于页面侧边，禁用滚动拦截避免干扰管理后台） */}
      <MusicPlayerWidget player={player} position={previewConfig.position} defaultExpanded disableScrollIntercept />
    </Stack>
  );
}
