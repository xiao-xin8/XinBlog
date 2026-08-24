import { Box, Button, CircularProgress, Fade } from '@mui/material';
import { Save } from '@mui/icons-material';
import { useEffect, useRef, useState } from 'react';

interface FloatingSaveButtonProps {
  show: boolean;
  saving: boolean;
  onClick: () => void;
  label?: string;
}


export function FloatingSaveButton({ show, saving, onClick, label = '保存' }: FloatingSaveButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [leftOffset, setLeftOffset] = useState(284);

  useEffect(() => {
    const main = ref.current?.closest('main') as HTMLElement | null;
    if (!main) return;
    const update = () => setLeftOffset(Math.round(main.getBoundingClientRect().left) + 24);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(main);
    return () => ro.disconnect();
  }, []);

  return (
    <Box
      ref={ref}
      sx={{
        position: 'fixed',
        bottom: { xs: 16, sm: 24 },
        
        left: leftOffset,
        zIndex: (theme) => theme.zIndex.drawer + 1,
        
        pointerEvents: show ? 'auto' : 'none',
        transition: (theme) =>
          theme.transitions.create('left', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
      }}
    >
      <Fade in={show} timeout={300}>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          onClick={onClick}
          disabled={saving}
          sx={{
            px: { xs: 3, sm: 4 },
            py: 1.2,
            fontWeight: 700,
            boxShadow: (theme) =>
              theme.palette.mode === 'light'
                ? `0 8px 24px ${theme.palette.primary.main}40`
                : `0 8px 24px ${theme.palette.common.black}55`,
          }}
        >
          {saving ? '保存中...' : label}
        </Button>

      </Fade>

    </Box>

  );
}
