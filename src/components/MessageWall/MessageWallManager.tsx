import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  alpha,
  Skeleton,
  Divider,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { useSnackbar } from 'notistack';
import { getMyMessages, deleteMessage } from '@/api/messages';
import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import type { Message } from '@/types/interaction';

interface MessageWallManagerProps {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const STATUS_META: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'error' }> = {
  pending: { label: '待审核', color: 'warning' },
  approved: { label: '已发布', color: 'success' },
  rejected: { label: '已拒绝', color: 'error' },
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MessageWallManager({ open, onClose, onChanged }: MessageWallManagerProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyMessages();
      if (res.code === 0 && res.data) {
        setMessages(res.data.list);
      } else {
        enqueueSnackbar(res.msg || '获取留言失败', { variant: 'error' });
      }
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteMessage(deleteTarget.id);
      if (res.code === 0) {
        enqueueSnackbar('删除成功', { variant: 'success' });
        
        setMessages((prev) => prev.filter((m) => m.id !== deleteTarget.id));
        onChanged();
        load();
      } else if (res.code === 404) {
        
        setMessages((prev) => prev.filter((m) => m.id !== deleteTarget.id));
        enqueueSnackbar('该留言已不存在，已从列表移除', { variant: 'warning' });
      } else {
        enqueueSnackbar(res.msg || '删除失败', { variant: 'error' });
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

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
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
        }}
      >
        <PersonOutlineIcon sx={{ fontSize: 20, color: 'primary.main' }} />
        我的留言
        <Box
          component="span"
          sx={{
            ml: 0.5,
            px: 1,
            py: 0.2,
            borderRadius: 1,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            fontWeight: 700,
            fontSize: '0.75rem',
          }}
        >
          {messages.length}
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 2, minHeight: 200, maxHeight: 480 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, py: 1 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rectangular" height={64} sx={{ borderRadius: 1 }} />
            ))}
          </Box>
        ) : messages.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              py: 6,
            }}
          >
            <PersonOutlineIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary">
              你还没有发布过留言
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {messages.map((msg, idx) => {
              const meta = STATUS_META[msg.status] || STATUS_META.pending;
              return (
                <Box key={msg.id}>
                  {idx > 0 && <Divider sx={{ my: 1.5 }} />}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.5,
                      py: 0.5,
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Chip
                          label={meta.label}
                          size="small"
                          color={meta.color}
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, borderRadius: 0.5 }}
                        />
                        <Typography variant="caption" color="text.disabled">
                          {formatTime(msg.createdAt)}
                        </Typography>
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          lineHeight: 1.6,
                        }}
                      >
                        {msg.nickname || msg.content}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => setDeleteTarget(msg)}
                      sx={{
                        flexShrink: 0,
                        width: 28,
                        height: 28,
                        color: 'error.main',
                      }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          sx={{
            borderRadius: (theme) => `max(8px, ${theme.shape.borderRadius}px - 4px)`,
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          关闭
        </Button>
      </DialogActions>

      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除留言？"
        content="删除后该留言将无法恢复，是否继续？"
        confirmText="确认删除"
        confirmColor="error"
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </Dialog>
  );
}
