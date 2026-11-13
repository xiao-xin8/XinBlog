import { Box, IconButton } from '@mui/material';

interface AnimatedMenuButtonProps {
  open: boolean;
  onClick: () => void;
  color?: string;
}

const LINE_TRANSITION = 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease';

/**
 * 汉堡菜单按钮：三条杠 ⇄ 叉，点击时形变。
 * 用于顶部栏布局下的移动端导航开关。
 */
export function AnimatedMenuButton({ open, onClick, color = 'text.primary' }: AnimatedMenuButtonProps) {
  const lineSx = {
    position: 'absolute' as const,
    left: 0,
    width: 20,
    height: 2,
    borderRadius: '2px',
    backgroundColor: 'currentColor',
    transition: LINE_TRANSITION,
  };

  return (
    <IconButton
      onClick={onClick}
      aria-label={open ? '关闭导航菜单' : '打开导航菜单'}
      aria-expanded={open}
      sx={{
        color,
        width: 44,
        height: 44,
        borderRadius: 1,
        '&:hover': { backgroundColor: 'action.hover' },
      }}
    >
      <Box sx={{ position: 'relative', width: 20, height: 14 }}>
        <Box
          sx={{
            ...lineSx,
            top: 0,
            transform: open ? 'translateY(6px) rotate(45deg)' : 'none',
          }}
        />
        <Box
          sx={{
            ...lineSx,
            top: 6,
            opacity: open ? 0 : 1,
            transform: open ? 'scaleX(0.4)' : 'none',
          }}
        />
        <Box
          sx={{
            ...lineSx,
            top: 12,
            transform: open ? 'translateY(-6px) rotate(-45deg)' : 'none',
          }}
        />
      </Box>
    </IconButton>
  );
}
