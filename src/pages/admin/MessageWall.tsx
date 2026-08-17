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
  ToggleButtonGroup,
  ToggleButton,
  Checkbox,
  useMediaQuery,
  alpha,
  Fade,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import { getMessageWallSettings, updateMessageWallSettings, getAdminMessages, updateAdminMessage, updateAdminMessagesBatch, deleteAdminMessage } from '@/api/messages';
import { Loading } from '@/components/Common/Loading';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import type { MessageWallSettings, Message, MessageWallStyle } from '@/types/interaction';
import SubscriptionsIcon from '@mui/icons-material/Subscriptions';
import StyleIcon from '@mui/icons-material/Style';
import TimelineIcon from '@mui/icons-material/Timeline';

type Tab = 'settings' | 'audit' | 'manage';

const TAB_LIST: { value: Tab; label: string }[] = [
  { value: 'settings', label: '基础设置' },
  { value: 'audit', label: '留言审核' },
  { value: 'manage', label: '留言管理' },
];

const STYLE_OPTIONS: { value: MessageWallStyle; label: string; icon: React.ReactNode }[] = [
  { value: 'danmaku', label: '弹幕', icon: <SubscriptionsIcon sx={{ fontSize: 18 }} /> },
  { value: 'flipcard', label: '翻牌', icon: <StyleIcon sx={{ fontSize: 18 }} /> },
  { value: 'timetunnel', label: '时空隧道', icon: <TimelineIcon sx={{ fontSize: 18 }} /> },
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

export function AdminMessageWall() {
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  const [tab, setTab] = useState<Tab>('settings');

  const [settings, setSettings] = useState<MessageWallSettings>({
    enabled: false,
    allowAnonymous: true,
    auditEnabled: false,
    defaultStyle: 'danmaku',
  });
  const [initialSettings, setInitialSettings] = useState<MessageWallSettings>(settings);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: number | null }>({
    open: false,
    id: null,
  });

  const loadMessages = useCallback(
    async (targetPage: number, status?: string, limit = rowsPerPage) => {
      setLoading(true);
      const res = await getAdminMessages(status, targetPage, limit);
      if (res.code === 0 && res.data) {
        setMessages(res.data.list);
        setTotal(res.data.total);
      } else {
        enqueueSnackbar(res.msg || '获取留言失败', { variant: 'error' });
      }
      setLoading(false);
    },
    [enqueueSnackbar, rowsPerPage]
  );

  useEffect(() => {
    getMessageWallSettings().then((res) => {
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
    getAdminMessages(status, 1, rowsPerPage)
      .then((res) => {
        if (res.code === 0 && res.data) {
          setMessages(res.data.list);
          setTotal(res.data.total);
        } else {
          enqueueSnackbar(res.msg || '获取留言失败', { variant: 'error' });
        }
        setPage(0);
        setSelectedIds(new Set());
        setLoading(false);
      })
      .catch(() => {
        setMessages([]);
        setTotal(0);
        setLoading(false);
      });
  }, [tab, rowsPerPage, enqueueSnackbar]);

  const handleSaveSettings = async () => {
    setSaving(true);
    const res = await updateMessageWallSettings(settings);
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
      const res = await updateAdminMessage(id, { status });
      if (res.code === 0) {
        enqueueSnackbar(status === 'approved' ? '已通过' : '已拒绝', { variant: 'success' });
        loadMessages(page + 1, tab === 'audit' ? 'pending' : 'approved');
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

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allSelected = messages.length > 0 && messages.every((m) => selectedIds.has(m.id));
  const someSelected = messages.some((m) => selectedIds.has(m.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(messages.map((m) => m.id)));
    }
  };

  const handleBatchApprove = async (ids: number[]) => {
    if (ids.length === 0) return;
    setBatchLoading(true);
    try {
      const res = await updateAdminMessagesBatch(ids, 'approved');
      if (res.code === 0) {
        enqueueSnackbar(`已通过 ${ids.length} 条留言`, { variant: 'success' });
        setSelectedIds(new Set());
        loadMessages(page + 1, tab === 'audit' ? 'pending' : 'approved');
      } else {
        enqueueSnackbar(res.msg || '操作失败', { variant: 'error' });
      }
    } finally {
      setBatchLoading(false);
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
      const res = await deleteAdminMessage(id);
      if (res.code === 0) {
        enqueueSnackbar('删除成功', { variant: 'success' });
        loadMessages(page + 1, tab === 'audit' ? 'pending' : 'approved');
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
    loadMessages(newPage + 1, tab === 'audit' ? 'pending' : 'approved');
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
                  checked={settings.enabled}
                  onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
                />
              }
              label="开启留言墙功能"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.allowAnonymous}
                  onChange={(e) => setSettings((s) => ({ ...s, allowAnonymous: e.target.checked }))}
                />
              }
              label="允许匿名留言"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.auditEnabled}
                  onChange={(e) => setSettings((s) => ({ ...s, auditEnabled: e.target.checked }))}
                />
              }
              label="开启留言审核（新留言需审核后显示）"
            />
            <Divider sx={{ my: 1 }} />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                默认展示样式
              </Typography>
              <ToggleButtonGroup
                value={settings.defaultStyle}
                exclusive
                onChange={(_, val) => {
                  if (val) setSettings((s) => ({ ...s, defaultStyle: val }));
                }}
                size="small"
                sx={{
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                  borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                  p: 0.3,
                  '& .MuiToggleButton-root': {
                    border: 'none',
                    borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                    px: 1.5,
                    py: 0.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    color: 'text.secondary',
                    gap: 0.5,
                    '&.Mui-selected': {
                      bgcolor: 'background.paper',
                      color: 'primary.main',
                      boxShadow: (theme) => `0 2px 10px ${alpha(theme.palette.common.black, 0.08)}`,
                    },
                    '&:hover': { bgcolor: 'transparent' },
                  },
                }}
              >
                {STYLE_OPTIONS.map((opt) => (
                  <ToggleButton key={opt.value} value={opt.value}>
                    {opt.icon}
                    {opt.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <Divider sx={{ my: 1 }} />
            <FloatingSaveButton show={settingsDirty} saving={saving} onClick={handleSaveSettings} label="保存" />
          </Box>
        </Fade>
      )}
    </Paper>
  );

  const renderMessageCard = (msg: Message) => (
    <Paper
      key={msg.id}
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
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5, minWidth: 0 }}>
        {tab === 'audit' && (
          <Checkbox
            size="small"
            checked={selectedIds.has(msg.id)}
            onChange={() => toggleSelect(msg.id)}
            sx={{ p: 0.5, mt: -0.5 }}
          />
        )}
        {msg.userId ? (
          <Avatar src={msg.avatar || undefined} alt={msg.username || '用户'} sx={{ width: 40, height: 40, flexShrink: 0 }} />
        ) : (
          <Avatar sx={{ width: 40, height: 40, flexShrink: 0, bgcolor: (t) => alpha(t.palette.text.secondary, 0.12), color: 'text.secondary', fontSize: 14 }}>
            访
          </Avatar>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ overflowWrap: 'break-word', fontWeight: 700 }}>
            {msg.userId ? (msg.username || '用户') : (msg.nickname || '匿名访客')}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'break-word' }}>
            {formatTime(msg.createdAt)}
            {msg.userId && msg.nickname && (
              <Box component="span" sx={{ ml: 1, opacity: 0.6 }}>
                (昵称: {msg.nickname})
              </Box>
            )}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          {tab === 'audit' && (
            <Button
              size="small"
              variant="outlined"
              color="success"
              disabled={processingIds.has(msg.id)}
              onClick={() => handleStatusChange(msg.id, 'approved')}
              startIcon={processingIds.has(msg.id) ? <CircularProgress size={14} color="inherit" /> : undefined}
              sx={{ textTransform: 'none', borderRadius: 1, minWidth: 64 }}
            >
              {processingIds.has(msg.id) ? '通过中' : '通过'}
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            color="error"
            disabled={deletingIds.has(msg.id)}
            onClick={() => handleDeleteClick(msg.id)}
            startIcon={deletingIds.has(msg.id) ? <CircularProgress size={14} color="inherit" /> : undefined}
            sx={{ textTransform: 'none', borderRadius: 1, minWidth: 64 }}
          >
            {deletingIds.has(msg.id) ? '删除中' : '删除'}
          </Button>
        </Box>
      </Box>
      <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {msg.content}
      </Typography>
      {!msg.userId && msg.nickname && (
        <Typography variant="caption" color="text.secondary">
          匿名用户：{msg.nickname}
        </Typography>
      )}
    </Paper>
  );

  const renderMessageList = () => {
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
          <Loading text="加载留言中..." />
        </Paper>
      );
    }
    if (messages.length === 0) {
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
              暂无留言
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
            {tab === 'audit' && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1.5,
                  mb: 2,
                  border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.15)}`,
                  borderRadius: 1,
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
                  flexWrap: 'wrap',
                }}
              >
                <Checkbox
                  size="small"
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onChange={toggleSelectAll}
                />
                <Typography variant="caption" color="text.secondary">
                  已选 {selectedIds.size} 项
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  disabled={selectedIds.size === 0 || batchLoading}
                  onClick={() => handleBatchApprove([...selectedIds])}
                  startIcon={batchLoading ? <CircularProgress size={14} color="inherit" /> : undefined}
                  sx={{ textTransform: 'none', borderRadius: 1, minWidth: 88 }}
                >
                  {batchLoading ? '处理中' : '同意选中'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  disabled={messages.length === 0 || batchLoading}
                  onClick={() => handleBatchApprove(messages.map((m) => m.id))}
                  sx={{ textTransform: 'none', borderRadius: 1, minWidth: 88 }}
                >
                  全部同意
                </Button>
              </Box>
            )}
            {messages.map((msg, index) => (
              <Box key={msg.id}>
                {renderMessageCard(msg)}
                {index < messages.length - 1 && (
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
        留言墙管理
      </Typography>

      {isMobileAdmin ? (
        <FormControl size="small" sx={{ mb: 3, minWidth: 140, maxWidth: '100%' }}>
          <Select
            value={tab}
            onChange={(e) => setTab(e.target.value as Tab)}
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
          {tab === 'audit' && renderMessageList()}
          {tab === 'manage' && renderMessageList()}
        </Box>
      </Fade>

      <ConfirmDialog
        open={deleteDialog.open}
        title="确认删除留言？"
        content="删除后该留言将无法恢复，是否继续？"
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