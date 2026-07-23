import { useState } from 'react';
import { Box, Button, TextField, Typography, Paper, alpha, Fade } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useSnackbar } from 'notistack';
import { createComment } from '@/api/comments';

interface CommentEditorProps {
  slug: string;
  onSuccess: () => void;
}

const MAX_LENGTH = 2000;

export default function CommentEditor({ slug, onSuccess }: CommentEditorProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSubmit = async () => {
    const text = content.trim();
    if (!text) {
      enqueueSnackbar('评论内容不能为空', { variant: 'warning' });
      return;
    }
    if (text.length > MAX_LENGTH) {
      enqueueSnackbar(`评论内容不能超过 ${MAX_LENGTH} 字`, { variant: 'warning' });
      return;
    }
    setLoading(true);
    try {
      const res = await createComment(slug, text);
      if (res.code === 0) {
        setContent('');
        const status = res.data?.status;
        enqueueSnackbar(status === 'approved' ? '评论发布成功' : '评论已提交，等待审核', {
          variant: 'success',
        });
        onSuccess();
      } else {
        enqueueSnackbar(res.msg || '评论失败', { variant: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const nearLimit = content.length > MAX_LENGTH * 0.9;
  const overLimit = content.length > MAX_LENGTH;

  return (
    <Fade in timeout={300}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, sm: 2 },
          borderRadius: 1,
          bgcolor: 'background.paper',
          border: (theme) =>
            `1.5px solid ${focused ? alpha(theme.palette.primary.main, 0.45) : theme.palette.divider}`,
          boxShadow: (theme) =>
            focused ? `0 4px 16px ${alpha(theme.palette.primary.main, 0.1)}` : 'none',
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        }}
      >
        <TextField
        fullWidth
        multiline
        minRows={3}
        maxRows={6}
        placeholder="写下你的想法，与大家交流..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={loading}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 1.5,
            bgcolor: 'transparent',
            '& fieldset': { border: 'none' },
            '&:hover fieldset': { border: 'none' },
            '&.Mui-focused fieldset': { border: 'none' },
            '& .MuiInputBase-input::placeholder': {
              color: 'text.disabled',
              opacity: 1,
            },
          },
        }}
      />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mt: 1,
          pt: 1.5,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
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
        <Button
          variant="contained"
          size="small"
          endIcon={<SendIcon sx={{ fontSize: 18 }} />}
          onClick={handleSubmit}
          disabled={loading || !content.trim() || overLimit}
          sx={{
            borderRadius: 1,
            px: 2.5,
            textTransform: 'none',
            fontWeight: 600,
            boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.25)}`,
          }}
        >
          {loading ? '发布中' : '发布'}
        </Button>
      </Box>
    </Paper>
    </Fade>
  );
}
