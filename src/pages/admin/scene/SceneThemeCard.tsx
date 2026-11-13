import { Box, Button, Paper, Typography, alpha, useTheme } from '@mui/material';
import type { ThemePackage } from '@/types';

interface SceneThemeCardProps {
  theme: ThemePackage;
  isSelected: boolean;
  isActive: boolean;
  onApply: () => void;
  onReset: () => void;
  preview?: React.ReactNode;
}

export function SceneThemeCard({
  theme,
  isSelected,
  isActive,
  onApply,
  onReset,
  preview,
}: SceneThemeCardProps) {
  const muiTheme = useTheme();
  const scene = theme.components?.scene;
  const accent = scene?.params?.color ?? muiTheme.palette.primary.main;

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
            backgroundColor: alpha(accent as string, 0.12),
          }}
        >
          {preview || (
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: accent as string,
                opacity: 0.7,
              }}
            />
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
            {theme.description || theme.author || '场景主题'}
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
