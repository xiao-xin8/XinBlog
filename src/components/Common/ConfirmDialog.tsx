import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grow,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { ReactNode } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  content: ReactNode;
  confirmText?: string;
  confirmColor?: 'primary' | 'error' | 'warning' | 'success' | 'info';
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  content,
  confirmText = '确认',
  confirmColor = 'primary',
  loading = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={() => !loading && onClose()}
      fullWidth
      maxWidth="xs"
      TransitionComponent={Grow}
      PaperProps={{
        sx: { borderRadius: { xs: 2, sm: '12px' } },
      }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText color="text.secondary">{content}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            width: isMobile ? '100%' : 'auto',
            flexDirection: isMobile ? 'column-reverse' : 'row',
            justifyContent: 'flex-end',
          }}
        >
          <Button
            onClick={onClose}
            color="inherit"
            disabled={loading}
            fullWidth={isMobile}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            取消
          </Button>
          <Button
            onClick={onConfirm}
            variant="contained"
            color={confirmColor}
            disabled={loading}
            fullWidth={isMobile}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            {loading ? '处理中...' : confirmText}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
