import { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  Typography,
  alpha,
  Fade,
} from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import LinkIcon from '@mui/icons-material/Link';
import { useSnackbar } from 'notistack';

interface ShareButtonsProps {
  title: string;
  url?: string;
}

const canSystemShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export default function ShareButtons({ title, url }: ShareButtonsProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        enqueueSnackbar('链接已复制', { variant: 'success' });
      });
    } else {
      enqueueSnackbar('复制失败，请手动复制地址栏', { variant: 'warning' });
    }
    handleClose();
  };

  const handleSystemShare = async () => {
    try {
      await navigator.share({
        title,
        text: title,
        url: shareUrl,
      });
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        enqueueSnackbar('分享失败', { variant: 'error' });
      }
    }
    handleClose();
  };

  if (!canSystemShare) {
    return (
      <Button
        variant="outlined"
        size="small"
        startIcon={<LinkIcon sx={{ fontSize: 18 }} />}
        onClick={handleCopy}
        sx={{
          borderRadius: 1,
          px: 2.5,
          py: 1,
          textTransform: 'none',
          fontWeight: 600,
          borderColor: (theme) => alpha(theme.palette.text.secondary, 0.25),
          color: 'text.secondary',
          '&:hover': {
            borderColor: (theme) => alpha(theme.palette.primary.main, 0.45),
            color: 'primary.main',
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
          },
        }}
      >
        复制链接
      </Button>

    );
  }

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<ShareIcon sx={{ fontSize: 18 }} />}
        onClick={handleOpen}
        sx={{
          borderRadius: 1,
          px: 2.5,
          py: 1,
          textTransform: 'none',
          fontWeight: 600,
          borderColor: (theme) => alpha(theme.palette.text.secondary, 0.25),
          color: 'text.secondary',
          '&:hover': {
            borderColor: (theme) => alpha(theme.palette.primary.main, 0.45),
            color: 'primary.main',
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
          },
        }}
      >
        分享
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        TransitionComponent={Fade}
        PaperProps={{
          elevation: 0,
          sx: {
            mt: 1,
            borderRadius: 1,
            boxShadow: (theme) =>
              theme.palette.mode === 'light'
                ? `0 8px 30px ${alpha(theme.palette.common.black, 0.1)}`
                : `0 8px 30px ${alpha(theme.palette.common.black, 0.3)}`,
            minWidth: 180,
          },
        }}
      >
        <MenuItem
          onClick={handleSystemShare}
          sx={{ py: 1, borderRadius: 0.5, mx: 0.5, my: 0.25 }}
        >
          <ListItemIcon>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
                '& svg': { fontSize: 16 },
              }}
            >
              <ShareIcon fontSize="small" />
            </Box>

          </ListItemIcon>

          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            系统分享
          </Typography>

        </MenuItem>

        <MenuItem
          onClick={handleCopy}
          sx={{ py: 1, borderRadius: 0.5, mx: 0.5, my: 0.25 }}
        >
          <ListItemIcon>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: (theme) => alpha(theme.palette.success.main, 0.1),
                color: 'success.main',
                '& svg': { fontSize: 16 },
              }}
            >
              <LinkIcon fontSize="small" />
            </Box>

          </ListItemIcon>

          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            复制链接
          </Typography>

        </MenuItem>

      </Menu>

    </>

  );
}
