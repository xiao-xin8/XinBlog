import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grow,
  useMediaQuery,
  useTheme,
} from '@mui/material';

interface LogoutConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LogoutConfirmDialog({ open, onClose, onConfirm }: LogoutConfirmDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      TransitionComponent={Grow}
      PaperProps={{
        sx: { borderRadius: { xs: 2, sm: '12px' } },
      }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>确认退出登录？</DialogTitle>

      <DialogContent>
        <DialogContentText color="text.secondary">
          退出后需要重新登录，是否继续？
        </DialogContentText>

      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1.5, width: isMobile ? '100%' : 'auto', flexDirection: isMobile ? 'column-reverse' : 'row', justifyContent: 'flex-end' }}>
          <Button
            onClick={onClose}
            color="inherit"
            fullWidth={isMobile}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            取消
          </Button>

          <Button
            onClick={onConfirm}
            variant="contained"
            color="primary"
            fullWidth={isMobile}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            确认退出
          </Button>

        </Box>

      </DialogActions>

    </Dialog>

  );
}
