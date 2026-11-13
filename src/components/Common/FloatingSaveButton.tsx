import { Box, Button, CircularProgress, Fade } from '@mui/material';
import { Save } from '@mui/icons-material';
import { useEffect, useRef, useState } from 'react';

interface FloatingSaveButtonProps {
  show: boolean;
  saving: boolean;
  onClick: () => void;
  label?: string;
}

/**
 * 统一的悬浮保存按钮：position: fixed 钉在视口上，不随页面滚动，
 * 无论滚动到哪里都始终可见。
 * 水平位置通过测量“侧边栏右侧的内容滚动区(main)”的真实左边距来确定，
 * 因此按钮永远钉在内容区左下、绝不会叠到侧边栏上；
 * 侧边栏展开/收起（main 宽度变化）时由 ResizeObserver 实时跟随，桌面/移动端都正确。
 */
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
        // 直接等于“内容区左边距(=侧边栏宽度) + 24”，随侧边栏实时移动
        left: leftOffset,
        zIndex: (theme) => theme.zIndex.drawer + 1,
        // 隐藏状态下禁用点击，避免透明按钮拦截页面交互
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
