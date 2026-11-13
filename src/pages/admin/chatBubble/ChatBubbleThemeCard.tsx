import { Box, Button, Paper, Typography, alpha } from '@mui/material';
import type { ThemePackage } from '@/types';

interface ChatBubbleThemeCardProps {
  theme: ThemePackage;
  isSelected: boolean;
  isActive: boolean;
  onApply: () => void;
  onReset: () => void;
}

export function ChatBubbleThemeCard({ theme, isSelected, isActive, onApply, onReset }: ChatBubbleThemeCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 1,
        cursor: 'default',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '2px solid',
        borderColor: isSelected ? 'primary.main' : 'transparent',
        bgcolor: (t) => (isSelected ? alpha(t.palette.primary.main, 0.06) : alpha(t.palette.primary.main, 0.02)),
        transition: 'all 0.2s ease',
      }}
    >
      <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ flexGrow: 1 }}>
        {theme.name}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
        {theme.description || theme.author || '聊天气泡主题'}
      </Typography>
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