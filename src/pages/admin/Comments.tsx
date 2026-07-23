import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  FormControlLabel,
  Switch,
  Divider,
  Avatar,
  CircularProgress,
  TablePagination,
  FormControl,
  Select,
  MenuItem,
  useMediaQuery,
  alpha,
  Fade,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import { getInteractionSettings, updateInteractionSettings } from '@/api/interaction';
import { getAdminComments, updateAdminComment, deleteAdminComment } from '@/api/comments';
import { Loading } from '@/components/Common/Loading';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import type { InteractionSettings, AdminComment } from '@/types/interaction';

type CommentTab = 'settings' | 'audit' | 'manage';

const TAB_LIST: { value: CommentTab; label: string }[] = [
  { value: 'settings', label: '基础设置' },
  { value: 'audit', label: '评论审核' },
  { value: 'manage', label: '评论管理' },
];

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

export function AdminComments() {
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  const [tab, setTab] = useState<CommentTab>('settings');
  const [settings, setSettings] = useState<InteractionSettings>({
    commentsEnabled: true,
    likesEnabled: true,
    commentAudit: true,
  });
  const [initialSettings, setInitialSettings] = useState<InteractionSettings>(settings);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [comments, setComments] = useState<AdminComment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: number | null }>({
    open: false,
    id: null,
  });

  const loadComments = useCallback(
    async (targetPage: number, status?: string, limit = rowsPerPage) => {
      setLoading(true);
      const res = await getAdminComments(status, targetPage, limit);
      if (res.code === 0 && res.data) {
        setComments(res.data.list);
        setTotal(res.data.total);
      } else {
        enqueueSnackbar(res.msg || '获取评论失败', { variant: 'error' });
      }
      setLoading(false);
    },
    [enqueueSnackbar, rowsPerPage]
  );

  useEffect(() => {
    getInteractionSettings().then((res) => {
      if (res.code === 0 && res.data) {
        setSettings(res.data);
        setInitialSettings(res.data);
      } else {
        enqueueSnackbar(res.msg || '获取设置失败', { variant: 'error' });
      }
      setSettingsLoading(false);
    });
  }, [enqueueSnackbar]);

  const settingsDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(initialSettings),
    [settings, initialSettings]
  );

  useEffect(() => {
    if (tab === 'settings') return;
    const status = tab === 'audit' ? 'pending' : 'approved';
    setLoading(true);
    getAdminComments(status, 1, rowsPerPage).then((res) => {
      if (res.code === 0 && res.data) {
        setComments(res.data.list);
        setTotal(res.data.total);
      } else {
        enqueueSnackbar(res.msg || '获取评论失败', { variant: 'error' });
      }
      setPage(0);
      setLoading(false);
    });
  }, [tab, rowsPerPage, enqueueSnackbar]);

  const handleSaveSettings = async () => {
    setSaving(true);
    const res = await updateInteractionSettings(settings);
    if (res.code === 0) {
      if (res.data) {
        setSettings(res.data);
        setInitialSettings(res.data);
      }
      enqueueSnackbar('保存成功', { variant: 'success' });
    } else {
      enqueueSnackbar(res.msg || '保存失败', { variant: 'error' });
    }
    setSaving(false);
  };

  const handleStatusChange = async (id: number, status: string) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    try {
      const res = await updateAdminComment(id, { status });
      if (res.code === 0) {
        enqueueSnackbar(status === 'approved' ? '已通过' : '已拒绝', { variant: 'success' });
        loadComments(page + 1, tab === 'audit' ? 'pending' : 'approved');
      } else {
        enqueueSnackbar(res.msg || '操作失败', { variant: 'error' });
      }
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteClick = (id: number) => {
    setDeleteDialog({ open: true, id });
  };

  const handleConfirmDelete = async () => {
    const id = deleteDialog.id;
    if (id == null) return;
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      const res = await deleteAdminComment(id);
      if (res.code === 0) {
        enqueueSnackbar('删除成功', { variant: 'success' });
        loadComments(page + 1, tab === 'audit' ? 'pending' : 'approved');
      } else {
        enqueueSnackbar(res.msg || '删除失败', { variant: 'error' });
      }
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDeleteDialog({ open: false, id: null });
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
    loadComments(newPage + 1, tab === 'audit' ? 'pending' : 'approved');
  };

  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const paperShadow = {
    boxShadow: (t: typeof theme) =>
      t.palette.mode === 'light'
        ? `0 4px 20px ${alpha(t.palette.primary.main, 0.08)}`
        : `0 4px 20px ${alpha(t.palette.common.black, 0.25)}`,
  };

  const renderSettings = () => (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 1,
        overflow: 'hidden',
        ...paperShadow,
      }}
    >
      {settingsLoading ? (
        <Loading text="加载设置中..." />
      ) : (
        <Fade in timeout={400}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.commentsEnabled}
                  onChange={(e) => setSettings((s) => ({ ...s, commentsEnabled: e.target.checked }))}
                />
              }
              label="开启评论功能"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.likesEnabled}
                  onChange={(e) => setSettings((s) => ({ ...s, likesEnabled: e.target.checked }))}
                />
              }
              label="开启点赞功能"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.commentAudit}
                  onChange={(e) => setSettings((s) => ({ ...s, commentAudit: e.target.checked }))}
                />
              }
              label="开启评论审核（新评论需审核后显示）"
            />
            <Divider sx={{ my: 1 }} />
            <FloatingSaveButton show={settingsDirty} saving={saving} onClick={handleSaveSettings} label="保存" />
          </Box>
        </Fade>
      )}
    </Paper>
  );

  const renderCommentCard = (comment: AdminComment) => (
    <Paper
      key={comment.id}
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 1,
        border: (t) => `1px solid ${t.palette.divider}`,
        transition: 'box-shadow 0.2s ease',
        '&:hover': {
          boxShadow: (t) => `0 6px 20px ${alpha(t.palette.common.black, 0.06)}`,
        },
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, minWidth: 0 }}>
        <Avatar src={comment.avatar || undefined} alt={comment.username || '用户'} sx={{ width: 40, height: 40, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ overflowWrap: 'break-word', fontWeight: 700 }}>
            {comment.username || '未知用户'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'break-word' }}>
            {formatTime(comment.createdAt)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          {tab === 'audit' && (
            <Button
              size="small"
              variant="outlined"
              color="success"
              disabled={processingIds.has(comment.id)}
              onClick={() => handleStatusChange(comment.id, 'approved')}
              startIcon={processingIds.has(comment.id) ? <CircularProgress size={14} color="inherit" /> : undefined}
              sx={{ textTransform: 'none', borderRadius: 1, minWidth: 64 }}
            >
              {processingIds.has(comment.id) ? '通过中' : '通过'}
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            color="error"
            disabled={deletingIds.has(comment.id)}
            onClick={() => handleDeleteClick(comment.id)}
            startIcon={deletingIds.has(comment.id) ? <CircularProgress size={14} color="inherit" /> : undefined}
            sx={{ textTransform: 'none', borderRadius: 1, minWidth: 64 }}
          >
            {deletingIds.has(comment.id) ? '删除中' : '删除'}
          </Button>
        </Box>
      </Box>
      <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {comment.content}
      </Typography>
      {comment.postTitle && (
        <Typography variant="caption" color="text.secondary">
          文章：{comment.postTitle}
        </Typography>
      )}
    </Paper>
  );

  const renderCommentList = () => {
    if (loading) {
      return (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 1,
            overflow: 'hidden',
            ...paperShadow,
          }}
        >
          <Loading text="加载评论中..." />
        </Paper>
      );
    }
    if (comments.length === 0) {
      return (
        <Fade in timeout={400}>
          <Paper
            elevation={0}
            sx={{
              p: 4,
              textAlign: 'center',
              borderRadius: 1,
              ...paperShadow,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              暂无评论
            </Typography>
          </Paper>
        </Fade>
      );
    }
    return (
      <Fade in timeout={400}>
        <Paper
          elevation={0}
          sx={{
            borderRadius: 1,
            overflow: 'hidden',
            ...paperShadow,
          }}
        >
          <Box sx={{ p: 2 }}>
            {comments.map((comment, index) => (
              <Box key={comment.id}>
                {renderCommentCard(comment)}
                {index < comments.length - 1 && (
                  <Divider sx={{ my: 1 }} />
                )}
              </Box>
            ))}
          </Box>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 20, 50]}
            labelRowsPerPage="每页"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
            sx={{
              borderTop: '1px solid',
              borderColor: 'divider',
              '& .MuiTablePagination-toolbar': {
                flexWrap: 'wrap',
                gap: 1,
                py: 1,
              },
            }}
          />
        </Paper>
      </Fade>
    );
  };

  return (
    <Fade in timeout={400}>
    <Box>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        评论管理
      </Typography>

      {isMobileAdmin ? (
        <FormControl size="small" sx={{ mb: 3, minWidth: 140, maxWidth: '100%' }}>
          <Select
            value={tab}
            onChange={(e) => setTab(e.target.value as CommentTab)}
            sx={{
              borderRadius: 1,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
              '& .MuiSelect-select': {
                fontWeight: 600,
                color: 'primary.main',
                py: 1,
                px: 2,
              },
            }}
          >
            {TAB_LIST.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : (
        <Box
          onWheel={(e) => {
            const el = e.currentTarget;
            if (el.scrollWidth <= el.clientWidth) return;
            e.preventDefault();
            el.scrollLeft += e.deltaY;
          }}
          sx={{
            mb: 3,
            maxWidth: '100%',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            pb: 0.5,
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          <Box
            sx={{
              position: 'relative',
              display: 'inline-flex',
              minWidth: 'max-content',
              p: 0.5,
              borderRadius: 6,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 4,
                bottom: 4,
                left: 4,
                width: `calc((100% - 8px) / ${TAB_LIST.length})`,
                bgcolor: 'background.paper',
                borderRadius: 6,
                boxShadow: (theme) => `0 2px 10px ${alpha(theme.palette.common.black, 0.08)}`,
                transition: (theme) =>
                  theme.transitions.create('transform', {
                    easing: theme.transitions.easing.easeInOut,
                    duration: theme.transitions.duration.short,
                  }),
                transform: `translateX(${TAB_LIST.findIndex((t) => t.value === tab) * 100}%)`,
              }}
            />
            {TAB_LIST.map((item) => (
              <Button
                key={item.value}
                onClick={() => setTab(item.value)}
                sx={{
                  flex: 1,
                  zIndex: 1,
                  py: 1,
                  px: { xs: 1.5, sm: 2 },
                  minWidth: { xs: 72, sm: 90 },
                  borderRadius: 6,
                  color: tab === item.value ? 'primary.main' : 'text.secondary',
                  fontWeight: tab === item.value ? 700 : 500,
                  fontSize: { xs: '0.85rem', sm: '0.95rem' },
                  textTransform: 'none',
                  bgcolor: 'transparent',
                  boxShadow: 'none',
                  whiteSpace: 'nowrap',
                  '&:hover': { bgcolor: 'transparent' },
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>
        </Box>
      )}

      <Fade in timeout={300} key={tab}>
        <Box>
          {tab === 'settings' && renderSettings()}
          {tab === 'audit' && renderCommentList()}
          {tab === 'manage' && renderCommentList()}
        </Box>
      </Fade>

      <ConfirmDialog
        open={deleteDialog.open}
        title="确认删除评论？"
        content="删除后该评论将无法恢复，是否继续？"
        confirmText="确认删除"
        confirmColor="error"
        loading={deleteDialog.id != null && deletingIds.has(deleteDialog.id)}
        onClose={() => setDeleteDialog({ open: false, id: null })}
        onConfirm={handleConfirmDelete}
      />
    </Box>
    </Fade>
  );
}
