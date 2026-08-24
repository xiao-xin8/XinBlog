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


      {}
      <MusicPlayerWidget player={player} position={previewConfig.position} defaultExpanded disableScrollIntercept />
    </Stack>

  );
}
