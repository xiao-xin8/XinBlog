import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  alpha,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useSnackbar } from 'notistack';
import { createMessage } from '@/api/messages';

interface MessageWallEditorProps {
  open: boolean;
  allowAnonymous: boolean;
  isAuthenticated: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_LENGTH = 50;

export default function MessageWallEditor({
  open,
  allowAnonymous,
  isAuthenticated,
  onClose,
  onSuccess,
}: MessageWallEditorProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [content, setContent] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setContent('');
      setNickname('');
      setLoading(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    const text = content.trim();
    if (!text) {
      enqueueSnackbar('留言内容不能为空', { variant: 'warning' });
      return;
    }
    if (text.length > MAX_LENGTH) {
      enqueueSnackbar(`留言内容不能超过 ${MAX_LENGTH} 字`, { variant: 'warning' });
      return;
    }
    if (!isAuthenticated && allowAnonymous) {
      const nick = nickname.trim();
      if (!nick) {
        enqueueSnackbar('请填写昵称', { variant: 'warning' });
        return;
      }
    }
    setLoading(true);
    try {
      const res = await createMessage(text, isAuthenticated ? undefined : nickname.trim());
      if (res.code === 0) {
        const status = res.data?.status;
        enqueueSnackbar(status === 'approved' ? '留言成功' : '留言已提交，等待审核', {
          variant: 'success',
        });
        onSuccess();
        onClose();
      } else {
        enqueueSnackbar(res.msg || '留言失败', { variant: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const nearLimit = content.length > MAX_LENGTH * 0.9;
  const overLimit = content.length > MAX_LENGTH;
  const isVisitor = !isAuthenticated && allowAnonymous;
  
  const anonymousDisabled = !isAuthenticated && !allowAnonymous;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          pb: 1,
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
        }}
      >
        新增留言
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5 }}>
        {anonymousDisabled && (
          <Alert
            severity="warning"
            sx={{
              mb: 2,
              borderRadius: 1,
              '& .MuiAlert-icon': { alignItems: 'center' },
            }}
          >
            <Typography variant="body2">留言墙暂未开放匿名留言，请登录后再来留言</Typography>

          </Alert>

        )}
        {isVisitor && (
          <TextField
            fullWidth
            size="small"
            label="昵称"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={loading}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 1,
              },
            }}
          />
        )}
        <TextField
          fullWidth
          multiline
          minRows={4}
          maxRows={8}
          label="留言内容"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={loading || (!isAuthenticated && !allowAnonymous)}
          slotProps={{ htmlInput: { maxLength: MAX_LENGTH } }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 1,
            },
          }}
        />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mt: 1.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: overLimit ? 'error.main' : nearLimit ? 'warning.main' : 'text.secondary',
              fontWeight: nearLimit || overLimit ? 600 : 400,
            }}
          >
            {content.length}/{MAX_LENGTH}
          </Typography>

        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mt: 1,
            px: 1.5,
            py: 1,
            borderRadius: 1,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
          }}
        >
          <InfoOutlinedIcon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
            {isVisitor
              ? '访客留言发布后不可删除，请确认内容后再提交'
              : anonymousDisabled
                ? '需要登录后才能留言'
                : '登录用户可以在留言管理中删除自己的留言'}
          </Typography>

        </Box>

      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{
            borderRadius: (theme) => `max(8px, ${theme.shape.borderRadius}px - 4px)`,
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          取消
        </Button>

        <Button
          variant="contained"
          endIcon={<SendIcon sx={{ fontSize: 18 }} />}
          onClick={handleSubmit}
          disabled={
            loading || anonymousDisabled || !content.trim() || overLimit || (isVisitor && !nickname.trim())
          }
          sx={{
            borderRadius: (theme) => `max(8px, ${theme.shape.borderRadius}px - 4px)`,
            px: 3,
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          {loading ? '发布中' : '发布'}
        </Button>

      </DialogActions>

    </Dialog>

  );
}
