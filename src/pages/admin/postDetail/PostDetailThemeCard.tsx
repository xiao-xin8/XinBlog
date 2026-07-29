import { Box, Button, Paper, Typography, alpha, useTheme } from '@mui/material';
import type { ThemePackage } from '@/types';
interface PostDetailThemeCardProps {
  theme: ThemePackage;
  isSelected: boolean;
  isActive: boolean;
  onApply: () => void;
  onReset: () => void;
}
export function PostDetailThemeCard({
  theme,
  isSelected,
  isActive,
  onApply,
  onReset,
}: PostDetailThemeCardProps) {
  const muiTheme = useTheme();
  const postDetail = theme.components?.postDetail;
  const isGlass = postDetail?.variant === 'glass';
  const accent = muiTheme.palette.primary.main;
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 1,
        cursor: 'default',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '2px solid',
        borderColor: isSelected ? 'primary.main' : 'transparent',
        bgcolor: (t) =>
          isSelected
            ? alpha(t.palette.primary.main, 0.06)
            : alpha(t.palette.primary.main, 0.02),
        transition: 'all 0.2s ease',
      }}
    >
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flex: 1 }}>
        <Box
          sx={{
            width: 80,
            height: 60,
            borderRadius: 1,
            overflow: 'hidden',
            bgcolor: 'action.hover',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            background: isGlass
              ? `linear-gradient(135deg, ${alpha(accent, 0.12)} 0%, ${alpha(muiTheme.palette.secondary.main, 0.08)} 100%)`
              : alpha(accent, 0.06),
            border: (t) => `1px solid ${alpha(t.palette.divider, 0.4)}`,
          }}
        >
          {isGlass ? (
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start', px: 1.5 }}>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ height: 4, width: '70%', bgcolor: alpha(accent, 0.5), borderRadius: 0.5 }} />
                <Box sx={{ height: 3, width: '90%', bgcolor: alpha(accent, 0.25), borderRadius: 0.5 }} />
                <Box sx={{ height: 3, width: '60%', bgcolor: alpha(accent, 0.25), borderRadius: 0.5 }} />
              </Box>
              <Box sx={{ width: 18, height: 32, bgcolor: alpha(accent, 0.2), borderRadius: 0.5 }} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '70%' }}>
              <Box sx={{ height: 4, width: '80%', bgcolor: alpha(accent, 0.5), borderRadius: 0.5 }} />
              <Box sx={{ height: 3, width: '100%', bgcolor: alpha(accent, 0.25), borderRadius: 0.5 }} />
              <Box sx={{ height: 3, width: '75%', bgcolor: alpha(accent, 0.25), borderRadius: 0.5 }} />
            </Box>
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {theme.name}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ wordBreak: 'break-word', whiteSpace: 'normal' }}
          >
            {theme.description || theme.author || '文章详情主题'}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
        <Button
          variant={isSelected ? 'outlined' : 'contained'}
          size="small"
          fullWidth
          disabled={isSelected}
          onClick={(e) => {
            e.stopPropagation();
            onApply();
          }}
          sx={{ borderRadius: 1 }}
        >
          {isSelected ? (isActive ? '正在使用' : '已选中') : '应用'}
        </Button>
        {isSelected && (
          <Button
            variant="outlined"
            size="small"
            fullWidth
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            sx={{ borderRadius: 1 }}
          >
            恢复默认
          </Button>
        )}
      </Box>
    </Paper>
  );
}