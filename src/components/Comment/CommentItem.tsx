import { useState } from 'react';
import { Box, Avatar, Typography, IconButton, Paper, alpha, Fade } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useSnackbar } from 'notistack';
import { deleteComment } from '@/api/comments';
import { useAuthStore } from '@/stores/authStore';
import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import type { Comment } from '@/types/interaction';
interface CommentItemProps {
  comment: Comment;
  slug: string;
  onDeleted: () => void;
}
function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
const statusLabel: Record<string, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'warning.main' },
  rejected: { text: '未通过', color: 'error.main' },
};
export default function CommentItem({ comment, slug, onDeleted }: CommentItemProps) {
  const { user, isAuthenticated } = useAuthStore();
  const { enqueueSnackbar } = useSnackbar();
  const isOwner = isAuthenticated && user && String(comment.userId) === String(user.id);
  const isAdmin = user?.role === 'super_admin';
  const canDelete = isOwner || isAdmin;
  const status = statusLabel[comment.status];
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      const res = await deleteComment(slug, comment.id);
      if (res.code === 0) {
        enqueueSnackbar('删除成功', { variant: 'success' });
        onDeleted();
      } else {
        enqueueSnackbar(res.msg || '删除失败', { variant: 'error' });
      }
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };
  return (
    <Fade in timeout={300}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.75, sm: 2 },
          mb: 2,
          borderRadius: 1,
          bgcolor: 'background.paper',
          border: (theme) => `1px solid ${theme.palette.divider}`,
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          '&:hover': {
            boxShadow: (theme) => `0 6px 20px ${alpha(theme.palette.common.black, 0.06)}`,
            transform: 'translateY(-1px)',
          },
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Avatar
          src={comment.avatar || undefined}
          alt={comment.username || '用户'}
          sx={{ width: 40, height: 40, flexShrink: 0 }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, overflowWrap: 'break-word', minWidth: 0 }}>
                {comment.username || '未知用户'}
              </Typography>
              {status && (
                <Box
                  sx={{
                    px: 0.8,
                    py: 0.1,
                    borderRadius: 1,
                    bgcolor: (theme) => alpha(theme.palette[comment.status === 'pending' ? 'warning' : 'error'].main, 0.1),
                    color: status.color,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {status.text}
                </Box>
              )}
            </Box>
            {canDelete && (
              <IconButton
                size="small"
                onClick={() => setDeleteDialogOpen(true)}
                sx={{
                  color: 'text.secondary',
                  '&:hover': { color: 'error.main', bgcolor: (theme) => alpha(theme.palette.error.main, 0.08) },
                }}
                aria-label="删除"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {formatTime(comment.createdAt)}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: comment.status === 'rejected' ? 'text.secondary' : 'text.primary',
              lineHeight: 1.7,
            }}
          >
            {comment.content}
          </Typography>
        </Box>
      </Box>
      <ConfirmDialog
        open={deleteDialogOpen}
        title="确认删除评论？"
        content="删除后该评论将无法恢复，是否继续？"
        confirmText="确认删除"
        confirmColor="error"
        loading={deleting}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </Paper>
    </Fade>
  );
}