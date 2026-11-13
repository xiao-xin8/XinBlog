import { Box, Paper, Stack, Typography, alpha, Fade } from '@mui/material';
import { useMemo } from 'react';
import type { MusicEditor } from './useMusicEditor';
import { MusicPlayerCard } from '@/components/MusicPlayer/MusicPlayerCard';
import { MusicPlayerWidget } from '@/components/MusicPlayer/MusicPlayerWidget';
import { useMusicPlayer } from '@/components/MusicPlayer/useMusicPlayer';

/**
 * 效果预览：真实渲染两种形态的播放器（使用当前未保存的配置）。
 * - 页面嵌入卡片：按当前配置渲染
 * - 侧边悬浮小工具：真实叠在页面侧边，可展开/收起播放
 */
export function MusicPreviewPanel({ editor }: { editor: MusicEditor }) {
  const previewConfig = useMemo(() => editor.buildConfig(), [editor]);

  // 预览播放器实例：嵌入卡片与侧边悬浮共用同一播放器，保持播放状态同步
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
